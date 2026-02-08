import * as XLSX from 'xlsx';
import { RawFeature, ColumnMapping, ValidationError } from './types';

const REQUIRED_COLUMNS: (keyof ColumnMapping)[] = ['distance', 'feature_type'];

const COLUMN_ALIASES: Record<string, string[]> = {
  feature_id: ['feature_id', 'feature id', 'id', 'anomaly_id', 'anomaly id', 'defect_id'],
  distance: [
    'distance', 'dist', 'abs_distance', 'absolute_distance',
    'log dist', 'log_dist', 'log dist.', 'log distance', 'log dist. [ft]', 'log dist. [m]',
    'chainage', 'abs dist', 'absolute distance',
  ],
  odometer: ['odometer', 'odo', 'odometer_reading'],
  joint_number: [
    'joint_number', 'joint number', 'joint', 'jt_number', 'jt number', 'weld_number',
    'j. no.', 'j.no', 'j. no', 'j no', 'weld no', 'weld number',
  ],
  relative_position: [
    'relative_position', 'relative position', 'rel_pos', 'upstream_dist', 'us_dist',
    'to u/s w.', 'to u/s w. [ft]', 'to u/s w. [m]', 'us weld dist', 'dist from us weld',
  ],
  clock_position: [
    'clock_position', 'clock position', 'clock', 'orientation', 'oclock',
    "o'clock", 'o clock', 'oclk',
  ],
  feature_type: [
    'feature_type', 'feature type', 'type', 'anomaly_type', 'anomaly type',
    'defect_type', 'classification', 'event', 'feature', 'comment',
  ],
  depth_percent: [
    'depth_percent', 'depth percent', 'depth', 'depth_%', 'depth%',
    'peak_depth', 'max_depth', 'depth [%]',
  ],
  length: ['length', 'len', 'axial_length', 'axial length', 'length [in]', 'length [mm]'],
  width: ['width', 'wid', 'circ_width', 'circumferential width', 'width [in]', 'width [mm]'],
  wall_thickness: [
    'wall_thickness', 'wall thickness', 'wt', 'nom_wt', 'nominal wt',
    't [in]', 't [mm]', 't',
  ],
  weld_type: ['weld_type', 'weld type', 'weld_class', 'nearest_weld_type'],
};

const REFERENCE_PATTERNS = [
  'girth weld', 'girth_weld', 'girthweld', 'weld',
  'valve', 'tee', 'bend', 'cutout', 'flange', 'launcher', 'receiver',
];

function isReferenceType(featureType: string): boolean {
  const lower = featureType.toLowerCase().trim();
  return REFERENCE_PATTERNS.some(p => lower.includes(p));
}

function parseClockPosition(value: string | number | undefined): number {
  if (value == null) return 0;
  const str = String(value).trim();
  const clockMatch = str.match(/^(\d{1,2}):(\d{2})$/);
  if (clockMatch) {
    const hours = parseInt(clockMatch[1]);
    const minutes = parseInt(clockMatch[2]);
    return ((hours % 12) * 30 + minutes * 0.5) % 360;
  }
  const deg = parseFloat(str);
  if (!isNaN(deg)) {
    if (deg <= 12) return (deg % 12) * 30;
    return deg % 360;
  }
  return 0;
}

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim().replace(/[_\s]+/g, ' '));

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const normalizedAlias = alias.toLowerCase().trim().replace(/[_\s]+/g, ' ');
      const idx = normalizedHeaders.findIndex(h => h === normalizedAlias || h.includes(normalizedAlias));
      if (idx !== -1 && !mapping[field]) {
        mapping[field] = headers[idx];
        break;
      }
    }
  }

  return mapping as unknown as ColumnMapping;
}

// --- File-based functions (for user uploads) ---

export function getSheetNames(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        resolve(workbook.SheetNames);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function getSheetHeaders(file: File, sheetName: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
        const headers = (json[0] as string[]) || [];
        resolve(headers.map(h => String(h)));
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function parseExcelFile(
  file: File,
  sheetName: string,
  columnMapping: ColumnMapping,
): Promise<{ features: RawFeature[]; errors: ValidationError[]; warnings: ValidationError[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const result = parseSheetFromBuffer(data, sheetName, columnMapping);
        resolve(result);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// --- Buffer-based functions (for example data and direct parsing) ---

export function getSheetNamesFromBuffer(data: Uint8Array): string[] {
  const workbook = XLSX.read(data, { type: 'array' });
  return workbook.SheetNames;
}

export function getSheetHeadersFromBuffer(data: Uint8Array, sheetName: string): string[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const headers = (json[0] as string[]) || [];
  return headers.map(h => String(h));
}

export function parseSheetFromBuffer(
  data: Uint8Array,
  sheetName: string,
  columnMapping: ColumnMapping,
): { features: RawFeature[]; errors: ValidationError[]; warnings: ValidationError[] } {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  for (const col of REQUIRED_COLUMNS) {
    if (!columnMapping[col]) {
      errors.push({ type: 'missing_column', message: `Required column "${col}" not mapped`, severity: 'error' });
    }
  }
  if (errors.length > 0) {
    return { features: [], errors, warnings };
  }

  let missingCount = 0;
  const duplicateIds = new Set<string>();
  const seenIds = new Set<string>();

  const features: RawFeature[] = rows.map((row, idx) => {
    const getValue = (field: string): unknown => {
      const col = columnMapping[field];
      return col ? row[col] : undefined;
    };

    const featureId = String(getValue('feature_id') ?? `AUTO-${idx + 1}`);
    if (seenIds.has(featureId)) duplicateIds.add(featureId);
    seenIds.add(featureId);

    const distance = parseFloat(String(getValue('distance') ?? '0'));
    if (isNaN(distance)) missingCount++;
    const featureType = String(getValue('feature_type') ?? 'unknown');
    const clockRaw = getValue('clock_position');

    return {
      feature_id: featureId,
      distance: isNaN(distance) ? 0 : distance,
      odometer: getValue('odometer') != null ? parseFloat(String(getValue('odometer'))) : undefined,
      joint_number: getValue('joint_number') != null ? parseInt(String(getValue('joint_number'))) : undefined,
      relative_position: getValue('relative_position') != null ? parseFloat(String(getValue('relative_position'))) : undefined,
      clock_position: clockRaw != null ? String(clockRaw) : undefined,
      clock_position_deg: parseClockPosition(clockRaw as string | number),
      feature_type: featureType,
      depth_percent: getValue('depth_percent') != null ? parseFloat(String(getValue('depth_percent'))) : undefined,
      length: getValue('length') != null ? parseFloat(String(getValue('length'))) : undefined,
      width: getValue('width') != null ? parseFloat(String(getValue('width'))) : undefined,
      wall_thickness: getValue('wall_thickness') != null ? parseFloat(String(getValue('wall_thickness'))) : undefined,
      weld_type: getValue('weld_type') != null ? String(getValue('weld_type')) : undefined,
      is_reference: isReferenceType(featureType),
    };
  }).filter(f => f.distance > 0 || f.is_reference);

  if (missingCount > 0) {
    warnings.push({
      type: 'missing_values',
      message: `${missingCount} rows with missing/invalid distance (${((missingCount / rows.length) * 100).toFixed(1)}%)`,
      severity: 'warning',
    });
  }
  if (duplicateIds.size > 0) {
    warnings.push({
      type: 'duplicates',
      message: `${duplicateIds.size} duplicate feature IDs found`,
      severity: 'warning',
      details: Array.from(duplicateIds).slice(0, 5).join(', '),
    });
  }

  return { features, errors, warnings };
}

/** Parse metadata from a run-info sheet (if present) */
export interface RunMetadata {
  startDate: string;
  vendor: string;
  toolType: string;
}

export function parseRunMetadata(data: Uint8Array, sheetName: string): RunMetadata[] {
  try {
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    
    return rows.map(row => {
      const dateVal = row['Start Date'] ?? row['start_date'] ?? '';
      const vendor = String(row['ILI Vendor'] ?? row['Vendor'] ?? 'Unknown');
      const toolType = String(row['Tool Type'] ?? row['tool_type'] ?? '');
      
      let dateStr = '';
      if (dateVal) {
        if (typeof dateVal === 'number') {
          // Excel serial date
          const date = new Date((dateVal - 25569) * 86400 * 1000);
          dateStr = date.toISOString().split('T')[0];
        } else {
          const d = new Date(String(dateVal));
          if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
        }
      }

      return { startDate: dateStr, vendor, toolType };
    }).filter(m => m.vendor !== 'Unknown' || m.startDate !== '');
  } catch {
    return [];
  }
}
