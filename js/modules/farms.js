// Farms & Plots management — #/farms
import * as idb from '../db/idb.js';
import * as UI from '../core/ui.js';
import { esc, uuid, nowISO, lc, debounce } from '../core/utils.js';
import { getSettings } from '../core/settings.js';
import * as Catalog from '../services/farmCatalog.js';
import { areaUnitLabel, AREA_UNITS } from '../core/units.js';

const $ = window.jQuery;
let $root;

// ── Helpers ──────────────────────────────────────────────
function fmtArea(acres, kanals) {
  if (acres) return `${acres} Acres`;
  if (kanals) return `${kanals} Kanals`;
  return '—';
}
function irrigationIcon(type) {
  const icons = { tubewell: 'droplet-fill', canal: 'water', drip: 'moisture', rain: 'cloud-rain', other: 'circle' };
  return icons[type] || 'droplet';
}

// ── Farm form modal ──────────────────────────────────────
async function openFarmModal(existing = null) {
  const isEdit = !!existing;
  const title  = isEdit ? 'Edit Farm' : 'Add Farm';
  const f      = existing || {};

  const html = `
    <div class="mb-3">
      <label class="form-label">Farm Name <span class="text-danger">*</span></label>
      <input id="fm-name" class="form-control" placeholder="e.g. Chak 45 Farm" value="${esc(f.name || '')}">
    </div>
    <div class="row g-2 mb-3">
      <div class="col-6">
        <label class="form-label">Total Acres</label>
        <input id="fm-acres" type="number" min="0" step="0.25" class="form-control" placeholder="0" value="${f.acres || ''}">
      </div>
      <div class="col-6">
        <label class="form-label">Or Kanals</label>
        <input id="fm-kanals" type="number" min="0" step="1" class="form-control" placeholder="0" value="${f.kanals || ''}">
      </div>
    </div>
    <div class="mb-3">
      <label class="form-label">Village / Location</label>
      <input id="fm-location" class="form-control" placeholder="Village, Tehsil, District" value="${esc(f.location || '')}">
    </div>
    <div class="mb-3">
      <label class="form-label">Irrigation Type</label>
      <select id="fm-irrigation" class="form-select">
        <option value="">Select…</option>
        ${[['tubewell','Tubewell (ٹیوب ویل)'],['canal','Canal (نہر)'],['drip','Drip / Sprinkler'],['rain','Rain-fed'],['other','Other']].map(([v,l]) => `<option value="${v}" ${f.irrigationType===v?'selected':''}>${l}</option>`).join('')}
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label">Notes</label>
      <textarea id="fm-notes" class="form-control" rows="2" placeholder="Optional notes">${esc(f.notes || '')}</textarea>
    </div>`;

  const result = await UI.formDialog(title, html, { okLabel: isEdit ? 'Save Changes' : 'Add Farm' });
  if (!result) return null;

  const name = $('#fm-name').val().trim();
  if (!name) { UI.toast('Farm name is required.', 'danger'); return null; }

  const now = nowISO();
  const rec = {
    id:            isEdit ? f.id : uuid(),
    name,          nameLc: lc(name),
    acres:         parseFloat($('#fm-acres').val()) || null,
    kanals:        parseFloat($('#fm-kanals').val()) || null,
    location:      $('#fm-location').val().trim(),
    irrigationType:$('#fm-irrigation').val(),
    notes:         $('#fm-notes').val().trim(),
    active:        1,
    createdAt:     isEdit ? f.createdAt : now,
    updatedAt:     now,
  };
  await idb.put('farms', rec);
  await Catalog.refreshFarm(rec.id);
  document.dispatchEvent(new CustomEvent('data:changed'));
  return rec;
}

// ── Plot form modal ──────────────────────────────────────
async function openPlotModal(farmId, existing = null) {
  const isEdit = !!existing;
  const p      = existing || {};
  const farm   = Catalog.farm(farmId);

  const html = `
    <div class="mb-3">
      <label class="form-label small text-muted">Farm</label>
      <div class="fw-semibold">${esc(farm?.name || '')}</div>
    </div>
    <div class="mb-3">
      <label class="form-label">Plot / Field Name <span class="text-danger">*</span></label>
      <input id="pl-name" class="form-control" placeholder="e.g. North Field, Kharif Plot 1" value="${esc(p.name || '')}">
    </div>
    <div class="row g-2 mb-3">
      <div class="col-6">
        <label class="form-label">Acres</label>
        <input id="pl-acres" type="number" min="0" step="0.125" class="form-control" placeholder="0" value="${p.acres || ''}">
      </div>
      <div class="col-6">
        <label class="form-label">Or Kanals</label>
        <input id="pl-kanals" type="number" min="0" step="1" class="form-control" placeholder="0" value="${p.kanals || ''}">
      </div>
    </div>
    <div class="mb-3">
      <label class="form-label">Soil Type</label>
      <select id="pl-soil" class="form-select">
        <option value="">Select…</option>
        ${[['loamy','Loamy (زرخیز مٹی)'],['sandy','Sandy (ریتلی)'],['clay','Clay (چکنی مٹی)'],['silty','Silty'],['saline','Saline (کلر)'],['other','Other']].map(([v,l]) => `<option value="${v}" ${p.soilType===v?'selected':''}>${l}</option>`).join('')}
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label">Notes</label>
      <textarea id="pl-notes" class="form-control" rows="2" placeholder="Optional notes">${esc(p.notes || '')}</textarea>
    </div>`;

  const result = await UI.formDialog(isEdit ? 'Edit Plot' : 'Add Plot', html, { okLabel: isEdit ? 'Save Changes' : 'Add Plot' });
  if (!result) return null;

  const name = $('#pl-name').val().trim();
  if (!name) { UI.toast('Plot name is required.', 'danger'); return null; }

  const now = nowISO();
  const rec = {
    id:        isEdit ? p.id : uuid(),
    farmId,
    name,      nameLc: lc(name),
    acres:     parseFloat($('#pl-acres').val()) || null,
    kanals:    parseFloat($('#pl-kanals').val()) || null,
    soilType:  $('#pl-soil').val(),
    notes:     $('#pl-notes').val().trim(),
    active:    1,
    createdAt: isEdit ? p.createdAt : now,
    updatedAt: now,
  };
  await idb.put('plots', rec);
  await Catalog.refreshPlot(rec.id);
  document.dispatchEvent(new CustomEvent('data:changed'));
  return rec;
}

// ── Main render ──────────────────────────────────────────
async function renderFarmCard(farm) {
  const plots = Catalog.plotsFor(farm.id);
  const plotsHtml = plots.length
    ? plots.map((p) => `
        <div class="d-flex align-items-center justify-content-between py-2 border-top plot-row" data-plot-id="${p.id}" data-farm-id="${farm.id}">
          <div>
            <span class="fw-semibold">${esc(p.name)}</span>
            ${p.acres || p.kanals ? `<span class="text-muted small ms-2">${fmtArea(p.acres, p.kanals)}</span>` : ''}
            ${p.soilType ? `<span class="badge bg-secondary-subtle text-secondary ms-2 small">${esc(p.soilType)}</span>` : ''}
          </div>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary btn-edit-plot" title="Edit plot"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-outline-danger btn-del-plot" title="Delete plot"><i class="bi bi-trash"></i></button>
          </div>
        </div>`).join('')
    : '<div class="text-muted small py-2 border-top">No plots yet — add your first plot.</div>';

  return `
    <div class="card mb-3 farm-card" data-farm-id="${farm.id}">
      <div class="card-body">
        <div class="d-flex align-items-start justify-content-between mb-1">
          <div>
            <h6 class="card-title mb-0 fw-bold">${esc(farm.name)}</h6>
            ${farm.location ? `<div class="text-muted small"><i class="bi bi-geo-alt me-1"></i>${esc(farm.location)}</div>` : ''}
          </div>
          <div class="d-flex gap-2 align-items-center">
            ${farm.acres || farm.kanals ? `<span class="badge bg-success-subtle text-success">${fmtArea(farm.acres, farm.kanals)}</span>` : ''}
            ${farm.irrigationType ? `<span class="badge bg-info-subtle text-info"><i class="bi bi-${irrigationIcon(farm.irrigationType)} me-1"></i>${esc(farm.irrigationType)}</span>` : ''}
            <div class="dropdown">
              <button class="btn btn-sm btn-light" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical"></i></button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li><button class="dropdown-item btn-edit-farm"><i class="bi bi-pencil me-2"></i>Edit Farm</button></li>
                <li><button class="dropdown-item btn-add-plot text-success"><i class="bi bi-plus-circle me-2"></i>Add Plot</button></li>
                <li><hr class="dropdown-divider"></li>
                <li><button class="dropdown-item text-danger btn-del-farm"><i class="bi bi-trash me-2"></i>Delete Farm</button></li>
              </ul>
            </div>
          </div>
        </div>
        <div class="mt-2">${plotsHtml}</div>
      </div>
    </div>`;
}

export default {
  async render(el) {
    this.destroy();
    $root = $(el);
    $root.html(UI.spinner());

    const farms = Catalog.allFarmsRaw();

    if (!farms.length) {
      $root.html(`
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="mb-0">Farms &amp; Plots</h5>
          <button class="btn btn-success btn-add-farm"><i class="bi bi-plus-lg me-1"></i>Add Farm</button>
        </div>
        ${UI.emptyState('No farms yet.\nAdd your first farm to get started.', 'geo-alt')}`);
    } else {
      const cards = await Promise.all(farms.map(renderFarmCard));
      $root.html(`
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="mb-0">Farms &amp; Plots <span class="badge bg-secondary ms-1">${farms.length}</span></h5>
          <button class="btn btn-success btn-add-farm"><i class="bi bi-plus-lg me-1"></i>Add Farm</button>
        </div>
        ${cards.join('')}`);
    }

    // ── Event delegation ─────────────────────────────────
    $root.on('click', '.btn-add-farm', async () => {
      const rec = await openFarmModal();
      if (rec) this.render(el);
    });

    $root.on('click', '.btn-edit-farm', async function () {
      const farmId = $(this).closest('.farm-card').data('farm-id');
      const rec = await openFarmModal(Catalog.farm(farmId));
      if (rec) this.render(el);
    }.bind(this));

    $root.on('click', '.btn-del-farm', async function () {
      const farmId = $(this).closest('.farm-card').data('farm-id');
      const farm = Catalog.farm(farmId);
      if (!farm) return;
      const hasSeasonsOrPlots = Catalog.plotsFor(farmId).length > 0;
      const msg = hasSeasonsOrPlots
        ? `Delete farm "${farm.name}"? This will also remove all its plots. Existing season records will still reference this farm by name.`
        : `Delete farm "${farm.name}"?`;
      if (!await UI.confirmDialog(msg, { okLabel: 'Delete', okClass: 'btn-danger' })) return;
      const allPlots = Catalog.plotsFor(farmId);
      await idb.write(['farms', 'plots'], (t) => {
        t.delete('farms', farmId);
        allPlots.forEach((p) => t.delete('plots', p.id));
      });
      await Catalog.refreshFarm(farmId);
      allPlots.forEach((p) => Catalog.refreshPlot(p.id));
      this.render(el);
    }.bind(this));

    $root.on('click', '.btn-add-plot', async function () {
      const farmId = $(this).closest('.farm-card').data('farm-id');
      const rec = await openPlotModal(farmId);
      if (rec) this.render(el);
    }.bind(this));

    $root.on('click', '.btn-edit-plot', async function () {
      const $row  = $(this).closest('.plot-row');
      const plotId = $row.data('plot-id');
      const farmId = $row.data('farm-id');
      const rec = await openPlotModal(farmId, Catalog.plot(plotId));
      if (rec) this.render(el);
    }.bind(this));

    $root.on('click', '.btn-del-plot', async function () {
      const plotId = $(this).closest('.plot-row').data('plot-id');
      const plot = Catalog.plot(plotId);
      if (!plot) return;
      if (!await UI.confirmDialog(`Delete plot "${plot.name}"? Existing season records will still reference this plot by name.`, { okLabel: 'Delete', okClass: 'btn-danger' })) return;
      await idb.delete('plots', plotId);
      await Catalog.refreshPlot(plotId);
      this.render(el);
    }.bind(this));
  },

  destroy() { $root?.off(); $root = null; },
};
