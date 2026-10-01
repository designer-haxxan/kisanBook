// Labor (Mazdoor) — #/labor  Track daily workers, wages, and activities
import * as idb from '../db/idb.js';
import * as UI from '../core/ui.js';
import { esc, uuid, nowISO, today, fmtNum, num } from '../core/utils.js';
import * as Catalog from '../services/farmCatalog.js';

const $ = window.jQuery;
let $root;

const ACTIVITIES = [
  'Plowing / Land Prep (ہل چلانا)',
  'Sowing / Planting (بوائی)',
  'Irrigation (پانی لگانا)',
  'Fertilizer Application (کھاد ڈالنا)',
  'Pesticide Spray (دوائی کرنا)',
  'Weeding (گوڈی)',
  'Cutting / Harvesting (کٹائی)',
  'Threshing (گاہنا)',
  'Packing / Loading (پیکنگ)',
  'General Labour (عام مزدوری)',
  'Other',
];

async function openLaborModal(existing = null, prefillSeasonId = null) {
  const isEdit = !!existing;
  const e      = existing || {};
  const seasons = (await idb.getAll('seasons'))
    .sort((a, b) => b.year - a.year || (b.createdAt || '').localeCompare(a.createdAt || ''));

  const seasonOptions = seasons.map((s) => {
    const crop = Catalog.crop(s.cropId);
    const plot = Catalog.plot(s.plotId);
    const farm = Catalog.farm(s.farmId);
    const label = `${crop?.name || '?'} — ${farm?.name || '?'} › ${plot?.name || '?'} (${s.year})`;
    const selected = (e.seasonId || prefillSeasonId) === s.id ? 'selected' : '';
    return `<option value="${s.id}" ${selected}>${esc(label)}</option>`;
  }).join('');

  const defaultWage = num(e.dailyWage) || 1000;  // common daily wage PKR
  const defaultDays = num(e.days) || 1;
  const defaultWorkers = num(e.workerCount) || 1;

  const html = `
    <div class="mb-3">
      <label class="form-label">Season <span class="text-danger">*</span></label>
      <select id="lb-season" class="form-select">
        <option value="">Select season…</option>
        ${seasonOptions}
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label">Date <span class="text-danger">*</span></label>
      <input id="lb-date" type="date" class="form-control" value="${e.date || today()}">
    </div>
    <div class="mb-3">
      <label class="form-label">Activity <span class="text-danger">*</span></label>
      <select id="lb-activity" class="form-select">
        <option value="">Select…</option>
        ${ACTIVITIES.map((a) => `<option value="${a}" ${e.activity===a?'selected':''}>${esc(a)}</option>`).join('')}
      </select>
    </div>
    <div class="row g-2 mb-3">
      <div class="col-4">
        <label class="form-label">Workers <span class="text-danger">*</span></label>
        <input id="lb-workers" type="number" min="1" step="1" class="form-control" value="${e.workerCount || defaultWorkers}">
      </div>
      <div class="col-4">
        <label class="form-label">Days</label>
        <input id="lb-days" type="number" min="0.5" step="0.5" class="form-control" value="${e.days || defaultDays}">
      </div>
      <div class="col-4">
        <label class="form-label">Rate/Day (Rs)</label>
        <input id="lb-wage" type="number" min="0" step="50" class="form-control" value="${e.dailyWage || defaultWage}">
      </div>
    </div>
    <div class="mb-3">
      <label class="form-label fw-semibold">Total Amount (Rs) <span class="text-danger">*</span></label>
      <input id="lb-total" type="number" min="0" step="any" class="form-control form-control-lg" value="${e.totalAmount || (defaultWorkers * defaultDays * defaultWage)}">
      <div class="form-text text-muted">Auto-calculated: Workers × Days × Rate. You can override it.</div>
    </div>
    <div class="mb-3">
      <label class="form-label">Supervisor / Contact Name</label>
      <input id="lb-sup" class="form-control" placeholder="Contractor or supervisor name" value="${esc(e.supervisorName || '')}">
    </div>
    <div class="mb-3">
      <label class="form-label">Notes</label>
      <input id="lb-notes" class="form-control" placeholder="Optional" value="${esc(e.notes || '')}">
    </div>`;

  const $dlg = await UI.formDialog(isEdit ? 'Edit Labor Entry' : 'Add Labor (Mazdoor)', html, { okLabel: isEdit ? 'Save' : 'Add' });

  // Wire up auto-calculation
  if ($('#lb-workers').length) {
    const calc = () => {
      const w = num($('#lb-workers').val()) || 0;
      const d = num($('#lb-days').val()) || 0;
      const r = num($('#lb-wage').val()) || 0;
      if (w > 0 && d > 0 && r > 0 && !$('#lb-total').data('manual')) {
        $('#lb-total').val((w * d * r).toFixed(0));
      }
    };
    $('#lb-workers, #lb-days, #lb-wage').on('input', calc);
    $('#lb-total').on('input', function () { $(this).data('manual', true); });
  }

  if (!$dlg) return null;

  const seasonId   = $('#lb-season').val();
  const activity   = $('#lb-activity').val();
  const totalAmount = num($('#lb-total').val());
  if (!seasonId || !activity || !totalAmount) { UI.toast('Season, activity and total amount are required.', 'danger'); return null; }

  const season = await idb.get('seasons', seasonId);
  const now = nowISO();
  const rec = {
    id:             isEdit ? e.id : uuid(),
    seasonId,
    farmId:         season?.farmId || '',
    date:           $('#lb-date').val() || today(),
    activity,
    workerCount:    num($('#lb-workers').val()) || 1,
    days:           num($('#lb-days').val()) || 1,
    dailyWage:      num($('#lb-wage').val()) || null,
    totalAmount,
    supervisorName: $('#lb-sup').val().trim(),
    notes:          $('#lb-notes').val().trim(),
    createdAt:      isEdit ? e.createdAt : now,
    updatedAt:      now,
  };
  await idb.put('laborEntries', rec);
  document.dispatchEvent(new CustomEvent('data:changed'));
  return rec;
}

function renderRow(e, seasons) {
  const s    = seasons.find((x) => x.id === e.seasonId);
  const crop = Catalog.crop(s?.cropId);
  return `
    <div class="list-group-item d-flex justify-content-between align-items-start labor-row" data-id="${e.id}">
      <div class="flex-grow-1 min-w-0 me-2">
        <div class="fw-semibold text-truncate">${esc(e.activity)}</div>
        <div class="text-muted small">
          ${e.date} · ${esc(crop?.name || '?')}
          · <span class="text-dark">${e.workerCount} workers × ${e.days} days</span>
          ${e.dailyWage ? ` @ Rs ${fmtNum(e.dailyWage)}/day` : ''}
        </div>
        ${e.supervisorName ? `<div class="text-muted small"><i class="bi bi-person me-1"></i>${esc(e.supervisorName)}</div>` : ''}
      </div>
      <div class="text-end text-nowrap ms-2">
        <div class="fw-bold text-danger">Rs ${fmtNum(e.totalAmount)}</div>
        <div class="btn-group btn-group-sm mt-1">
          <button class="btn btn-outline-secondary btn-edit-lb" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-outline-danger btn-del-lb" title="Delete"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    </div>`;
}

export default {
  async render(el, { params = [] } = {}) {
    this.destroy();
    $root = $(el);
    const urlParam = location.hash.split('?')[1] || '';
    const prefillSeasonId = new URLSearchParams(urlParam).get('season') || null;

    $root.html(UI.spinner());
    let [entries, seasons] = await Promise.all([idb.getAll('laborEntries'), idb.getAll('seasons')]);
    entries = entries.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    const displayList = prefillSeasonId ? entries.filter((e) => e.seasonId === prefillSeasonId) : entries;
    const totalAmt = displayList.reduce((s, e) => s + (e.totalAmount || 0), 0);
    const totalWorkerDays = displayList.reduce((s, e) => s + ((e.workerCount || 1) * (e.days || 1)), 0);

    const filterSeason = prefillSeasonId ? seasons.find((s) => s.id === prefillSeasonId) : null;
    const titleSuffix  = filterSeason ? ` — ${esc(Catalog.crop(filterSeason.cropId)?.name || '?')} ${filterSeason.year}` : '';

    $root.html(`
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0">Labor (Mazdoor)${titleSuffix}</h5>
        <button class="btn btn-success btn-add-lb"><i class="bi bi-plus-lg me-1"></i>Add Labor</button>
      </div>
      ${displayList.length ? `
        <div class="row g-2 mb-3">
          <div class="col-6"><div class="card text-center py-2"><div class="text-muted small">Total Cost</div><div class="fw-bold text-danger">Rs ${fmtNum(totalAmt)}</div></div></div>
          <div class="col-6"><div class="card text-center py-2"><div class="text-muted small">Worker-Days</div><div class="fw-bold">${fmtNum(totalWorkerDays)}</div></div></div>
        </div>
        <div class="list-group">${displayList.map((e) => renderRow(e, seasons)).join('')}</div>`
      : UI.emptyState('No labor records yet.', 'people')}`);

    $root.on('click', '.btn-add-lb', async () => {
      await openLaborModal(null, prefillSeasonId);
      this.render(el, { params });
    });
    $root.on('click', '.btn-edit-lb', async function () {
      const id = $(this).closest('.labor-row').data('id');
      const e  = await idb.get('laborEntries', id);
      await openLaborModal(e);
      this.render(el, { params });
    }.bind(this));
    $root.on('click', '.btn-del-lb', async function () {
      const id = $(this).closest('.labor-row').data('id');
      const e  = await idb.get('laborEntries', id);
      if (!e || !await UI.confirmDialog(`Delete labor entry (Rs ${fmtNum(e.totalAmount)})?`, { okLabel: 'Delete', okClass: 'btn-danger' })) return;
      await idb.delete('laborEntries', id);
      this.render(el, { params });
    }.bind(this));
  },
  destroy() { $root?.off(); $root = null; },
};
