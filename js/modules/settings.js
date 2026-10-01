// KisanBook Settings — farm profile, units, crops, theme, account
import { CONFIG } from '../config.js';
import * as UI from '../core/ui.js';
import { esc, uuid, nowISO, fmtDateTime } from '../core/utils.js';
import { getSettings, saveSettings, pref } from '../core/settings.js';
import * as Auth from '../services/auth.js';
import * as idb from '../db/idb.js';
import * as Catalog from '../services/farmCatalog.js';
import { WEIGHT_UNITS, AREA_UNITS, weightUnitLabel, areaUnitLabel } from '../core/units.js';

const $ = window.jQuery;
let $el;

function section(title, icon, body) {
  return `<div class="card mb-3"><div class="card-body"><h2 class="h6 mb-3"><i class="bi bi-${icon} me-2"></i>${title}</h2>${body}</div></div>`;
}

function unitOptions(units, selected) {
  return units.map((u) => `<option value="${u.id}" ${u.id === selected ? 'selected' : ''}>${u.label}</option>`).join('');
}

// ── Crop Management ──────────────────────────────────────
async function openCropModal(existing = null) {
  const isEdit = !!existing;
  const c = existing || {};
  const html = `
    <div class="mb-3">
      <label class="form-label">Crop Name (English) <span class="text-danger">*</span></label>
      <input id="cr-name" class="form-control" placeholder="e.g. Wheat" value="${esc(c.name || '')}">
    </div>
    <div class="mb-3">
      <label class="form-label">Name in Urdu / Local language</label>
      <input id="cr-urdu" class="form-control" placeholder="گندم" value="${esc(c.urdu || '')}" dir="auto">
    </div>
    <div class="mb-3">
      <label class="form-label">Season</label>
      <select id="cr-season" class="form-select">
        <option value="kharif" ${(c.season || '') === 'kharif' ? 'selected' : ''}>Kharif (Summer — خریف)</option>
        <option value="rabi"   ${(c.season || '') === 'rabi'   ? 'selected' : ''}>Rabi (Winter — ربیع)</option>
        <option value="both"   ${(c.season || 'both') === 'both' ? 'selected' : ''}>Both seasons</option>
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label">Typical Yield (Maunds/Acre)</label>
      <input id="cr-yield" type="number" min="0" step="1" class="form-control" placeholder="e.g. 35" value="${c.yieldPerAcre || ''}">
    </div>`;

  const ok = await UI.formDialog(isEdit ? 'Edit Crop' : 'Add Crop', html, { okLabel: isEdit ? 'Save' : 'Add Crop' });
  if (!ok) return null;

  const name = $('#cr-name').val().trim();
  if (!name) { UI.toast('Crop name is required.', 'danger'); return null; }

  const now = nowISO();
  const rec = {
    id:           isEdit ? c.id : uuid(),
    name,
    urdu:         $('#cr-urdu').val().trim(),
    season:       $('#cr-season').val(),
    yieldPerAcre: parseFloat($('#cr-yield').val()) || null,
    active:       1,
    createdAt:    isEdit ? c.createdAt : now,
    updatedAt:    now,
  };
  await idb.put('crops', rec);
  await Catalog.refreshCrop(rec.id);
  document.dispatchEvent(new CustomEvent('data:changed'));
  return rec;
}

// ── Main render ──────────────────────────────────────────
export default {
  async render(el) {
    $el = $(el);
    const s = getSettings();
    const u = Auth.user();
    const manage = Auth.can('settings.manage');
    const ro = manage ? '' : 'disabled';

    const renderCrops = async () => {
      const crops = Catalog.allCrops();
      return `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="small text-muted">${crops.length} crops configured</span>
          <button class="btn btn-sm btn-success btn-add-crop"><i class="bi bi-plus-lg me-1"></i>Add Crop</button>
        </div>
        <div class="list-group list-group-flush" id="crops-list">
          ${crops.map((c) => `
            <div class="list-group-item d-flex justify-content-between align-items-center crop-item" data-id="${c.id}">
              <div>
                <span class="fw-semibold">${esc(c.name)}</span>
                ${c.urdu ? `<span class="text-muted ms-2 small" dir="rtl">${esc(c.urdu)}</span>` : ''}
                <span class="badge bg-secondary-subtle text-secondary ms-2 small">${c.season || 'both'}</span>
              </div>
              <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-secondary btn-edit-crop" title="Edit"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-outline-danger btn-del-crop" title="Delete"><i class="bi bi-trash"></i></button>
              </div>
            </div>`).join('')}
        </div>`;
    };

    const cropsHtml = await renderCrops();

    $el.html(`
      <h5 class="mb-3">Settings</h5>
      <div class="row g-3">
        <div class="col-lg-6">
          ${section('Farm Information', 'geo-alt', `
            <form class="f-farm row g-2">
              <div class="col-12"><label class="form-label">Farm / Operation Name</label>
                <input name="farmName" class="form-control" value="${esc(s.farm.name)}" placeholder="My Farm" ${ro}></div>
              <div class="col-12"><label class="form-label">Owner Name</label>
                <input name="ownerName" class="form-control" value="${esc(s.farm.ownerName || '')}" placeholder="Malik Sahib" ${ro}></div>
              <div class="col-12"><label class="form-label">Address</label>
                <input name="address" class="form-control" value="${esc(s.farm.address || '')}" placeholder="Village / Mauza" ${ro}></div>
              <div class="col-6"><label class="form-label">District</label>
                <input name="district" class="form-control" value="${esc(s.farm.district || '')}" placeholder="Faisalabad" ${ro}></div>
              <div class="col-6"><label class="form-label">Tehsil</label>
                <input name="tehsil" class="form-control" value="${esc(s.farm.tehsil || '')}" ${ro}></div>
              <div class="col-6"><label class="form-label">Phone</label>
                <input name="phone" type="tel" class="form-control" value="${esc(s.farm.phone || '')}" placeholder="03xx…" ${ro}></div>
              ${manage ? '<div class="col-12"><button class="btn btn-primary">Save</button></div>' : ''}
            </form>`)}

          ${section('Units & Measurements', 'rulers', `
            <form class="f-units row g-2">
              <div class="col-6"><label class="form-label">Default Weight Unit</label>
                <select name="defaultWeightUnit" class="form-select">
                  ${unitOptions(WEIGHT_UNITS, s.defaultWeightUnit)}
                </select></div>
              <div class="col-6"><label class="form-label">Default Area Unit</label>
                <select name="defaultAreaUnit" class="form-select">
                  ${unitOptions(AREA_UNITS, s.defaultAreaUnit)}
                </select></div>
              <div class="col-6"><label class="form-label">Currency Symbol</label>
                <input name="currency" class="form-control" maxlength="5" value="${esc(s.currency)}"></div>
              ${manage ? '<div class="col-12"><button class="btn btn-primary">Save</button></div>' : ''}
            </form>`)}

          ${section('Appearance', 'palette', `
            <label class="form-label">Theme</label>
            <select class="form-select f-theme">
              <option value="auto"  ${s.theme === 'auto'  ? 'selected' : ''}>Follow device</option>
              <option value="light" ${s.theme === 'light' ? 'selected' : ''}>Light</option>
              <option value="dark"  ${s.theme === 'dark'  ? 'selected' : ''}>Dark</option>
            </select>`)}
        </div>

        <div class="col-lg-6">
          ${section('Crop List', 'flower1', cropsHtml)}

          ${section('WhatsApp Contact', 'whatsapp', `
            <form class="f-whatsapp row g-2">
              <div class="col-4"><label class="form-label">Country Code</label>
                <div class="input-group"><span class="input-group-text">+</span>
                <input name="countryCode" class="form-control" maxlength="4" value="${esc(s.whatsapp?.countryCode || '92')}"></div></div>
              <div class="col-8"><label class="form-label">Your WhatsApp Number</label>
                <input name="ownerPhone" type="tel" class="form-control" placeholder="03xx…" value="${esc(s.whatsapp?.ownerPhone || '')}"></div>
              ${manage ? '<div class="col-12"><button class="btn btn-primary">Save</button></div>' : ''}
            </form>`)}

          ${section('Account', 'person-badge', `
            <div class="mb-2">
              <div class="fw-semibold">${esc(u?.name || u?.username || '—')}</div>
              <div class="text-muted small">${esc(u?.role || '')} · ${esc(u?.username || '')}</div>
            </div>
            <div class="text-muted small mb-1">App version: ${CONFIG.APP_VERSION}</div>
            <div class="text-muted small">Data is stored locally on this device only. KisanBook works offline.</div>`)}
        </div>
      </div>`);

    // ── Form handlers ────────────────────────────────────
    $el.find('.f-farm').on('submit', (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const ns = getSettings();
      ns.farm = { ...ns.farm, name: f.farmName, ownerName: f.ownerName, address: f.address, district: f.district, tehsil: f.tehsil, phone: f.phone };
      saveSettings(ns);
      document.dispatchEvent(new CustomEvent('settings:changed'));
      UI.toast('Farm info saved.');
    });

    $el.find('.f-units').on('submit', (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const ns = getSettings();
      ns.defaultWeightUnit = f.defaultWeightUnit;
      ns.defaultAreaUnit   = f.defaultAreaUnit;
      ns.currency          = f.currency || 'Rs';
      saveSettings(ns);
      UI.toast('Units saved.');
    });

    $el.find('.f-whatsapp').on('submit', (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const ns = getSettings();
      ns.whatsapp = { countryCode: f.countryCode || '92', ownerPhone: f.ownerPhone };
      saveSettings(ns);
      UI.toast('WhatsApp settings saved.');
    });

    $el.find('.f-theme').on('change', function () {
      const val = $(this).val();
      const ns = getSettings();
      ns.theme = val;
      saveSettings(ns);
      document.documentElement.setAttribute('data-bs-theme', val === 'auto'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : val);
      UI.toast('Theme updated.');
    });

    // ── Crop CRUD ────────────────────────────────────────
    $el.on('click', '.btn-add-crop', async () => {
      await openCropModal();
      this.render(el);
    });
    $el.on('click', '.btn-edit-crop', async function () {
      const id = $(this).closest('.crop-item').data('id');
      const c  = Catalog.crop(id);
      await openCropModal(c);
      this.render(el);
    }.bind(this));
    $el.on('click', '.btn-del-crop', async function () {
      const id = $(this).closest('.crop-item').data('id');
      const c  = Catalog.crop(id);
      if (!c || !await UI.confirmDialog(`Delete crop "${c.name}"?\nSeasons linked to this crop will lose the crop reference.`, { okLabel: 'Delete', okClass: 'btn-danger' })) return;
      await idb.delete('crops', id);
      await Catalog.refreshCrop(id);
      this.render(el);
    }.bind(this));
  },

  destroy() { $el?.off(); $el = null; },
};
