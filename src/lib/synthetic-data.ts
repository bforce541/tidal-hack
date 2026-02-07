import { RunData, RawFeature } from './types';

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function choice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clockDegToStr(deg: number): string {
  const n = ((deg % 360) + 360) % 360;
  const totalMinutes = n / 0.5;
  const hours = Math.floor(totalMinutes / 60) || 12;
  const minutes = Math.round(totalMinutes % 60);
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

const ANOMALY_TYPES = ['Metal Loss', 'Dent', 'Gouge', 'Lamination', 'Crack'];

export function generateSyntheticData(): RunData[] {
  const jointSpacing = 40;
  const pipelineLength = 2000;
  const numJoints = Math.floor(pipelineLength / jointSpacing);
  const numAnomalies = 50;

  const baseAnchors: { distance: number; joint_number: number }[] = [];
  for (let i = 0; i < numJoints; i++) {
    baseAnchors.push({ distance: i * jointSpacing + rand(-0.5, 0.5), joint_number: i + 1 });
  }

  const baseAnomalies: { distance: number; clock_deg: number; type: string; depth: number; length: number; width: number; wt: number }[] = [];
  for (let i = 0; i < numAnomalies; i++) {
    baseAnomalies.push({
      distance: rand(20, pipelineLength - 20),
      clock_deg: rand(0, 360),
      type: choice(ANOMALY_TYPES),
      depth: rand(5, 40),
      length: rand(0.5, 6),
      width: rand(0.3, 3),
      wt: rand(0.25, 0.5),
    });
  }
  baseAnomalies.sort((a, b) => a.distance - b.distance);

  const run1Features: RawFeature[] = [];
  for (const anchor of baseAnchors) {
    run1Features.push({
      feature_id: `R1-GW-${anchor.joint_number}`,
      distance: anchor.distance,
      joint_number: anchor.joint_number,
      clock_position: '12:00',
      clock_position_deg: 0,
      feature_type: 'Girth Weld',
      is_reference: true,
      relative_position: 0,
      weld_type: 'Girth Weld',
    });
  }
  for (let i = 0; i < baseAnomalies.length; i++) {
    const a = baseAnomalies[i];
    const uw = baseAnchors.filter(w => w.distance <= a.distance).pop();
    run1Features.push({
      feature_id: `R1-A-${String(i + 1).padStart(3, '0')}`,
      distance: a.distance,
      joint_number: uw?.joint_number,
      relative_position: uw ? a.distance - uw.distance : undefined,
      clock_position: clockDegToStr(a.clock_deg),
      clock_position_deg: a.clock_deg,
      feature_type: a.type,
      depth_percent: a.depth,
      length: a.length,
      width: a.width,
      wall_thickness: a.wt,
      is_reference: false,
    });
  }

  const driftFn = (dist: number): number => 0.5 + 0.003 * dist + 0.8 * Math.sin(dist / 500);
  const run2Features: RawFeature[] = [];
  const missingIndices = new Set([3, 12, 27]);

  for (const anchor of baseAnchors) {
    const drift = driftFn(anchor.distance);
    run2Features.push({
      feature_id: `R2-GW-${anchor.joint_number}`,
      distance: anchor.distance + drift + rand(-0.1, 0.1),
      joint_number: anchor.joint_number,
      clock_position: '12:00',
      clock_position_deg: 0,
      feature_type: 'Girth Weld',
      is_reference: true,
      relative_position: 0,
      weld_type: 'Girth Weld',
    });
  }

  for (let i = 0; i < baseAnomalies.length; i++) {
    if (missingIndices.has(i)) continue;
    const a = baseAnomalies[i];
    const drift = driftFn(a.distance);
    const growth = rand(0, 8);
    const uw = baseAnchors.filter(w => w.distance <= a.distance).pop();
    run2Features.push({
      feature_id: `R2-A-${String(i + 1).padStart(3, '0')}`,
      distance: a.distance + drift + rand(-0.3, 0.3),
      joint_number: uw?.joint_number,
      relative_position: uw ? a.distance + drift - (uw.distance + driftFn(uw.distance)) : undefined,
      clock_position: clockDegToStr(a.clock_deg + rand(-5, 5)),
      clock_position_deg: a.clock_deg + rand(-5, 5),
      feature_type: a.type,
      depth_percent: a.depth + growth,
      length: a.length + rand(0, 1),
      width: a.width + rand(0, 0.5),
      wall_thickness: a.wt,
      is_reference: false,
    });
  }

  for (let i = 0; i < 4; i++) {
    const dist = rand(50, pipelineLength - 50);
    run2Features.push({
      feature_id: `R2-NEW-${i + 1}`,
      distance: dist + driftFn(dist),
      clock_position: clockDegToStr(rand(0, 360)),
      clock_position_deg: rand(0, 360),
      feature_type: choice(ANOMALY_TYPES),
      depth_percent: rand(5, 25),
      length: rand(0.5, 3),
      width: rand(0.3, 2),
      wall_thickness: rand(0.25, 0.5),
      is_reference: false,
    });
  }

  return [
    {
      id: 'run-1',
      name: 'Run 1 (Baseline)',
      fileName: 'synthetic_run1.xlsx',
      date: '2019-06-15',
      features: run1Features.sort((a, b) => a.distance - b.distance),
      units: 'feet',
      sheetName: 'ILI Data',
      columnMapping: {} as any,
      validationErrors: [],
      validationWarnings: [],
    },
    {
      id: 'run-2',
      name: 'Run 2 (Re-inspection)',
      fileName: 'synthetic_run2.xlsx',
      date: '2024-03-20',
      features: run2Features.sort((a, b) => a.distance - b.distance),
      units: 'feet',
      sheetName: 'ILI Data',
      columnMapping: {} as any,
      validationErrors: [],
      validationWarnings: [],
    },
  ];
}
