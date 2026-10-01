// KisanBook Dashboard — farm overview, season summaries, pending payments, alerts
import * as idb from '../db/idb.js';
import * as UI from '../core/ui.js';
import { esc, fmtNum, today } from '../core/utils.js';
import * as Catalog from '../services/farmCatalog.js';
import { weightUnitLabel } from '../core/units.js';

const $ = window.jQuery;
let $root;

const STATUS_COLOR = { planning: 'secondary', growing: 'success', harvested: 'warning', sold: 'primary', complete: 'dark' };

async function buildStats() {
  const [seasons, expenses, labor, harvests, sales] = await Promise.all([
    idb.getAll('seasons'),
    idb.getAll('expenses'),
    idb.getAll('laborEntries'),
    idb.getAll('harvests'),
    idb.getAll('sales'),
  ]);

  const currentYear = new Date().getFullYear();
  const activeSeasons = seasons.filter((s) => ['planning', 'growing', 'harvested'].includes(s.status));
  const thisYearSeasons = seasons.filter((s) => s.year === currentYear);

  const totalExpenses = [...expenses, ...labor].reduce((s, e) => s + (e.amount || e.totalAmount || 0), 0);
  const totalIncome   = sales.reduce((s, sl) => s + (sl.netAmount || 0), 0);
  const pendingSales  = sales.filter((sl) => sl.paymentStatus !== 'received');
  const pendingAmt    = sales.reduce((s, sl) => s + Math.max(0, (sl.netAmount || 0) - (sl.paidAmount || 0)), 0);
  const totalHarvested = harvests.filter((h) => h.unit === 'maund').reduce((s, h) => s + (h.quantity || 0), 0);

  // This year's P&L
  const thisYearIds   = new Set(thisYearSeasons.map((s) => s.id));
  const tyExpenses    = [...expenses.filter((e) => thisYearIds.has(e.seasonId)), ...labor.filter((l) => thisYearIds.has(l.seasonId))];
  const tyIncome      = sales.filter((sl) => thisYearIds.has(sl.seasonId));
  const tyTotalCost   = tyExpenses.reduce((s, e) => s + (e.amount || e.totalAmount || 0), 0);
  const tyTotalIncome = tyIncome.reduce((s, sl) => s + (sl.netAmount || 0), 0);
  const tyProfit      = tyTotalIncome - tyTotalCost;

  return { activeSeasons, seasons, pendingAmt, pendingSales, totalHarvested, tyTotalCost, tyTotalIncome, tyProfit, currentYear };
}

function seasonCard(s) {
  const crop  = Catalog.crop(s.cropId);
  const farm  = Catalog.farm(s.farmId);
  const plot  = Catalog.plot(s.plotId);
  const color = STATUS_COLOR[s.status] || 'secondary';
  const icon  = s.season === 'kharif' ? '☀️' : '🌾';
  return `
    <a href="#/seasons" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
      <div>
        <span class="me-2">${icon}</span>
        <span class="fw-semibold">${esc(crop?.name || '?')}</span>
        <span class="text-muted ms-2 small">${esc(farm?.name || '')} › ${esc(plot?.name || '')} ${s.year}</span>
      </div>
      <span class="badge bg-${color}-subtle text-${color}">${s.status}</span>
    </a>`;
}

export default {
  async render(el) {
    this.destroy();
    $root = $(el);
    $root.html(UI.spinner());

    const farms   = Catalog.allFarms();
    const st      = await buildStats();
    const profitColor = st.tyProfit >= 0 ? 'success' : 'danger';

    if (!farms.length) {
      $root.html(`
        <div class="text-center py-5">
          <div style="font-size:4rem">🌾</div>
          <h4 class="mt-3">Welcome to KisanBook</h4>
          <p class="text-muted">پاکستان کا کسانی ریکارڈ سسٹم</p>
          <p class="text-muted">Start by adding your farm and plots, then record a crop season.</p>
          <div class="d-flex gap-2 justify-content-center mt-4">
            <a href="#/farms" class="btn btn-success"><i class="bi bi-plus-lg me-1"></i>Add Farm</a>
            <a href="#/seasons" class="btn btn-outline-success"><i class="bi bi-flower1 me-1"></i>New Season</a>
          </div>
        </div>`);
      return;
    }

    $root.html(`
      <!-- Year summary cards -->
      <div class="row g-2 mb-3">
        <div class="col-6 col-md-3">
          <div class="card text-center py-3">
            <div class="text-muted small">Active Seasons</div>
            <div class="fw-bold fs-4 text-success">${st.activeSeasons.length}</div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="card text-center py-3">
            <div class="text-muted small">${st.currentYear} Expenses</div>
            <div class="fw-bold fs-5 text-danger">Rs ${fmtNum(st.tyTotalCost)}</div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="card text-center py-3">
            <div class="text-muted small">${st.currentYear} Income</div>
            <div class="fw-bold fs-5 text-primary">Rs ${fmtNum(st.tyTotalIncome)}</div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="card text-center py-3 ${st.tyProfit < 0 ? 'border-danger' : ''}">
            <div class="text-muted small">${st.currentYear} Profit</div>
            <div class="fw-bold fs-5 text-${profitColor}">Rs ${fmtNum(st.tyProfit)}</div>
          </div>
        </div>
      </div>

      ${st.pendingAmt > 0.5 ? `
        <div class="alert alert-warning d-flex align-items-center gap-2 mb-3">
          <i class="bi bi-clock fs-5"></i>
          <div><strong>Rs ${fmtNum(st.pendingAmt)}</strong> payment pending from ${st.pendingSales.length} sale${st.pendingSales.length !== 1 ? 's' : ''}.
          <a href="#/sales" class="alert-link ms-1">View sales →</a></div>
        </div>` : ''}

      <!-- Active seasons -->
      <div class="card mb-3">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span class="fw-semibold">Active Seasons</span>
          <a href="#/seasons" class="btn btn-sm btn-outline-success">View all</a>
        </div>
        ${st.activeSeasons.length
          ? `<div class="list-group list-group-flush">${st.activeSeasons.slice(0, 5).map(seasonCard).join('')}</div>`
          : `<div class="card-body text-muted small">No active seasons. <a href="#/seasons">Start a new season →</a></div>`}
      </div>

      <!-- Quick actions -->
      <div class="card mb-3">
        <div class="card-header fw-semibold">Quick Actions</div>
        <div class="card-body">
          <div class="d-flex gap-2 flex-wrap">
            <a href="#/expenses" class="btn btn-outline-danger btn-sm"><i class="bi bi-receipt-cutoff me-1"></i>Add Expense</a>
            <a href="#/labor" class="btn btn-outline-secondary btn-sm"><i class="bi bi-people me-1"></i>Add Labor</a>
            <a href="#/harvest" class="btn btn-outline-warning btn-sm"><i class="bi bi-basket2 me-1"></i>Record Harvest</a>
            <a href="#/sales" class="btn btn-outline-success btn-sm"><i class="bi bi-cash-coin me-1"></i>Record Sale</a>
          </div>
        </div>
      </div>

      <!-- Farm summary -->
      <div class="card mb-3">
        <div class="card-header d-flex justify-content-between align-items-center">
          <span class="fw-semibold">Farms (${farms.length})</span>
          <a href="#/farms" class="btn btn-sm btn-outline-secondary">Manage</a>
        </div>
        <ul class="list-group list-group-flush">
          ${farms.map((f) => {
            const plots = Catalog.plotsFor(f.id);
            return `<li class="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <span class="fw-semibold">${esc(f.name)}</span>
                ${f.location ? `<span class="text-muted ms-2 small">${esc(f.location)}</span>` : ''}
              </div>
              <span class="badge bg-secondary-subtle text-secondary">${plots.length} plot${plots.length !== 1 ? 's' : ''}</span>
            </li>`;
          }).join('')}
        </ul>
      </div>`);
  },

  destroy() { $root?.off(); $root = null; },
};
