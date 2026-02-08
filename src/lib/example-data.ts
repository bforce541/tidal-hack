import { RunData } from './types';
import {
  getSheetNamesFromBuffer,
  getSheetHeadersFromBuffer,
  autoDetectMapping,
  parseSheetFromBuffer,
  parseRunMetadata,
  RunMetadata,
} from './excel-parser';

const EXAMPLE_FILE_PATH = '/sample_data/ILIDataV2.xlsx';

// Known metadata for the 3 runs in ILIDataV2.xlsx
const FALLBACK_METADATA: RunMetadata[] = [
  { startDate: '2007-06-19', vendor: 'Rosen', toolType: 'Axial MFL' },
  { startDate: '2015-05-06', vendor: 'Baker Hughes', toolType: 'MFL-A/XT' },
  { startDate: '2022-02-23', vendor: 'Baker Hughes', toolType: 'C-MFL' },
];

export async function loadExampleData(): Promise<RunData[]> {
  const response = await fetch(EXAMPLE_FILE_PATH);
  if (!response.ok) {
    throw new Error(`Failed to fetch example data: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  const sheetNames = getSheetNamesFromBuffer(data);
  if (sheetNames.length < 2) {
    throw new Error('Expected at least 2 sheets (metadata + data) in example file');
  }

  // Try to parse metadata from the first sheet
  let metadata = parseRunMetadata(data, sheetNames[0]);
  if (metadata.length === 0) {
    metadata = FALLBACK_METADATA;
  }

  // Data sheets are all sheets after the first (metadata) sheet
  const dataSheetNames = sheetNames.slice(1);
  const runs: RunData[] = [];

  for (let i = 0; i < dataSheetNames.length; i++) {
    const sheetName = dataSheetNames[i];
    const headers = getSheetHeadersFromBuffer(data, sheetName);
    const mapping = autoDetectMapping(headers);

    const { features, errors, warnings } = parseSheetFromBuffer(data, sheetName, mapping);

    // Skip sheets with critical errors or no features
    if (errors.filter(e => e.severity === 'error').length > 0 || features.length === 0) {
      console.warn(`Skipping sheet "${sheetName}": ${errors.map(e => e.message).join(', ') || 'no features'}`);
      continue;
    }

    const meta = metadata[i] || FALLBACK_METADATA[i] || { startDate: '', vendor: 'Unknown', toolType: '' };
    const runNumber = runs.length + 1;

    runs.push({
      id: `run-${runNumber}`,
      name: `Run ${runNumber} — ${meta.vendor} ${meta.toolType}`,
      fileName: 'ILIDataV2.xlsx',
      date: meta.startDate || undefined,
      features: features.sort((a, b) => a.distance - b.distance),
      units: 'feet',
      sheetName,
      columnMapping: mapping,
      validationErrors: errors,
      validationWarnings: warnings,
    });
  }

  if (runs.length < 2) {
    throw new Error(`Only ${runs.length} valid data sheets found. Need at least 2 for alignment.`);
  }

  return runs;
}

// Keep the synthetic generator as a fallback
export { generateSyntheticData } from './synthetic-data';
