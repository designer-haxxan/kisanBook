// Expenses — #/expenses  (material expenses per season: seeds, fertilizer, fuel, etc.)
import * as idb from '../db/idb.js';
import * as UI from '../core/ui.js';
import { esc, uuid, nowISO, today, fmtNum, num, debounce } from '../core/utils.js';
import * as Catalog from '../services/farmCatalog.js';
import { EXPENSE_CATEGORIES, EXPENSE_SUBCATEGORIES } from '../db/schema.js';
import { ALL_UNITS, unitLabel } from '../core/units.js';

const $ = window.jQuery;
let $root;

const catMap  = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.id, c]));

function catLabel(id) {
  const c = catMap[id];
  return c ? `${c.label} (${c.urdu})` : id;
}

// ── Expense form modal ───────────────────────────────────
async function openExpenseModal(existing = null, prefillSeasonId = null) {
  const isEdit = !!existing;
  const e      = existing || {};
  const seasons = await idb.getAll('seasons');

  const seasonOptions = seasons
    .sort((a, b) => b.year - a.year || (b.createdAt || '').localeCompare(a.createdAt || ''))
    .map((s) => {
      const crop = Catalog.crop(s.cropId);
      const plot = Catalog.plot(s.plotId);
      const farm = Catalog.farm(s.farmId);
      const label = `${crop?.name || '?'} — ${farm?.name || '?'} › ${plot?.name || '?'} (${s.year})`;
      const selected = (e.seasonId || prefillSeasonId) === s.id ? 'selected' : '';
      return `<option value="${s.id}" ${selected}>${esc(label)}</option>`;
    }).join('');

  const subcatOptions = (catId) => {
    const list = EXPENSE_SUBCATEGORIES[catId] || [];
    return list.map((s) => `<option value="${s}" ${e.subCategory===s?'selected':''}>${esc(s)}</option>`).join('');
  };

  const html = `
    <div class="mb-3">
      <label class="form-label">Season <span class="text-danger">*</span></label>
      <select id="ex-season" class="form-select">
        <option value="">Select season…</option>
        ${seasonOptions}
      </select>
    </div>
    <div class="row g-2 mb-3">
      <div class="col-6">
        <label class="form-label">Date <span class="text-danger">*</span></label>
        <input id="ex-date" type="date" class="form-control" value="${e.date || today()}">
      </div>
      <div class="col-6">
        <label class="form-label">Category <span class="text-danger">*</span></label>
        <select id="ex-cat" class="form-select">
          <option value="">Select…</option>
          ${EXPENSE_CATEGORIES.map((c) => `<option value="${c.id}" ${e.category===c.id?'selected':''}><i class="bi bi-${c.icon}"></i> ${c.label} · ${c.urdu}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="mb-3" id="ex-subcat-row" style="display:none">
      <label class="form-label">Sub-category</label>
      <select id="ex-subcat" class="form-select">
        <option value="">Select…</option>
        ${subcatOptions(e.category || '')}
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label">Description <span class="text-danger">*</span></label>
      <input id="ex-desc" class="form-control" placeholder="e.g. Urea 1 bag, 50 litres diesel…" value="${esc(e.description || '')}">
    </div>
    <div class="row g-2 mb-3">
      <div class="col-4">
        <label class="form-label">Qty</label>
        <input id="ex-qty" type="number" min="0" step="any" class="form-control" placeholder="0" value="${e.qty || ''}">
      </div>
      <div class="col-4">
        <label class="form-label">Unit</label>
        <select id="ex-unit" class="form-select">
          <option value="">—</option>
          ${ALL_UNITS.map((u) => `<option value="${u.id}" ${e.unit===u.id?'selected':''}>${u.label}</option>`).join('')}
        </select>
      </div>
      <div class="col-4">
        <label class="form-label">Rate (Rs/unit)</label>
        <input id="ex-rate" type="number" min="0" step="any" class="form-control" placeholder="0" value="${e.rate || ''}">
      </div>
    </div>
    <div class="mb-3">
      <label class="form-label">Total Amount (Rs) <span class="text-danger">*</span></label>
      <input id="ex-amount" type="number" min="0" step="any" class="form-control" placeholder="0" value="${e.amount || ''}">
    </div>
    <div class="mb-3">
      <label class="form-label">Notes</label>
      <input id="ex-notes" class="form-control" placeholder="Optional" value="${esc(e.notes || '')}">
    </div>`;

  const $dlg = await UI.formDialog(isEdit ? 'Edit Expense' : 'Add Expense', html, { okLabel: isEdit ? 'Save' : 'Add Expense' });

  // Wire up category → subcategory + auto-calculate total
  if ($('#ex-cat').length) {
    $('#ex-cat').on('change', function () {
      const catId = $(this).val();
      const subs  = EXPENSE_SUBCATEGORIES[catId] || [];
      const $row  = $('#ex-subcat-row');
      if (subs.length) {
        $row.show();
        $('#ex-subcat').html('<option value="">Select…</option>' + subs.map((s) => `<option value="${s}">${esc(s)}</option>`).join(''));
      } else {
        $row.hide();
      }
    }).trigger('change');

    const calcAmount = () => {
      const qty  = num($('#ex-qty').val());
      const rate = num($('#ex-rate').val());
      if (qty > 0 && rate > 0 && !$('#ex-amount').data('manual')) {
        $('#ex-amount').val((qty * rate).toFixed(2));
      }
    };
    $('#ex-qty, #ex-rate').on('input', calcAmount);
    $('#ex-amount').on('input', function () { $(this).data('manual', true); });
  }

  if (!$dlg) return null;

  const seasonId = $('#ex-season').val();
  const amount   = num($('#ex-amount').val());
  const category = $('#ex-cat').val();
  const desc     = $('#ex-desc').val().trim();

  if (!seasonId || !amount || !category || !desc) {
    UI.toast('Season, category, description and amount are required.', 'danger');
    return null;
  }

  const season = await idb.get('seasons', seasonId);
  const now = nowISO();
  const rec = {
    id:          isEdit ? e.id : uuid(),
    seasonId,
    farmId:      season?.farmId || '',
    date:        $('#ex-date').val() || today(),
    category,
    subCategory: $('#ex-subcat').val() || null,
    description: desc,
    qty:         num($('#ex-qty').val()) || null,
    unit:        $('#ex-unit').val() || null,
    rate:        num($('#ex-rate').val()) || null,
    amount,
    notes:       $('#ex-notes').val().trim(),
    createdAt:   isEdit ? e.createdAt : now,
    updatedAt:   now,
  };
  await idb.put('expenses', rec);
  document.dispatchEvent(new CustomEvent('data:changed'));
  return rec;
}

// ── List render ──────────────────────────────────────────
function renderRow(e, seasons) {
  const s    = seasons.find((x) => x.id === e.seasonId);
  const crop = Catalog.crop(s?.cropId);
  const cat  = catMap[e.category];

  return `
    <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-start expense-row" data-id="${e.id}">
      <div class="me-2 flex-grow-1 min-w-0">
        <div class="d-flex gap-2 align-items-center">
          <span class="badge bg-secondary-subtle text-secondary">${cat?.label || e.category}</span>
          ${e.subCategory ? `<span class="text-muted small">${esc(e.subCategory)}</span>` : ''}
        </div>
        <div class="fw-semibold mt-1 text-truncate">${esc(e.description)}</div>
        <div class="text-muted small">
          ${e.date} · ${esc(crop?.name || '?')}
          ${e.qty ? ` · ${e.qty} ${unitLabel(e.unit)||''}` : ''}
          ${e.rate ? ` · Rs${fmtNum(e.rate)}/unit` : ''}
        </div>
      </div>
      <div class="text-end text-nowrap ms-2">
        <div class="fw-bold text-danger">Rs ${fmtNum(e.amount)}</div>
        <div class="btn-group btn-group-sm mt-1">
          <button class="btn btn-outline-secondary btn-edit-exp" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-outline-danger btn-del-exp" title="Delete"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    </div>`;
}

export default {
  async render(el, { params = [] } = {}) {
    this.destroy();
    $root = $(el);

    // Parse ?season=xxx from URL params (passed as params[0]='season=...')
    const urlParam = location.hash.split('?')[1] || '';
    const prefillSeasonId = new URLSearchParams(urlParam).get('season') || null;

    $root.html(UI.spinner());

    let [expenses, seasons] = await Promise.all([
      idb.getAll('expenses'),
      idb.getAll('seasons'),
    ]);
    expenses = expenses.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

    const filterSeason = prefillSeasonId ? seasons.find((s) => s.id === prefillSeasonId) : null;
    const displayList  = filterSeason ? expenses.filter((e) => e.seasonId === prefillSeasonId) : expenses;
    const totalAmt     = displayList.reduce((s, e) => s + (e.amount || 0), 0);

    const titleSuffix = filterSeason ? ` — ${esc(Catalog.crop(filterSeason.cropId)?.name || '?')} ${filterSeason.year}` : '';

    const summaryByCategory = {};
    for (const e of displayList) {
      summaryByCategory[e.category] = (summaryByCategory[e.category] || 0) + (e.amount || 0);
    }
    const topCats = Object.entries(summaryByCategory).sort((a, b) => b[1] - a[1]).slice(0, 4);

    $root.html(`
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h5 class="mb-0">Expenses${titleSuffix}</h5>
        <button class="btn btn-success btn-add-exp"><i class="bi bi-plus-lg me-1"></i>Add Expense</button>
      </div>
      ${displayList.length ? `
        <div class="card mb-3">
          <div class="card-body py-2">
            <div class="row g-2 text-center small">
              <div class="col">
                <div class="text-muted">Total</div>
                <div class="fw-bold text-danger fs-5">Rs ${fmtNum(totalAmt)}</div>
              </div>
              ${topCats.map(([catId, amt]) => `
                <div class="col">
                  <div class="text-muted">${catMap[catId]?.label || catId}</div>
                  <div class="fw-semibold">Rs ${fmtNum(amt)}</div>
                </div>`).join('')}
            </div>
          </div>
        </div>
        <div class="list-group">${displayList.map((e) => renderRow(e, seasons)).join('')}</div>`
      : UI.emptyState('No expenses recorded yet.', 'receipt-cutoff')}`);

    $root.on('click', '.btn-add-exp', async () => {
      await openExpenseModal(null, prefillSeasonId);
      this.render(el, { params });
    });
    $root.on('click', '.btn-edit-exp', async function () {
      const id = $(this).closest('.expense-row').data('id');
      const e  = await idb.get('expenses', id);
      await openExpenseModal(e);
      this.render(el, { params });
    }.bind(this));
    $root.on('click', '.btn-del-exp', async function () {
      const id = $(this).closest('.expense-row').data('id');
      const e  = await idb.get('expenses', id);
      if (!e) return;
      if (!await UI.confirmDialog(`Delete expense "${e.description}" (Rs ${fmtNum(e.amount)})?`, { okLabel: 'Delete', okClass: 'btn-danger' })) return;
      await idb.delete('expenses', id);
      this.render(el, { params });
    }.bind(this));
  },

  destroy() { $root?.off(); $root = null; },
};
