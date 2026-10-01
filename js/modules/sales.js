// Sales — #/sales  Record crop sales to buyers (Arhtiya, Mandi, Direct, Contract)
import * as idb from '../db/idb.js';
import * as UI from '../core/ui.js';
import { esc, uuid, nowISO, today, fmtNum, num } from '../core/utils.js';
import * as Catalog from '../services/farmCatalog.js';
import { SALE_METHODS } from '../db/schema.js';
import { WEIGHT_UNITS, weightUnitLabel } from '../core/units.js';

const $ = window.jQuery;
let $root;

const methodMap = Object.fromEntries(SALE_METHODS.map((m) => [m.id, m]));

async function openSaleModal(existing = null, prefillSeasonId = null) {
  const isEdit = !!existing;
  const s      = existing || {};
  const seasons = (await idb.getAll('seasons'))
    .sort((a, b) => b.year - a.year || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const buyers = Catalog.allBuyers();

  const seasonOptions = seasons.map((sn) => {
    const crop = Catalog.crop(sn.cropId);
    const plot = Catalog.plot(sn.plotId);
    const farm = Catalog.farm(sn.farmId);
    const label = `${crop?.name || '?'} — ${farm?.name || '?'} › ${plot?.name || '?'} (${sn.year})`;
    const sel = (s.seasonId || prefillSeasonId) === sn.id ? 'selected' : '';
    return `<option value="${sn.id}" ${sel}>${esc(label)}</option>`;
  }).join('');

  const buyerOptions = buyers.map((b) => `<option value="${b.id}" ${s.buyerId===b.id?'selected':''}>${esc(b.name)}${b.type?' ('+b.type+')':''}</option>`).join('');

  const html = `
    <div class="mb-3">
      <label class="form-label">Season <span class="text-danger">*</span></label>
      <select id="sl-season" class="form-select">
        <option value="">Select season…</option>
        ${seasonOptions}
      </select>
    </div>
    <div class="row g-2 mb-3">
      <div class="col-6">
        <label class="form-label">Sale Date <span class="text-danger">*</span></label>
        <input id="sl-date" type="date" class="form-control" value="${s.date || today()}">
      </div>
      <div class="col-6">
        <label class="form-label">Sale Method <span class="text-danger">*</span></label>
        <select id="sl-method" class="form-select">
          <option value="">Select…</option>
          ${SALE_METHODS.map((m) => `<option value="${m.id}" ${s.saleMethod===m.id?'selected':''}>${m.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="mb-3">
      <label class="form-label">Buyer</label>
      <select id="sl-buyer" class="form-select">
        <option value="">No buyer selected</option>
        ${buyerOptions}
      </select>
      ${!buyers.length ? '<div class="form-text"><a href="#/buyers">Add buyers first</a></div>' : ''}
    </div>
    <div class="row g-2 mb-3">
      <div class="col-5">
        <label class="form-label">Quantity <span class="text-danger">*</span></label>
        <input id="sl-qty" type="number" min="0" step="any" class="form-control" placeholder="0" value="${s.quantity || ''}">
      </div>
      <div class="col-4">
        <label class="form-label">Unit</label>
        <select id="sl-unit" class="form-select">
          ${WEIGHT_UNITS.map((u) => `<option value="${u.id}" ${(s.unit||'maund')===u.id?'selected':''}>${u.label}</option>`).join('')}
        </select>
      </div>
      <div class="col-3">
        <label class="form-label">Rate (Rs)</label>
        <input id="sl-rate" type="number" min="0" step="any" class="form-control" placeholder="0" value="${s.pricePerUnit || ''}">
      </div>
    </div>
    <div class="mb-3">
      <label class="form-label fw-semibold">Gross Amount (Rs) <span class="text-danger">*</span></label>
      <input id="sl-gross" type="number" min="0" step="any" class="form-control form-control-lg" placeholder="0" value="${s.grossAmount || ''}">
    </div>
    <div class="row g-2 mb-3">
      <div class="col-4">
        <label class="form-label">Commission %</label>
        <input id="sl-comm-pct" type="number" min="0" max="100" step="0.5" class="form-control" placeholder="0" value="${s.commissionRate || ''}">
      </div>
      <div class="col-4">
        <label class="form-label">Commission Rs</label>
        <input id="sl-comm-amt" type="number" min="0" step="any" class="form-control" placeholder="0" value="${s.commissionAmount || ''}">
      </div>
      <div class="col-4">
        <label class="form-label">Transport (Rs)</label>
        <input id="sl-transport" type="number" min="0" step="any" class="form-control" placeholder="0" value="${s.transportCost || ''}">
      </div>
    </div>
    <div class="mb-3">
      <label class="form-label fw-semibold text-success">Net Amount (Rs)</label>
      <input id="sl-net" type="number" min="0" step="any" class="form-control form-control-lg text-success fw-bold" placeholder="0" value="${s.netAmount || ''}">
      <div class="form-text">Auto-calculated: Gross − Commission − Transport. You can override.</div>
    </div>
    <div class="row g-2 mb-3">
      <div class="col-6">
        <label class="form-label">Payment Status</label>
        <select id="sl-paystatus" class="form-select">
          <option value="pending"  ${(s.paymentStatus||'pending') ==='pending' ?'selected':''}>Pending (باقی)</option>
          <option value="partial"  ${s.paymentStatus ==='partial' ?'selected':''}>Partial (کچھ ملا)</option>
          <option value="received" ${s.paymentStatus ==='received'?'selected':''}>Received (مل گیا)</option>
        </select>
      </div>
      <div class="col-6">
        <label class="form-label">Amount Paid (Rs)</label>
        <input id="sl-paid" type="number" min="0" step="any" class="form-control" placeholder="0" value="${s.paidAmount || ''}">
      </div>
    </div>
    <div class="mb-3">
      <label class="form-label">Notes</label>
      <input id="sl-notes" class="form-control" placeholder="Optional notes" value="${esc(s.notes || '')}">
    </div>`;

  const $dlg = await UI.formDialog(isEdit ? 'Edit Sale' : 'Record Sale', html, { okLabel: isEdit ? 'Save' : 'Record Sale' });

  // Auto-calculate gross and net
  if ($('#sl-qty').length) {
    const calcGross = () => {
      const q = num($('#sl-qty').val()); const r = num($('#sl-rate').val());
      if (q > 0 && r > 0 && !$('#sl-gross').data('manual')) $('#sl-gross').val((q * r).toFixed(0));
      calcNet();
    };
    const calcNet = () => {
      const g = num($('#sl-gross').val());
      const c = num($('#sl-comm-amt').val());
      const t = num($('#sl-transport').val());
      if (!$('#sl-net').data('manual')) $('#sl-net').val((g - c - t).toFixed(0));
    };
    const calcCommAmt = () => {
      const g = num($('#sl-gross').val()); const pct = num($('#sl-comm-pct').val());
      if (g > 0 && pct > 0 && !$('#sl-comm-amt').data('manual')) $('#sl-comm-amt').val((g * pct / 100).toFixed(0));
      calcNet();
    };
    $('#sl-qty,#sl-rate').on('input', calcGross);
    $('#sl-gross').on('input', function () { $(this).data('manual', true); calcNet(); });
    $('#sl-comm-pct').on('input', calcCommAmt);
    $('#sl-comm-amt').on('input', function () { $(this).data('manual', true); calcNet(); });
    $('#sl-transport').on('input', calcNet);
    $('#sl-net').on('input', function () { $(this).data('manual', true); });
    // Pre-fill commission from buyer
    $('#sl-buyer').on('change', function () {
      const b = Catalog.buyer($(this).val());
      if (b?.commissionRate) { $('#sl-comm-pct').val(b.commissionRate); calcCommAmt(); }
    });
  }

  if (!$dlg) return null;

  const seasonId = $('#sl-season').val();
  const gross    = num($('#sl-gross').val());
  const method   = $('#sl-method').val();
  if (!seasonId || !gross || !method) { UI.toast('Season, method and gross amount are required.', 'danger'); return null; }

  const season = await idb.get('seasons', seasonId);
  const now    = nowISO();
  const rec = {
    id:               isEdit ? s.id : uuid(),
    seasonId,
    farmId:           season?.farmId || '',
    date:             $('#sl-date').val() || today(),
    buyerId:          $('#sl-buyer').val() || null,
    saleMethod:       method,
    quantity:         num($('#sl-qty').val()) || null,
    unit:             $('#sl-unit').val() || 'maund',
    pricePerUnit:     num($('#sl-rate').val()) || null,
    grossAmount:      gross,
    commissionRate:   num($('#sl-comm-pct').val()) || null,
    commissionAmount: num($('#sl-comm-amt').val()) || 0,
    transportCost:    num($('#sl-transport').val()) || 0,
    netAmount:        num($('#sl-net').val()) || gross,
    paymentStatus:    $('#sl-paystatus').val(),
    paidAmount:       num($('#sl-paid').val()) || 0,
    notes:            $('#sl-notes').val().trim(),
    createdAt:        isEdit ? s.createdAt : now,
    updatedAt:        now,
  };
  await idb.put('sales', rec);

  // Auto-advance season status to 'sold'
  if (season && ['growing','harvested'].includes(season.status)) {
    await idb.put('seasons', { ...season, status: 'sold', updatedAt: now });
  }

  document.dispatchEvent(new CustomEvent('data:changed'));
  return rec;
}

function renderRow(sale, seasons) {
  const sn     = seasons.find((x) => x.id === sale.seasonId);
  const crop   = Catalog.crop(sn?.cropId);
  const buyer  = Catalog.buyer(sale.buyerId);
  const method = methodMap[sale.saleMethod];
  const pending = (sale.netAmount || 0) - (sale.paidAmount || 0);
  const payClass = sale.paymentStatus === 'received' ? 'text-success' : sale.paymentStatus === 'partial' ? 'text-warning' : 'text-danger';

  return `
    <div class="list-group-item d-flex justify-content-between align-items-start sale-row" data-id="${sale.id}">
      <div class="flex-grow-1 min-w-0 me-2">
        <div class="d-flex align-items-center gap-2 mb-1">
          <span class="badge bg-primary-subtle text-primary">${method?.label || sale.saleMethod}</span>
          ${sale.quantity ? `<span class="text-muted small">${fmtNum(sale.quantity)} ${weightUnitLabel(sale.unit)}</span>` : ''}
        </div>
        <div class="fw-semibold">${esc(crop?.name || '?')} ${sn?.year || ''}</div>
        <div class="text-muted small">
          ${sale.date}
          ${buyer ? ` · ${esc(buyer.name)}` : ''}
          ${sale.pricePerUnit ? ` · Rs${fmtNum(sale.pricePerUnit)}/${weightUnitLabel(sale.unit)}` : ''}
        </div>
        ${sale.commissionAmount > 0 ? `<div class="text-muted small">Commission: Rs ${fmtNum(sale.commissionAmount)} | Transport: Rs ${fmtNum(sale.transportCost || 0)}</div>` : ''}
        ${pending > 0.5 ? `<div class="text-warning small"><i class="bi bi-clock me-1"></i>Rs ${fmtNum(pending)} pending</div>` : ''}
      </div>
      <div class="text-end text-nowrap ms-2">
        <div class="fw-bold text-success">Rs ${fmtNum(sale.netAmount)}</div>
        <div class="small ${payClass}">${sale.paymentStatus}</div>
        <div class="btn-group btn-group-sm mt-1">
          <button class="btn btn-outline-secondary btn-edit-sale" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-outline-danger btn-del-sale" title="Delete"><i class="bi bi-trash"></i></button>
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
    let [sales, seasons] = await Promise.all([idb.getAll('sales'), idb.getAll('seasons')]);
    sales = sales.sort((a, b) => b.date.localeCompare(a.date));
    const displayList = prefillSeasonId ? sales.filter((s) => s.seasonId === prefillSeasonId) : sales;
    const filterSeason = prefillSeasonId ? seasons.find((s) => s.id === prefillSeasonId) : null;
    const titleSuffix  = filterSeason ? ` — ${esc(Catalog.crop(filterSeason.cropId)?.name || '?')} ${filterSeason.year}` : '';

    const totalNet  = displayList.reduce((s, sl) => s + (sl.netAmount || 0), 0);
    const totalPaid = displayList.reduce((s, sl) => s + (sl.paidAmount || 0), 0);
    const totalPending = totalNet - totalPaid;

    $root.html(`
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0">Sales${titleSuffix}</h5>
        <button class="btn btn-success btn-add-sale"><i class="bi bi-plus-lg me-1"></i>Record Sale</button>
      </div>
      ${displayList.length ? `
        <div class="row g-2 mb-3">
          <div class="col-4"><div class="card text-center py-2"><div class="text-muted small">Total Income</div><div class="fw-bold text-success">Rs ${fmtNum(totalNet)}</div></div></div>
          <div class="col-4"><div class="card text-center py-2"><div class="text-muted small">Received</div><div class="fw-bold">Rs ${fmtNum(totalPaid)}</div></div></div>
          <div class="col-4"><div class="card text-center py-2"><div class="text-muted small">Pending</div><div class="fw-bold text-warning">Rs ${fmtNum(totalPending)}</div></div></div>
        </div>
        <div class="list-group">${displayList.map((sl) => renderRow(sl, seasons)).join('')}</div>`
      : UI.emptyState('No sales recorded yet.', 'cash-coin')}`);

    $root.on('click', '.btn-add-sale', async () => {
      await openSaleModal(null, prefillSeasonId);
      this.render(el, { params });
    });
    $root.on('click', '.btn-edit-sale', async function () {
      const id = $(this).closest('.sale-row').data('id');
      const sl = await idb.get('sales', id);
      await openSaleModal(sl);
      this.render(el, { params });
    }.bind(this));
    $root.on('click', '.btn-del-sale', async function () {
      const id = $(this).closest('.sale-row').data('id');
      const sl = await idb.get('sales', id);
      if (!sl || !await UI.confirmDialog(`Delete sale record (Rs ${fmtNum(sl.netAmount)})?`, { okLabel: 'Delete', okClass: 'btn-danger' })) return;
      await idb.delete('sales', id);
      this.render(el, { params });
    }.bind(this));
  },
  destroy() { $root?.off(); $root = null; },
};
