// Harvest Recording — #/harvest
import * as idb from '../db/idb.js';
import * as UI from '../core/ui.js';
import { esc, uuid, nowISO, today, fmtNum, num } from '../core/utils.js';
import * as Catalog from '../services/farmCatalog.js';
import { WEIGHT_UNITS, weightUnitLabel } from '../core/units.js';

const $ = window.jQuery;
let $root;

const GRADES = ['A — Premium', 'B — Standard', 'C — Below Average', 'Mixed / Unsorted'];

async function openHarvestModal(existing = null, prefillSeasonId = null) {
  const isEdit = !!existing;
  const h      = existing || {};
  const seasons = (await idb.getAll('seasons'))
    .sort((a, b) => b.year - a.year || (b.createdAt || '').localeCompare(a.createdAt || ''));

  const seasonOptions = seasons.map((s) => {
    const crop = Catalog.crop(s.cropId);
    const plot = Catalog.plot(s.plotId);
    const farm = Catalog.farm(s.farmId);
    const label = `${crop?.name || '?'} — ${farm?.name || '?'} › ${plot?.name || '?'} (${s.year})`;
    const selected = (h.seasonId || prefillSeasonId) === s.id ? 'selected' : '';
    return `<option value="${s.id}" ${selected}>${esc(label)}</option>`;
  }).join('');

  const html = `
    <div class="mb-3">
      <label class="form-label">Season <span class="text-danger">*</span></label>
      <select id="hv-season" class="form-select">
        <option value="">Select season…</option>
        ${seasonOptions}
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label">Harvest Date <span class="text-danger">*</span></label>
      <input id="hv-date" type="date" class="form-control" value="${h.date || today()}">
    </div>
    <div class="row g-2 mb-3">
      <div class="col-7">
        <label class="form-label">Quantity <span class="text-danger">*</span></label>
        <input id="hv-qty" type="number" min="0" step="any" class="form-control" placeholder="0" value="${h.quantity || ''}">
      </div>
      <div class="col-5">
        <label class="form-label">Unit <span class="text-danger">*</span></label>
        <select id="hv-unit" class="form-select">
          ${WEIGHT_UNITS.map((u) => `<option value="${u.id}" ${(h.unit||'maund')===u.id?'selected':''}>${u.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="mb-3">
      <label class="form-label">Grade / Quality</label>
      <select id="hv-grade" class="form-select">
        <option value="">Not specified</option>
        ${GRADES.map((g) => `<option value="${g}" ${h.grade===g?'selected':''}>${esc(g)}</option>`).join('')}
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label">Moisture % <span class="text-muted small">(optional)</span></label>
      <input id="hv-moisture" type="number" min="0" max="100" step="0.1" class="form-control" placeholder="e.g. 14" value="${h.moisture || ''}">
    </div>
    <div class="mb-3">
      <label class="form-label">Storage Location</label>
      <input id="hv-storage" class="form-control" placeholder="Where is it stored?" value="${esc(h.storage || '')}">
    </div>
    <div class="mb-3">
      <label class="form-label">Notes</label>
      <textarea id="hv-notes" class="form-control" rows="2" placeholder="Optional">${esc(h.notes || '')}</textarea>
    </div>`;

  const $dlg = await UI.formDialog(isEdit ? 'Edit Harvest' : 'Record Harvest', html, { okLabel: isEdit ? 'Save' : 'Record Harvest' });
  if (!$dlg) return null;

  const seasonId = $('#hv-season').val();
  const qty      = num($('#hv-qty').val());
  if (!seasonId || !qty) { UI.toast('Season and quantity are required.', 'danger'); return null; }

  const season = await idb.get('seasons', seasonId);
  const now = nowISO();
  const rec = {
    id:        isEdit ? h.id : uuid(),
    seasonId,
    plotId:    season?.plotId  || '',
    farmId:    season?.farmId  || '',
    date:      $('#hv-date').val() || today(),
    quantity:  qty,
    unit:      $('#hv-unit').val() || 'maund',
    grade:     $('#hv-grade').val() || null,
    moisture:  num($('#hv-moisture').val()) || null,
    storage:   $('#hv-storage').val().trim(),
    notes:     $('#hv-notes').val().trim(),
    createdAt: isEdit ? h.createdAt : now,
    updatedAt: now,
  };
  await idb.put('harvests', rec);

  // Auto-advance season status if it was "growing"
  if (season?.status === 'growing') {
    await idb.put('seasons', { ...season, status: 'harvested', updatedAt: now });
  }

  document.dispatchEvent(new CustomEvent('data:changed'));
  return rec;
}

function renderRow(h, seasons) {
  const s    = seasons.find((x) => x.id === h.seasonId);
  const crop = Catalog.crop(s?.cropId);
  const farm = Catalog.farm(h.farmId);
  return `
    <div class="list-group-item d-flex justify-content-between align-items-start harvest-row" data-id="${h.id}">
      <div class="flex-grow-1 min-w-0 me-2">
        <div class="d-flex align-items-center gap-2">
          <span class="fs-5">🌾</span>
          <span class="fw-semibold">${fmtNum(h.quantity)} ${weightUnitLabel(h.unit)}</span>
          ${h.grade ? `<span class="badge bg-info-subtle text-info small">${esc(h.grade.split('—')[0].trim())}</span>` : ''}
        </div>
        <div class="text-muted small">
          ${h.date} · ${esc(crop?.name || '?')} · ${esc(farm?.name || '?')}
          ${h.moisture ? ` · ${h.moisture}% moisture` : ''}
          ${h.storage ? ` · ${esc(h.storage)}` : ''}
        </div>
      </div>
      <div class="btn-group btn-group-sm ms-2">
        <button class="btn btn-outline-secondary btn-edit-hv" title="Edit"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-outline-danger btn-del-hv" title="Delete"><i class="bi bi-trash"></i></button>
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
    let [harvests, seasons] = await Promise.all([idb.getAll('harvests'), idb.getAll('seasons')]);
    harvests = harvests.sort((a, b) => b.date.localeCompare(a.date));
    const displayList = prefillSeasonId ? harvests.filter((h) => h.seasonId === prefillSeasonId) : harvests;
    const filterSeason = prefillSeasonId ? seasons.find((s) => s.id === prefillSeasonId) : null;
    const titleSuffix  = filterSeason ? ` — ${esc(Catalog.crop(filterSeason.cropId)?.name || '?')} ${filterSeason.year}` : '';
    const totalMaunds  = displayList.reduce((s, h) => s + (h.unit === 'maund' ? (h.quantity || 0) : 0), 0);

    $root.html(`
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0">Harvest${titleSuffix}</h5>
        <button class="btn btn-success btn-add-hv"><i class="bi bi-plus-lg me-1"></i>Record Harvest</button>
      </div>
      ${displayList.length ? `
        ${totalMaunds > 0 ? `<div class="card mb-3 text-center py-3"><div class="text-muted small">Total (Maunds)</div><div class="fw-bold fs-4">🌾 ${fmtNum(totalMaunds)} Maund</div></div>` : ''}
        <div class="list-group">${displayList.map((h) => renderRow(h, seasons)).join('')}</div>`
      : UI.emptyState('No harvest recorded yet.', 'basket2')}`);

    $root.on('click', '.btn-add-hv', async () => {
      await openHarvestModal(null, prefillSeasonId);
      this.render(el, { params });
    });
    $root.on('click', '.btn-edit-hv', async function () {
      const id = $(this).closest('.harvest-row').data('id');
      const h  = await idb.get('harvests', id);
      await openHarvestModal(h);
      this.render(el, { params });
    }.bind(this));
    $root.on('click', '.btn-del-hv', async function () {
      const id = $(this).closest('.harvest-row').data('id');
      const h  = await idb.get('harvests', id);
      if (!h || !await UI.confirmDialog(`Delete harvest record (${h.quantity} ${weightUnitLabel(h.unit)})?`, { okLabel: 'Delete', okClass: 'btn-danger' })) return;
      await idb.delete('harvests', id);
      this.render(el, { params });
    }.bind(this));
  },
  destroy() { $root?.off(); $root = null; },
};
