// Pakistan-specific units for weight, area, and volume used in agriculture.

export const WEIGHT_UNITS = [
  { id: 'maund',   label: 'Maund (مَن)',    kg: 40    },
  { id: 'kg',      label: 'KG (کلوگرام)',   kg: 1     },
  { id: 'quintal', label: 'Quintal',         kg: 100   },
  { id: 'tonne',   label: 'Tonne (ٹن)',      kg: 1000  },
  { id: 'seer',    label: 'Seer (سیر)',      kg: 0.933 },
];

export const AREA_UNITS = [
  { id: 'acres',  label: 'Acres (ایکڑ)',    toAcre: 1       },
  { id: 'kanals', label: 'Kanals (کنال)',   toAcre: 0.125   }, // 8 kanals = 1 acre
  { id: 'marlas', label: 'Marlas (مرلہ)',   toAcre: 0.00625 }, // 160 marlas = 1 acre
  { id: 'hectare',label: 'Hectare',          toAcre: 2.47105 },
];

export const VOLUME_UNITS = [
  { id: 'litre', label: 'Litre (لیٹر)' },
  { id: 'ml',    label: 'ML' },
];

export const COUNT_UNITS = [
  { id: 'bag',   label: 'Bags (تھیلے)' },
  { id: 'unit',  label: 'Units' },
];

// All units combined for general expense entry (seeds, fertilizer by weight/bag, pesticide by litre).
export const ALL_UNITS = [...WEIGHT_UNITS, ...VOLUME_UNITS, ...COUNT_UNITS];

export const WEIGHT_UNIT_IDS = WEIGHT_UNITS.map((u) => u.id);
export const AREA_UNIT_IDS   = AREA_UNITS.map((u) => u.id);

export function weightUnitLabel(id) {
  return WEIGHT_UNITS.find((u) => u.id === id)?.label || id;
}
export function areaUnitLabel(id) {
  return AREA_UNITS.find((u) => u.id === id)?.label || id;
}
export function unitLabel(id) {
  return ALL_UNITS.find((u) => u.id === id)?.label || AREA_UNITS.find((u) => u.id === id)?.label || id;
}

// Convert any weight to kg.
export function toKg(qty, unit) {
  const u = WEIGHT_UNITS.find((x) => x.id === unit);
  return u ? qty * u.kg : qty;
}
// Convert any area to acres.
export function toAcres(qty, unit) {
  const u = AREA_UNITS.find((x) => x.id === unit);
  return u ? qty * u.toAcre : qty;
}

// Format a quantity + unit pair.
export function fmtUnit(qty, unit) {
  if (qty == null) return '';
  const label = unitLabel(unit) || unit || '';
  return `${qty.toLocaleString()} ${label}`.trim();
}

export const HARVEST_UNITS = WEIGHT_UNITS.map((u) => u.id);
