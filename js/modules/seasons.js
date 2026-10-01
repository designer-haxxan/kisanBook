// Crop Seasons — #/seasons  (one season = one crop planted on one plot)
import * as idb from '../db/idb.js';
import * as UI from '../core/ui.js';
import { esc, uuid, nowISO, today, lc, fmtNum } from '../core/utils.js';
import * as Catalog from '../services/farmCatalog.js';
import { SEASONS, EXPENSE_CATEGORIES } from '../db/schema.js';
import { weightUnitLabel } from '../core/units.js';

const $ = window.jQuery;
let $root;

const STATUS_LABELS = {
  planning:  ['Planning',  'secondary'],
  growing:   ['Growing',   'success'  ],
  harvested: ['Harvested', 'warning'  ],
  sold:      ['Sold',      'primary'  ],
  complete:  ['Complete',  'dark'     ],
};

function statusBadge(status) {
  const [label, color] = STATUS_LABELS[status] || ['Unknown', 'secondary'];
  return `<span class="badge bg-${color}-subtle text-${color}">${label}</span>`;
}

function seasonIcon(s) {
  return s === 'kharif' ? '☀️' : s === 'rabi' ? '🌾' : '📅';
}

// ── Season summary totals (read from IndexedDB) ──────────
async function seasonTotals(seasonId) {
  const [expenses, labor, harvests, sales] = await idb.read(
    ['expenses', 'laborEntries', 'harvests', 'sales'],
    (t) => Promise.all([
      t.getAllByIndex('expenses',     'seasonId', seasonId),
      t.getAllByIndex('laborEntries', 'seasonId', seasonId),
      t.getAllByIndex('harvests',     'seasonId', seasonId),
      t.getAllByIndex('sales',        'seasonId', seasonId),
    ]),
  );
  const matCost   = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const laborCost = labor.reduce((s, l) => s + (l.totalAmount || 0), 0);
  const totalCost = matCost + laborCost;
  const harvested = harvests.reduce((s, h) => s + (h.quantity || 0), 0);
  const harvestUnit = harvests[0]?.unit || '';
  const grossIncome = sales.reduce((s, sl) => s + (sl.grossAmount || 0), 0);
  const netIncome   = sales.reduce((s, sl) => s + (sl.netAmount   || 0), 0);
  const pendingAmt  = sales.reduce((s, sl) => s + (sl.netAmount - (sl.paidAmount || 0)), 0);
  return { matCost, laborCost, totalCost, harvested, harvestUnit, grossIncome, netIncome, pendingAmt, profit: netIncome - totalCost };
}

// ── Season form modal ────────────────────────────────────
async function openSeasonModal(existing = null) {
  const isEdit = !!existing;
  const s      = existing || {};
  const farms  = Catalog.allFarms();
  const crops  = Catalog.allCrops();

  if (!farms.length) { UI.toast('Add a farm first.', 'warning'); return null; }
  if (!crops.length) { UI.toast('No crops available.', 'warning'); return null; }

  const allPlots = Catalog.allPlots();

  const html = `
    <div class="mb-3">
      <label class="form-label">Farm <span class="text-danger">*</span></label>
      <select id="sn-farm" class="form-select">
        <option value="">Select farm…</option>
        ${farms.map((f) => `<option value="${f.id}" ${s.farmId===f.id?'selected':''}>${esc(f.name)}</option>`).join('')}
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label">Plot / Field <span class="text-danger">*</span></label>
      <select id="sn-plot" class="form-select">
        <option value="">Select plot…</option>
        ${allPlots.map((p) => `<option value="${p.id}" data-farm="${p.farmId}" ${s.plotId===p.id?'selected':''}>${esc(p.name)}${p.acres?' ('+p.acres+' Acres)':''}</option>`).join('')}
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label">Crop <span class="text-danger">*</span></label>
      <select id="sn-crop" class="form-select">
        <option value="">Select crop…</option>
        ${crops.map((c) => `<option value="${c.id}" ${s.cropId===c.id?'selected':''}>${esc(c.name)} ${c.urdu||''}</option>`).join('')}
      </select>
    </div>
    <div class="row g-2 mb-3">
      <div class="col-6">
        <label class="form-label">Season</label>
        <select id="sn-season" class="form-select">
          ${SEASONS.map((ss) => `<option value="${ss.id}" ${(s.season||'kharif')===ss.id?'selected':''}>${ss.icon} ${esc(ss.label)}</option>`).join('')}
        </select>
      </div>
      <div class="col-6">
        <label class="form-label">Year <span class="text-danger">*</span></label>
        <input id="sn-year" type="number" min="2000" max="2100" class="form-control" value="${s.year || new Date().getFullYear()}">
      </div>
    </div>
    <div class="row g-2 mb-3">
      <div class="col-6">
        <label class="form-label">Sowing Date</label>
        <input id="sn-start" type="date" class="form-control" value="${s.startDate || ''}">
      </div>
      <div class="col-6">
        <label class="form-label">Expected Harvest</label>
        <input id="sn-harvest" type="date" class="form-control" value="${s.expectedHarvestDate || ''}">
      </div>
    </div>
    <div class="mb-3">
      <label class="form-label">Status</label>
      <select id="sn-status" class="form-select">
        ${Object.entries(STATUS_LABELS).map(([v, [l]]) => `<option value="${v}" ${(s.status||'planning')===v?'selected':''}>${l}</option>`).join('')}
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label">Notes</label>
      <textarea id="sn-notes" class="form-control" rows="2" placeholder="Optional notes">${esc(s.notes || '')}</textarea>
    </div>`;

  const result = await UI.formDialog(isEdit ? 'Edit Season' : 'New Crop Season', html, { okLabel: isEdit ? 'Save' : 'Add Season' });
  if (!result) return null;

  const farmId = $('#sn-farm').val();
  const plotId = $('#sn-plot').val();
  const cropId = $('#sn-crop').val();
  const year   = parseInt($('#sn-year').val());

  if (!farmId || !plotId || !cropId || !year) { UI.toast('Farm, plot, crop and year are required.', 'danger'); return null; }

  const farm = Catalog.farm(farmId);
  const crop = Catalog.crop(cropId);
  const plot = Catalog.plot(plotId);
  const now  = nowISO();
  const rec  = {
    id:                  isEdit ? s.id : uuid(),
    farmId, plotId, cropId,
    name:                `${crop?.name || ''} — ${plot?.name || ''} ${year}`,
    season:              $('#sn-season').val(),
    year,
    startDate:           $('#sn-start').val() || null,
    expectedHarvestDate: $('#sn-harvest').val() || null,
    status:              $('#sn-status').val(),
    notes:               $('#sn-notes').val().trim(),
    createdAt:           isEdit ? s.createdAt : now,
    updatedAt:           now,
  };
  await idb.put('seasons', rec);
  document.dispatchEvent(new CustomEvent('data:changed'));
  return rec;
}

// ── Render ───────────────────────────────────────────────
async function renderSeasonRow(s) {
  const farm = Catalog.farm(s.farmId);
  const plot = Catalog.plot(s.plotId);
  const crop = Catalog.crop(s.cropId);
  const t    = await seasonTotals(s.id);
  const profitColor = t.profit >= 0 ? 'text-success' : 'text-danger';

  return `
    <div class="card mb-3 season-card" data-id="${s.id}">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="fs-5">${seasonIcon(s.season)}</span>
              <h6 class="mb-0 fw-bold">${esc(crop?.name || '—')} <span class="text-muted fw-normal">${s.year}</span></h6>
              ${statusBadge(s.status)}
            </div>
            <div class="text-muted small">
              <i class="bi bi-geo-alt me-1"></i>${esc(farm?.name || '?')} › ${esc(plot?.name || '?')}
              ${s.startDate ? ` · Sown: ${s.startDate}` : ''}
            </div>
          </div>
          <div class="dropdown">
            <button class="btn btn-sm btn-light" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical"></i></button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><a class="dropdown-item" href="#/expenses?season=${s.id}"><i class="bi bi-receipt-cutoff me-2"></i>Add Expense</a></li>
              <li><a class="dropdown-item" href="#/labor?season=${s.id}"><i class="bi bi-people me-2"></i>Add Labor</a></li>
              <li><a class="dropdown-item" href="#/harvest?season=${s.id}"><i class="bi bi-basket2 me-2"></i>Record Harvest</a></li>
              <li><a class="dropdown-item" href="#/sales?season=${s.id}"><i class="bi bi-cash-coin me-2"></i>Record Sale</a></li>
              <li><hr class="dropdown-divider"></li>
              <li><button class="dropdown-item btn-edit-season"><i class="bi bi-pencil me-2"></i>Edit Season</button></li>
              <li><button class="dropdown-item text-danger btn-del-season"><i class="bi bi-trash me-2"></i>Delete</button></li>
            </ul>
          </div>
        </div>
        <div class="row g-2 mt-2 text-center small">
          <div class="col-3">
            <div class="text-muted">Expenses</div>
            <div class="fw-semibold text-danger">Rs ${fmtNum(t.totalCost)}</div>
          </div>
          <div class="col-3">
            <div class="text-muted">Harvested</div>
            <div class="fw-semibold">${t.harvested ? fmtNum(t.harvested) + ' ' + weightUnitLabel(t.harvestUnit) : '—'}</div>
          </div>
          <div class="col-3">
            <div class="text-muted">Income</div>
            <div class="fw-semibold text-primary">Rs ${fmtNum(t.netIncome)}</div>
          </div>
          <div class="col-3">
            <div class="text-muted">Profit</div>
            <div class="fw-semibold ${profitColor}">Rs ${fmtNum(t.profit)}</div>
          </div>
        </div>
        ${t.pendingAmt > 0.5 ? `<div class="alert alert-warning py-1 px-2 small mb-0 mt-2"><i class="bi bi-exclamation-circle me-1"></i>Rs ${fmtNum(t.pendingAmt)} payment pending from buyers.</div>` : ''}
      </div>
    </div>`;
}

export default {
  async render(el, { params = [] } = {}) {
    this.destroy();
    $root = $(el);
    $root.html(UI.spinner());

    // Optional filter by farm
    const filterFarmId = params[0] || null;
    let seasons = await idb.getAll('seasons');
    seasons = seasons.sort((a, b) => b.year - a.year || (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (filterFarmId) seasons = seasons.filter((s) => s.farmId === filterFarmId);

    const farm = filterFarmId ? Catalog.farm(filterFarmId) : null;
    const titleSuffix = farm ? ` — ${esc(farm.name)}` : '';

    if (!seasons.length) {
      $root.html(`
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="mb-0">Crop Seasons${titleSuffix}</h5>
          <button class="btn btn-success btn-new-season"><i class="bi bi-plus-lg me-1"></i>New Season</button>
        </div>
        ${UI.emptyState('No seasons yet.\nStart by adding a crop season for one of your farm plots.', 'flower1')}`);
    } else {
      const cards = await Promise.all(seasons.map(renderSeasonRow));
      $root.html(`
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="mb-0">Crop Seasons <span class="badge bg-secondary ms-1">${seasons.length}</span>${titleSuffix}</h5>
          <button class="btn btn-success btn-new-season"><i class="bi bi-plus-lg me-1"></i>New Season</button>
        </div>
        ${cards.join('')}`);
    }

    $root.on('click', '.btn-new-season', async () => {
      const rec = await openSeasonModal();
      if (rec) this.render(el, { params });
    });

    $root.on('click', '.btn-edit-season', async function () {
      const id  = $(this).closest('.season-card').data('id');
      const old = await idb.get('seasons', id);
      const rec = await openSeasonModal(old);
      if (rec) this.render(el, { params });
    }.bind(this));

    $root.on('click', '.btn-del-season', async function () {
      const id = $(this).closest('.season-card').data('id');
      const s  = await idb.get('seasons', id);
      if (!s) return;
      if (!await UI.confirmDialog(`Delete season "${s.name}"? This will not delete expenses, labor or harvest records linked to it.`, { okLabel: 'Delete', okClass: 'btn-danger' })) return;
      await idb.delete('seasons', id);
      this.render(el, { params });
    }.bind(this));
  },

  destroy() { $root?.off(); $root = null; },
};
