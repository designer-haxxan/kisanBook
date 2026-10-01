// In-memory cache of farms, plots, crops, and buyers for quick lookups.
// IndexedDB is the source of truth — call load() on app start, refresh* after mutations.
import * as idb from '../db/idb.js';
import { lc } from '../core/utils.js';

const farms  = new Map();
const plots  = new Map();
const crops  = new Map();
const buyers = new Map();
// derived
const plotsByFarm = new Map();  // farmId → [plot, …]

function indexPlot(p) {
  plots.set(p.id, p);
  if (!plotsByFarm.has(p.farmId)) plotsByFarm.set(p.farmId, []);
  const arr = plotsByFarm.get(p.farmId);
  const idx = arr.findIndex((x) => x.id === p.id);
  if (idx >= 0) arr[idx] = p; else arr.push(p);
}

function removePlot(id) {
  const p = plots.get(id);
  if (!p) return;
  plots.delete(id);
  const arr = plotsByFarm.get(p.farmId);
  if (arr) {
    const i = arr.findIndex((x) => x.id === id);
    if (i >= 0) arr.splice(i, 1);
  }
}

export async function load() {
  const [fs, ps, cs, bs] = await idb.read(
    ['farms', 'plots', 'crops', 'buyers'],
    (t) => Promise.all([t.getAll('farms'), t.getAll('plots'), t.getAll('crops'), t.getAll('buyers')]),
  );
  farms.clear(); plots.clear(); crops.clear(); buyers.clear(); plotsByFarm.clear();
  fs.forEach((f) => farms.set(f.id, f));
  ps.forEach(indexPlot);
  cs.forEach((c) => crops.set(c.id, c));
  bs.forEach((b) => buyers.set(b.id, b));
}

export async function refreshFarm(id) {
  const f = await idb.get('farms', id);
  if (f) farms.set(id, f); else farms.delete(id);
}
export async function refreshPlot(id) {
  const p = await idb.get('plots', id);
  removePlot(id);
  if (p) indexPlot(p);
}
export async function refreshCrop(id) {
  const c = await idb.get('crops', id);
  if (c) crops.set(id, c); else crops.delete(id);
}
export async function refreshBuyer(id) {
  const b = await idb.get('buyers', id);
  if (b) buyers.set(id, b); else buyers.delete(id);
}

// ── Farms ────────────────────────────────────────────────
export const farm        = (id)  => farms.get(id);
export const allFarms    = ()    => [...farms.values()].filter((f) => f.active).sort((a, b) => a.name.localeCompare(b.name));
export const allFarmsRaw = ()    => [...farms.values()];

// ── Plots ────────────────────────────────────────────────
export const plot         = (id)     => plots.get(id);
export const plotsFor     = (farmId) => (plotsByFarm.get(farmId) || []).filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name));
export const allPlots     = ()       => [...plots.values()].filter((p) => p.active);
export const allPlotsRaw  = ()       => [...plots.values()];

// ── Crops ────────────────────────────────────────────────
export const crop      = (id) => crops.get(id);
export const allCrops  = ()   => [...crops.values()].filter((c) => c.active).sort((a, b) => a.name.localeCompare(b.name));

// ── Buyers ───────────────────────────────────────────────
export const buyer      = (id) => buyers.get(id);
export const allBuyers  = ()   => [...buyers.values()].filter((b) => b.active).sort((a, b) => a.name.localeCompare(b.name));

// ── Search helpers ───────────────────────────────────────
export function searchBuyers(q, limit = 50) {
  if (!q) return allBuyers().slice(0, limit);
  const terms = lc(q).split(/\s+/).filter(Boolean);
  return allBuyers()
    .filter((b) => terms.every((t) => lc(`${b.name} ${b.phone || ''} ${b.city || ''} ${b.type || ''}`).includes(t)))
    .slice(0, limit);
}

// ── Display helpers ──────────────────────────────────────
export function farmPlotLabel(plotId) {
  const p = plots.get(plotId);
  if (!p) return '—';
  const f = farms.get(p.farmId);
  return f ? `${f.name} › ${p.name}` : p.name;
}
export function cropLabel(cropId) {
  const c = crops.get(cropId);
  return c ? `${c.name}${c.urdu ? ' · ' + c.urdu : ''}` : '—';
}
