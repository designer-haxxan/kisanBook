// KisanBook JSON backup — export, validate and restore. Never includes credentials.
import * as idb from '../db/idb.js';
import { DATA_STORES } from '../db/schema.js';
import { CONFIG } from '../config.js';
import { getSettings, replaceSettings } from '../core/settings.js';
import { nowISO, uuid, AppError } from '../core/utils.js';
import * as Auth from './auth.js';
import * as Catalog from './farmCatalog.js';

export const FORMAT = 'kisanbook-backup';

// Minimum required fields per store (id checked separately).
const REQUIRED = {
  farms: ['name'], plots: ['name', 'farmId'], crops: ['name'],
  seasons: ['farmId', 'plotId', 'cropId', 'year'],
  expenses: ['seasonId', 'date', 'amount'],
  laborEntries: ['seasonId', 'date', 'totalAmount'],
  harvests: ['seasonId', 'date', 'quantity'],
  sales: ['seasonId', 'date', 'grossAmount'],
  buyers: ['name'],
};

async function sha256(text) {
  if (!crypto?.subtle) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createBackup() {
  Auth.require('backup.export');
  const data = {};
  for (const s of DATA_STORES) data[s] = await idb.getAll(s);
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
  const u = Auth.user();
  return {
    format: FORMAT, backupVersion: CONFIG.BACKUP_VERSION, appVersion: CONFIG.APP_VERSION,
    schemaVersion: CONFIG.SCHEMA_VERSION, createdAt: nowISO(),
    createdBy: u ? { name: u.name } : null, deviceId: Auth.deviceId(),
    counts, checksum: await sha256(JSON.stringify(data)), settings: getSettings(), data,
  };
}

export function validateBackup(obj) {
  const errors = []; const warnings = [];
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['Not a valid JSON object.'], warnings };
  if (obj.format !== FORMAT) errors.push('This file is not a KisanBook backup.');
  if (!Number.isInteger(obj.backupVersion)) errors.push('Missing backup version.');
  else if (obj.backupVersion > CONFIG.BACKUP_VERSION) errors.push(`Backup was made by a newer app version (v${obj.backupVersion}). Update the app first.`);
  if (obj.schemaVersion > CONFIG.SCHEMA_VERSION) errors.push(`Unsupported schema version ${obj.schemaVersion}.`);
  if (!obj.data || typeof obj.data !== 'object') errors.push('Backup has no data section.');
  if (errors.length) return { ok: false, errors, warnings };

  const counts = {};
  for (const store of DATA_STORES) {
    const list = obj.data[store];
    if (list === undefined) { warnings.push(`Store "${store}" not in backup (treated as empty).`); counts[store] = 0; continue; }
    if (!Array.isArray(list)) { errors.push(`Store "${store}" is not an array.`); continue; }
    counts[store] = list.length;
    const keyField = store === 'meta' ? 'key' : 'id';
    const seen = new Set();
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (!r || typeof r !== 'object' || !r[keyField]) { errors.push(`${store}[${i}] missing "${keyField}".`); break; }
      if (seen.has(r[keyField])) { errors.push(`${store} has duplicate "${r[keyField]}".`); break; }
      seen.add(r[keyField]);
      const miss = (REQUIRED[store] || []).find((f) => r[f] === undefined || r[f] === null);
      if (miss) { errors.push(`${store} record "${r[keyField]}" missing "${miss}".`); break; }
    }
    if (obj.counts?.[store] !== undefined && obj.counts[store] !== list.length) {
      errors.push(`Count mismatch in ${store} (expected ${obj.counts[store]}, found ${list.length}).`);
    }
  }
  return { ok: !errors.length, errors, warnings, counts, createdAt: obj.createdAt, appVersion: obj.appVersion, createdBy: obj.createdBy };
}

export async function verifyChecksum(obj) {
  if (!obj.checksum) return null;
  const h = await sha256(JSON.stringify(obj.data));
  return h === null ? null : h === obj.checksum;
}

const stamp = (r) => r.updatedAt || r.createdAt || '';

export async function restore(obj, mode, { includeSettings = true } = {}) {
  Auth.require('backup.restore');
  const v = validateBackup(obj);
  if (!v.ok) throw new AppError('Backup is invalid: ' + v.errors[0]);

  const report = { mode, added: 0, updated: 0, skipped: 0, conflicts: [] };

  for (const store of DATA_STORES) {
    const records = obj.data[store] || [];
    if (mode === 'replace') {
      await idb.clear(store);
      for (const r of records) { await idb.put(store, r); report.added++; }
    } else {
      const keyField = store === 'meta' ? 'key' : 'id';
      for (const r of records) {
        const key = r[keyField];
        const local = await idb.get(store, key);
        if (store === 'meta') {
          if (!local) { await idb.put(store, r); report.added++; }
          else if (typeof r.value === 'number' && typeof local.value === 'number' && r.value > local.value) { await idb.put(store, r); report.updated++; }
          else report.skipped++;
        } else if (!local) { await idb.put(store, r); report.added++; }
        else if (stamp(r) > stamp(local)) { await idb.put(store, r); report.updated++; }
        else report.skipped++;
      }
    }
  }

  await idb.put('auditLog', {
    id: uuid(), at: nowISO(), userId: Auth.user()?.id, userName: Auth.user()?.name,
    action: 'backup_restored', details: { mode, from: obj.createdAt },
  });

  if (includeSettings && obj.settings && mode === 'replace') replaceSettings(obj.settings);
  await Catalog.load();
  document.dispatchEvent(new CustomEvent('data:changed'));
  return report;
}
