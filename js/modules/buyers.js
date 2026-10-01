// Buyers management — #/buyers  (Arhtiya, traders, mills, direct buyers)
import * as idb from '../db/idb.js';
import * as UI from '../core/ui.js';
import { esc, uuid, nowISO, lc, fmtNum } from '../core/utils.js';
import { BUYER_TYPES } from '../db/schema.js';
import * as Catalog from '../services/farmCatalog.js';

const $ = window.jQuery;
let $root;

const typeMap = Object.fromEntries(BUYER_TYPES.map((t) => [t.id, t.label]));

async function openBuyerModal(existing = null) {
  const isEdit = !!existing;
  const b      = existing || {};

  const html = `
    <div class="mb-3">
      <label class="form-label">Buyer Name <span class="text-danger">*</span></label>
      <input id="by-name" class="form-control" placeholder="Full name or company" value="${esc(b.name || '')}">
    </div>
    <div class="mb-3">
      <label class="form-label">Type</label>
      <select id="by-type" class="form-select">
        <option value="">Select…</option>
        ${BUYER_TYPES.map((t) => `<option value="${t.id}" ${b.type===t.id?'selected':''}>${esc(t.label)}</option>`).join('')}
      </select>
    </div>
    <div class="row g-2 mb-3">
      <div class="col-6">
        <label class="form-label">Phone</label>
        <input id="by-phone" type="tel" class="form-control" placeholder="03xx…" value="${esc(b.phone || '')}">
      </div>
      <div class="col-6">
        <label class="form-label">WhatsApp</label>
        <input id="by-wa" type="tel" class="form-control" placeholder="03xx… (if different)" value="${esc(b.whatsapp || '')}">
      </div>
    </div>
    <div class="mb-3">
      <label class="form-label">City / Area</label>
      <input id="by-city" class="form-control" placeholder="City or mandi location" value="${esc(b.city || '')}">
    </div>
    <div class="mb-3">
      <label class="form-label">Address</label>
      <textarea id="by-addr" class="form-control" rows="2" placeholder="Optional full address">${esc(b.address || '')}</textarea>
    </div>
    <div class="mb-3">
      <label class="form-label">Default Commission % <span class="text-muted small">(for Arhtiya)</span></label>
      <input id="by-comm" type="number" min="0" max="100" step="0.5" class="form-control" placeholder="e.g. 2.5" value="${b.commissionRate || ''}">
    </div>
    <div class="mb-3">
      <label class="form-label">Notes</label>
      <textarea id="by-notes" class="form-control" rows="2">${esc(b.notes || '')}</textarea>
    </div>`;

  const result = await UI.formDialog(isEdit ? 'Edit Buyer' : 'Add Buyer', html, { okLabel: isEdit ? 'Save' : 'Add Buyer' });
  if (!result) return null;

  const name = $('#by-name').val().trim();
  if (!name) { UI.toast('Buyer name is required.', 'danger'); return null; }

  const now = nowISO();
  const rec = {
    id:             isEdit ? b.id : uuid(),
    name,           nameLc: lc(name),
    type:           $('#by-type').val() || null,
    phone:          $('#by-phone').val().trim(),
    whatsapp:       $('#by-wa').val().trim(),
    city:           $('#by-city').val().trim(),
    address:        $('#by-addr').val().trim(),
    commissionRate: parseFloat($('#by-comm').val()) || null,
    notes:          $('#by-notes').val().trim(),
    active:         1,
    createdAt:      isEdit ? b.createdAt : now,
    updatedAt:      now,
  };
  await idb.put('buyers', rec);
  await Catalog.refreshBuyer(rec.id);
  document.dispatchEvent(new CustomEvent('data:changed'));
  return rec;
}

function renderCard(b) {
  const typeLabel = typeMap[b.type] || '';
  const waHref    = b.whatsapp
    ? `https://wa.me/92${b.whatsapp.replace(/^0/, '')}`
    : b.phone ? `https://wa.me/92${b.phone.replace(/^0/, '')}` : '';

  return `
    <div class="card mb-2 buyer-card" data-id="${b.id}">
      <div class="card-body py-2 px-3">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div class="fw-semibold">${esc(b.name)}</div>
            ${typeLabel ? `<span class="badge bg-secondary-subtle text-secondary small">${esc(typeLabel)}</span>` : ''}
            ${b.city ? `<span class="text-muted small ms-2"><i class="bi bi-geo-alt me-1"></i>${esc(b.city)}</span>` : ''}
          </div>
          <div class="dropdown">
            <button class="btn btn-sm btn-light" data-bs-toggle="dropdown"><i class="bi bi-three-dots-vertical"></i></button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><button class="dropdown-item btn-edit-buyer"><i class="bi bi-pencil me-2"></i>Edit</button></li>
              <li><hr class="dropdown-divider"></li>
              <li><button class="dropdown-item text-danger btn-del-buyer"><i class="bi bi-trash me-2"></i>Delete</button></li>
            </ul>
          </div>
        </div>
        <div class="mt-1 d-flex gap-3 flex-wrap">
          ${b.phone ? `<a href="tel:${b.phone}" class="text-muted small text-decoration-none"><i class="bi bi-telephone me-1"></i>${esc(b.phone)}</a>` : ''}
          ${waHref  ? `<a href="${waHref}" target="_blank" rel="noopener" class="text-success small text-decoration-none"><i class="bi bi-whatsapp me-1"></i>WhatsApp</a>` : ''}
          ${b.commissionRate ? `<span class="text-muted small"><i class="bi bi-percent me-1"></i>${b.commissionRate}% commission</span>` : ''}
        </div>
      </div>
    </div>`;
}

export default {
  async render(el) {
    this.destroy();
    $root = $(el);
    $root.html(UI.spinner());

    const buyers = Catalog.allBuyers();

    let filterHtml = '';
    if (buyers.length) {
      const typeGroups = {};
      buyers.forEach((b) => {
        const t = b.type || 'other';
        if (!typeGroups[t]) typeGroups[t] = [];
        typeGroups[t].push(b);
      });
      filterHtml = Object.entries(typeGroups).map(([typeId, list]) => `
        <div class="mb-3">
          <div class="text-muted small fw-semibold text-uppercase letter-spacing mb-2">${esc(typeMap[typeId] || typeId)}</div>
          ${list.map(renderCard).join('')}
        </div>`).join('');
    }

    $root.html(`
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0">Buyers <span class="badge bg-secondary ms-1">${buyers.length}</span></h5>
        <button class="btn btn-success btn-add-buyer"><i class="bi bi-plus-lg me-1"></i>Add Buyer</button>
      </div>
      ${buyers.length ? filterHtml : UI.emptyState('No buyers yet.\nAdd the traders and agents you sell your crops to.', 'person-lines-fill')}`);

    $root.on('click', '.btn-add-buyer', async () => {
      await openBuyerModal();
      this.render(el);
    });
    $root.on('click', '.btn-edit-buyer', async function () {
      const id = $(this).closest('.buyer-card').data('id');
      await openBuyerModal(Catalog.buyer(id));
      this.render(el);
    }.bind(this));
    $root.on('click', '.btn-del-buyer', async function () {
      const id = $(this).closest('.buyer-card').data('id');
      const b  = Catalog.buyer(id);
      if (!b || !await UI.confirmDialog(`Delete buyer "${b.name}"?`, { okLabel: 'Delete', okClass: 'btn-danger' })) return;
      const rec = { ...b, active: 0, updatedAt: nowISO() };
      await idb.put('buyers', rec);
      await Catalog.refreshBuyer(id);
      this.render(el);
    }.bind(this));
  },
  destroy() { $root?.off(); $root = null; },
};
