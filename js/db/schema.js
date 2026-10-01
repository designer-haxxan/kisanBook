// IndexedDB schema for KisanBook — Pakistan farm management.

export const DB_NAME   = 'kisanbook';
export const DB_VERSION = 3;

export const DATA_STORES = [
  'farms', 'plots', 'crops', 'seasons',
  'expenses', 'laborEntries', 'harvests', 'sales', 'buyers',
  'meta', 'auditLog',
];

const STORES = {
  meta:         { keyPath: 'key', indexes: {} },
  farms:        { indexes: { nameLc: 'nameLc', active: 'active' } },
  plots:        { indexes: { farmId: 'farmId', nameLc: 'nameLc' } },
  crops:        { indexes: { nameLc: 'nameLc', season: 'season', active: 'active' } },
  seasons:      { indexes: { plotId: 'plotId', farmId: 'farmId', cropId: 'cropId', year: 'year', status: 'status' } },
  expenses:     { indexes: { seasonId: 'seasonId', farmId: 'farmId', date: 'date', category: 'category' } },
  laborEntries: { indexes: { seasonId: 'seasonId', farmId: 'farmId', date: 'date' } },
  harvests:     { indexes: { seasonId: 'seasonId', farmId: 'farmId', date: 'date' } },
  sales:        { indexes: { seasonId: 'seasonId', farmId: 'farmId', date: 'date', buyerId: 'buyerId', paymentStatus: 'paymentStatus' } },
  buyers:       { indexes: { nameLc: 'nameLc', type: 'type', active: 'active' } },
  auditLog:     { indexes: { at: 'at' } },
};

// Default Pakistan crops pre-loaded on first install.
export const DEFAULT_CROPS = [
  { name: 'Wheat',         urdu: 'گندم',        season: 'rabi',   unit: 'maund',  category: 'cereal'     },
  { name: 'Rice / Paddy',  urdu: 'چاول / دھان', season: 'kharif', unit: 'maund',  category: 'cereal'     },
  { name: 'Maize / Corn',  urdu: 'مکئی',        season: 'kharif', unit: 'maund',  category: 'cereal'     },
  { name: 'Sugarcane',     urdu: 'گنا',          season: 'kharif', unit: 'tonne',  category: 'cash_crop'  },
  { name: 'Cotton',        urdu: 'کپاس',         season: 'kharif', unit: 'maund',  category: 'cash_crop'  },
  { name: 'Mustard',       urdu: 'سرسوں',        season: 'rabi',   unit: 'maund',  category: 'oilseed'    },
  { name: 'Potato',        urdu: 'آلو',           season: 'rabi',   unit: 'maund',  category: 'vegetable'  },
  { name: 'Tomato',        urdu: 'ٹماٹر',        season: 'kharif', unit: 'maund',  category: 'vegetable'  },
  { name: 'Onion',         urdu: 'پیاز',          season: 'rabi',   unit: 'maund',  category: 'vegetable'  },
  { name: 'Sunflower',     urdu: 'سورج مکھی',    season: 'kharif', unit: 'maund',  category: 'oilseed'    },
  { name: 'Chickpea',      urdu: 'چنا',           season: 'rabi',   unit: 'maund',  category: 'pulse'      },
  { name: 'Mung Bean',     urdu: 'مونگ',          season: 'kharif', unit: 'maund',  category: 'pulse'      },
];

// Expense categories with Pakistani terms.
export const EXPENSE_CATEGORIES = [
  { id: 'seeds',        label: 'Seeds',          urdu: 'بیج',           icon: 'flower1'         },
  { id: 'fertilizer',   label: 'Fertilizer',     urdu: 'کھاد',          icon: 'droplet-half'    },
  { id: 'pesticide',    label: 'Pesticide',      urdu: 'دوائی',         icon: 'shield-check'    },
  { id: 'fuel',         label: 'Fuel / Engine',  urdu: 'ایندھن',        icon: 'fuel-pump'       },
  { id: 'irrigation',   label: 'Irrigation',     urdu: 'پانی',          icon: 'water'           },
  { id: 'land_prep',    label: 'Land Prep',      urdu: 'زمین تیاری',    icon: 'tractor'         },
  { id: 'harvest_cost', label: 'Harvest Cost',   urdu: 'کٹائی',         icon: 'scissors'        },
  { id: 'transport',    label: 'Transport',      urdu: 'ٹرانسپورٹ',    icon: 'truck'           },
  { id: 'rent',         label: 'Land Rent',      urdu: 'کرایہ',         icon: 'house'           },
  { id: 'misc',         label: 'Miscellaneous',  urdu: 'متفرق',         icon: 'three-dots'      },
];

export const EXPENSE_SUBCATEGORIES = {
  fertilizer:   ['Urea (یوریا)', 'DAP', 'Potash', 'SOP', 'Zink', 'FYM / Farmyard Manure', 'Other'],
  pesticide:    ['Insecticide', 'Herbicide / Weedicide', 'Fungicide', 'Other'],
  fuel:         ['Diesel', 'Petrol', 'Lubricant / Oil'],
  irrigation:   ['Tubewell', 'Canal', 'Drip / Sprinkler'],
  land_prep:    ['Plowing (ہل)', 'Laser Leveling', 'Bed Making', 'Rotavator', 'Other'],
  harvest_cost: ['Cutting / Reaping', 'Threshing', 'Cleaning / Winnowing', 'Machine Hire', 'Other'],
};

export const SEASONS = [
  { id: 'kharif', label: 'Kharif (خریف)', months: 'May – November', icon: '☀️' },
  { id: 'rabi',   label: 'Rabi (ربیع)',   months: 'November – April', icon: '🌾' },
  { id: 'both',   label: 'Year-round',    months: 'All year',         icon: '📅' },
];

export const SALE_METHODS = [
  { id: 'arhtiya', label: 'Arhtiya (Commission Agent)', urdu: 'آڑھتیا', icon: 'person-badge'  },
  { id: 'direct',  label: 'Direct Buyer at Farm',       urdu: 'فارم پر براہ راست', icon: 'house-door' },
  { id: 'mandi',   label: 'Mandi Market',               urdu: 'منڈی',   icon: 'shop'          },
  { id: 'contract',label: 'Contract / Advance Buyer',   urdu: 'کنٹریکٹ', icon: 'file-text'   },
];

export const BUYER_TYPES = [
  { id: 'arhtiya', label: 'Arhtiya (آڑھتیا)' },
  { id: 'trader',  label: 'Trader / Bepari (بیوپاری)' },
  { id: 'mill',    label: 'Mill / Factory (مل)' },
  { id: 'direct',  label: 'Direct Consumer' },
  { id: 'govt',    label: 'Government / Passco' },
];

function createStores(db, defs) {
  for (const [name, def] of Object.entries(defs)) {
    const os = db.createObjectStore(name, { keyPath: def.keyPath || 'id' });
    for (const [idx, spec] of Object.entries(def.indexes)) {
      const [keyPath, unique] = Array.isArray(spec) ? spec : [spec, false];
      os.createIndex(idx, keyPath, { unique: !!unique });
    }
  }
}

export function upgrade(db, oldVersion, t, wt) {
  if (oldVersion < 3) {
    // Drop all old POS stores if upgrading from v1/v2.
    const existingStores = [...db.objectStoreNames];
    for (const s of existingStores) {
      try { db.deleteObjectStore(s); } catch { /* ignore */ }
    }
    createStores(db, STORES);
    const now = new Date().toISOString();
    t.objectStore('meta').put({ key: 'schemaVersion', value: 3 });
    t.objectStore('meta').put({ key: 'createdAt', value: now });
    (async () => {
      const cropStore = t.objectStore('crops');
      for (const c of DEFAULT_CROPS) {
        cropStore.put({
          id: crypto.randomUUID ? crypto.randomUUID() : `crop-${c.name}`,
          name: c.name, nameLc: c.name.toLowerCase(),
          urdu: c.urdu, season: c.season, unit: c.unit,
          category: c.category, active: 1, createdAt: now, updatedAt: now,
        });
      }
    })().catch((e) => { console.error('KisanBook DB init failed', e); t.abort(); });
  }
}
