// KisanBook Reports — Profit/Loss, Expense Breakdown, Crop Comparison, Season Detail
import * as idb from '../db/idb.js';
import * as UI from '../core/ui.js';
import { esc, fmtNum, today } from '../core/utils.js';
import * as Catalog from '../services/farmCatalog.js';
import { EXPENSE_CATEGORIES } from '../db/schema.js';
import { weightUnitLabel } from '../core/units.js';

const $ = window.jQuery;
let $root;
const catMap = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.id, c]));

// ── Data loader ──────────────────────────────────────────
async function loadAll() {
  const [seasons, expenses, labor, harvests, sales] = await Promise.all([
    idb.getAll('seasons'),
    idb.getAll('expenses'),
    idb.getAll('laborEntries'),
    idb.getAll('harvests'),
    idb.getAll('sales'),
  ]);
  return { seasons, expenses, labor, harvests, sales };
}

function seasonSummary(seasonId, data) {
  const matCost    = data.expenses.filter((e) => e.seasonId === seasonId).reduce((s, e) => s + (e.amount || 0), 0);
  const laborCost  = data.labor.filter((l) => l.seasonId === seasonId).reduce((s, l) => s + (l.totalAmount || 0), 0);
  const totalCost  = matCost + laborCost;
  const harvestQty = data.harvests.filter((h) => h.seasonId === seasonId && h.unit === 'maund').reduce((s, h) => s + (h.quantity || 0), 0);
  const netIncome  = data.sales.filter((sl) => sl.seasonId === seasonId).reduce((s, sl) => s + (sl.netAmount || 0), 0);
  return { matCost, laborCost, totalCost, harvestQty, netIncome, profit: netIncome - totalCost };
}

function progressBar(val, max, color = 'bg-success') {
  const pct = max > 0 ? Math.round((val / max) * 100) : 0;
  return `<div class="progress" style="height:6px"><div class="progress-bar ${color}" style="width:${pct}%"></div></div>`;
}

// ── Report: Season P&L ───────────────────────────────────
function renderSeasonPL(data) {
  const rows = data.seasons.map((s) => {
    const crop  = Catalog.crop(s.cropId);
    const farm  = Catalog.farm(s.farmId);
    const plot  = Catalog.plot(s.plotId);
    const sm    = seasonSummary(s.id, data);
    const profitClass = sm.profit >= 0 ? 'text-success' : 'text-danger';
    return `
      <tr>
        <td>
          <div class="fw-semibold">${esc(crop?.name || '?')}</div>
          <div class="text-muted small">${esc(farm?.name || '')} › ${esc(plot?.name || '')} ${s.year}</div>
        </td>
        <td class="text-end">Rs ${fmtNum(sm.matCost)}</td>
        <td class="text-end">Rs ${fmtNum(sm.laborCost)}</td>
        <td class="text-end fw-semibold text-danger">Rs ${fmtNum(sm.totalCost)}</td>
        <td class="text-end">${sm.harvestQty > 0 ? fmtNum(sm.harvestQty) + ' Mnd' : '—'}</td>
        <td class="text-end">Rs ${fmtNum(sm.netIncome)}</td>
        <td class="text-end fw-bold ${profitClass}">Rs ${fmtNum(sm.profit)}</td>
      </tr>`;
  });

  if (!rows.length) return UI.emptyState('No seasons found.', 'flower1');

  const totals = data.seasons.reduce((acc, s) => {
    const sm = seasonSummary(s.id, data);
    acc.cost += sm.totalCost; acc.income += sm.netIncome; acc.profit += sm.profit;
    return acc;
  }, { cost: 0, income: 0, profit: 0 });

  return `
    <div class="table-responsive">
      <table class="table table-hover table-sm">
        <thead class="table-light">
          <tr>
            <th>Season</th>
            <th class="text-end">Material</th>
            <th class="text-end">Labor</th>
            <th class="text-end">Total Cost</th>
            <th class="text-end">Harvested</th>
            <th class="text-end">Net Income</th>
            <th class="text-end">Profit / Loss</th>
          </tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
        <tfoot class="table-light fw-bold">
          <tr>
            <td>Total</td>
            <td></td><td></td>
            <td class="text-end text-danger">Rs ${fmtNum(totals.cost)}</td>
            <td></td>
            <td class="text-end text-primary">Rs ${fmtNum(totals.income)}</td>
            <td class="text-end ${totals.profit >= 0 ? 'text-success' : 'text-danger'}">Rs ${fmtNum(totals.profit)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

// ── Report: Expense Breakdown ────────────────────────────
function renderExpenseBreakdown(data) {
  const byCat = {};
  for (const e of data.expenses) {
    byCat[e.category] = (byCat[e.category] || 0) + (e.amount || 0);
  }
  const laborTotal = data.labor.reduce((s, l) => s + (l.totalAmount || 0), 0);
  if (laborTotal > 0) byCat['labor'] = laborTotal;

  const total = Object.values(byCat).reduce((s, v) => s + v, 0);
  if (!total) return UI.emptyState('No expenses recorded.', 'receipt-cutoff');

  const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  return `
    <div class="card mb-3">
      <div class="card-body text-center">
        <div class="text-muted small">Total Expenses</div>
        <div class="fw-bold fs-3 text-danger">Rs ${fmtNum(total)}</div>
      </div>
    </div>
    ${sorted.map(([catId, amt]) => {
      const cat   = catId === 'labor' ? { label: 'Labor', urdu: 'مزدوری', icon: 'people' } : catMap[catId];
      const pct   = total > 0 ? ((amt / total) * 100).toFixed(1) : 0;
      return `
        <div class="mb-3">
          <div class="d-flex justify-content-between mb-1">
            <span><i class="bi bi-${cat?.icon || 'circle'} me-2"></i><strong>${cat?.label || catId}</strong> <span class="text-muted small">${cat?.urdu || ''}</span></span>
            <span class="text-end"><strong>Rs ${fmtNum(amt)}</strong> <span class="text-muted small">${pct}%</span></span>
          </div>
          ${progressBar(amt, total, 'bg-danger')}
        </div>`;
    }).join('')}`;
}

// ── Report: Crop Performance ─────────────────────────────
function renderCropPerformance(data) {
  const byCrop = {};
  for (const s of data.seasons) {
    const cropId = s.cropId;
    if (!byCrop[cropId]) byCrop[cropId] = { seasons: [], cost: 0, income: 0, harvest: 0 };
    const sm = seasonSummary(s.id, data);
    byCrop[cropId].seasons.push(s);
    byCrop[cropId].cost    += sm.totalCost;
    byCrop[cropId].income  += sm.netIncome;
    byCrop[cropId].harvest += sm.harvestQty;
  }

  if (!Object.keys(byCrop).length) return UI.emptyState('No data to compare.', 'bar-chart-line');

  const rows = Object.entries(byCrop).sort((a, b) => (b[1].income - b[1].cost) - (a[1].income - a[1].cost)).map(([cropId, d]) => {
    const crop   = Catalog.crop(cropId);
    const profit = d.income - d.cost;
    const roi    = d.cost > 0 ? ((profit / d.cost) * 100).toFixed(0) : 0;
    return `
      <tr>
        <td>
          <div class="fw-semibold">${esc(crop?.name || '?')}</div>
          <div class="text-muted small">${crop?.urdu || ''} · ${d.seasons.length} season${d.seasons.length !== 1 ? 's' : ''}</div>
        </td>
        <td class="text-end text-danger">Rs ${fmtNum(d.cost)}</td>
        <td class="text-end text-primary">Rs ${fmtNum(d.income)}</td>
        <td class="text-end fw-bold ${profit >= 0 ? 'text-success' : 'text-danger'}">Rs ${fmtNum(profit)}</td>
        <td class="text-end">${roi}%</td>
        <td class="text-end text-muted">${d.harvest > 0 ? fmtNum(d.harvest) + ' Mnd' : '—'}</td>
      </tr>`;
  });

  return `
    <div class="table-responsive">
      <table class="table table-hover table-sm">
        <thead class="table-light"><tr>
          <th>Crop</th><th class="text-end">Cost</th><th class="text-end">Income</th>
          <th class="text-end">Profit</th><th class="text-end">ROI</th><th class="text-end">Harvest</th>
        </tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
}

// ── Report: Farm Performance ─────────────────────────────
function renderFarmPerformance(data) {
  const byFarm = {};
  for (const s of data.seasons) {
    const fid = s.farmId;
    if (!byFarm[fid]) byFarm[fid] = { cost: 0, income: 0, seasons: 0 };
    const sm = seasonSummary(s.id, data);
    byFarm[fid].cost += sm.totalCost;
    byFarm[fid].income += sm.netIncome;
    byFarm[fid].seasons++;
  }
  if (!Object.keys(byFarm).length) return UI.emptyState('No farm data yet.', 'geo-alt');

  return Object.entries(byFarm).map(([fid, d]) => {
    const farm   = Catalog.farm(fid);
    const profit = d.income - d.cost;
    const plots  = Catalog.plotsFor(fid);
    return `
      <div class="card mb-2">
        <div class="card-body py-2 px-3">
          <div class="d-flex justify-content-between">
            <div>
              <div class="fw-semibold">${esc(farm?.name || '?')}</div>
              <div class="text-muted small">${esc(farm?.location || '')} · ${plots.length} plots · ${d.seasons} seasons</div>
            </div>
            <div class="text-end">
              <div class="fw-bold ${profit >= 0 ? 'text-success' : 'text-danger'}">Rs ${fmtNum(profit)}</div>
              <div class="text-muted small">Profit</div>
            </div>
          </div>
          <div class="row g-2 mt-1 text-center small">
            <div class="col-4"><div class="text-muted">Cost</div><div class="text-danger">Rs ${fmtNum(d.cost)}</div></div>
            <div class="col-4"><div class="text-muted">Income</div><div class="text-primary">Rs ${fmtNum(d.income)}</div></div>
            <div class="col-4"><div class="text-muted">ROI</div><div>${d.cost > 0 ? (((d.income - d.cost) / d.cost) * 100).toFixed(0) + '%' : '—'}</div></div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── Main render ──────────────────────────────────────────
export default {
  async render(el) {
    this.destroy();
    $root = $(el);
    $root.html(UI.spinner());

    const data = await loadAll();

    const TABS = [
      { id: 'pl',    label: 'Season P&L',        render: () => renderSeasonPL(data)         },
      { id: 'exp',   label: 'Expense Breakdown',  render: () => renderExpenseBreakdown(data) },
      { id: 'crop',  label: 'By Crop',            render: () => renderCropPerformance(data)  },
      { id: 'farm',  label: 'By Farm',            render: () => renderFarmPerformance(data)  },
    ];

    let activeTab = 'pl';

    const renderTabs = () => `
      <ul class="nav nav-tabs mb-3">
        ${TABS.map((t) => `<li class="nav-item"><button class="nav-link ${t.id === activeTab ? 'active' : ''}" data-tab="${t.id}">${t.label}</button></li>`).join('')}
      </ul>
      <div id="report-body">${TABS.find((t) => t.id === activeTab)?.render() || ''}</div>`;

    $root.html(`<h5 class="mb-3">Reports</h5>${renderTabs()}`);

    $root.on('click', '[data-tab]', function () {
      activeTab = $(this).data('tab');
      $root.find('.nav-link').removeClass('active');
      $(this).addClass('active');
      $('#report-body').html(TABS.find((t) => t.id === activeTab)?.render() || '');
    });
  },

  destroy() { $root?.off(); $root = null; },
};
