import { RawFeature, MatchedGroup, MatchScoreComponents, ConfidenceLevel, AlternativeCandidate, Settings } from './types';

const COMPATIBLE_TYPES: Record<string, string[]> = {
  'metal loss': ['metal loss', 'corrosion', 'wall loss', 'external corrosion', 'internal corrosion'],
  'corrosion': ['metal loss', 'corrosion', 'wall loss', 'external corrosion', 'internal corrosion'],
  'dent': ['dent', 'deformation'],
  'gouge': ['gouge', 'scratch', 'mechanical damage'],
  'crack': ['crack', 'cracking', 'scc'],
  'lamination': ['lamination', 'inclusion'],
};

function areTypesCompatible(typeA: string, typeB: string): boolean {
  const a = typeA.toLowerCase().trim();
  const b = typeB.toLowerCase().trim();
  if (a === b) return true;
  const compatA = COMPATIBLE_TYPES[a] || [a];
  return compatA.includes(b);
}

function computeDistanceScore(distA: number, distB: number, tolerance: number): number {
  const diff = Math.abs(distA - distB);
  if (diff > tolerance) return 0;
  return 1 - diff / tolerance;
}

function computeClockScore(clockA: number, clockB: number, tolerance: number): number {
  let diff = Math.abs(clockA - clockB);
  if (diff > 180) diff = 360 - diff;
  if (diff > tolerance) return 0;
  return 1 - diff / tolerance;
}

function computeTypeScore(typeA: string, typeB: string): number {
  if (typeA.toLowerCase().trim() === typeB.toLowerCase().trim()) return 1;
  if (areTypesCompatible(typeA, typeB)) return 0.7;
  return 0;
}

function computeDimsScore(a: RawFeature, b: RawFeature): number {
  const scores: number[] = [];
  if (a.depth_percent != null && b.depth_percent != null) {
    const maxD = Math.max(a.depth_percent, b.depth_percent, 1);
    scores.push(1 - Math.abs(a.depth_percent - b.depth_percent) / maxD);
  }
  if (a.length != null && b.length != null) {
    const maxL = Math.max(a.length, b.length, 0.1);
    scores.push(1 - Math.min(1, Math.abs(a.length - b.length) / maxL));
  }
  if (a.width != null && b.width != null) {
    const maxW = Math.max(a.width, b.width, 0.1);
    scores.push(1 - Math.min(1, Math.abs(a.width - b.width) / maxW));
  }
  if (scores.length === 0) return 0.5;
  return scores.reduce((s, v) => s + v, 0) / scores.length;
}

function computeMatchScore(
  a: RawFeature, b: RawFeature,
  distA: number, distB: number,
  settings: Settings
): { score: number; components: MatchScoreComponents } {
  const components: MatchScoreComponents = {
    distance_score: computeDistanceScore(distA, distB, settings.distTolerance),
    clock_score: computeClockScore(a.clock_position_deg, b.clock_position_deg, settings.clockTolerance),
    type_score: computeTypeScore(a.feature_type, b.feature_type),
    dims_score: computeDimsScore(a, b),
  };
  const w = settings.weights;
  const score =
    w.distance * components.distance_score +
    w.clock * components.clock_score +
    w.type * components.type_score +
    w.dims * components.dims_score;

  return { score, components };
}

function getConfidence(score: number, settings: Settings): ConfidenceLevel {
  if (score >= settings.scoreThreshHigh) return 'HIGH';
  if (score >= settings.scoreThreshMed) return 'MED';
  if (score >= settings.scoreThreshLow) return 'LOW';
  return 'UNCERTAIN';
}

function buildExplanation(components: MatchScoreComponents, confidence: ConfidenceLevel): string {
  const parts: string[] = [];
  if (components.distance_score > 0.8) parts.push('Strong distance match');
  else if (components.distance_score > 0.5) parts.push('Moderate distance match');
  else parts.push('Weak distance match');

  if (components.clock_score > 0.8) parts.push('clock aligned');
  else if (components.clock_score > 0.5) parts.push('clock similar');
  else if (components.clock_score > 0) parts.push('clock differs');

  if (components.type_score >= 1) parts.push('exact type');
  else if (components.type_score > 0.5) parts.push('compatible types');
  else parts.push('type mismatch');

  if (components.dims_score > 0.8) parts.push('similar dims');
  else if (components.dims_score > 0.5) parts.push('dims moderate');

  return parts.join('; ') + `. Confidence: ${confidence}`;
}

interface CandidatePair {
  indexA: number;
  indexB: number;
  score: number;
  components: MatchScoreComponents;
}

export function matchAnomalies(
  anomaliesA: RawFeature[],
  anomaliesB: RawFeature[],
  runAId: string,
  runBId: string,
  settings: Settings
): { matched: MatchedGroup[]; unmatchedA: RawFeature[]; unmatchedB: RawFeature[] } {
  const n = anomaliesA.length;
  const m = anomaliesB.length;
  if (n === 0 || m === 0) {
    return { matched: [], unmatchedA: [...anomaliesA], unmatchedB: [...anomaliesB] };
  }

  const candidates: CandidatePair[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const distA = anomaliesA[i].corrected_distance ?? anomaliesA[i].distance;
      const distB = anomaliesB[j].corrected_distance ?? anomaliesB[j].distance;
      if (Math.abs(distA - distB) > settings.distTolerance) continue;

      const { score, components } = computeMatchScore(
        anomaliesA[i], anomaliesB[j], distA, distB, settings
      );
      if (score >= settings.scoreThreshLow * 0.5) {
        candidates.push({ indexA: i, indexB: j, score, components });
      }
    }
  }

  // DP order-preserving matching
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  const choice: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  const candidateMap = new Map<string, CandidatePair>();
  for (const c of candidates) {
    const key = `${c.indexA}-${c.indexB}`;
    const existing = candidateMap.get(key);
    if (!existing || c.score > existing.score) {
      candidateMap.set(key, c);
    }
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = dp[i - 1][j];
      choice[i][j] = 1;
      if (dp[i][j - 1] > dp[i][j]) {
        dp[i][j] = dp[i][j - 1];
        choice[i][j] = 2;
      }
      const cand = candidateMap.get(`${i - 1}-${j - 1}`);
      if (cand && dp[i - 1][j - 1] + cand.score > dp[i][j]) {
        dp[i][j] = dp[i - 1][j - 1] + cand.score;
        choice[i][j] = 3;
      }
    }
  }

  const matchedPairs: CandidatePair[] = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (choice[i][j] === 3) {
      const cand = candidateMap.get(`${i - 1}-${j - 1}`)!;
      matchedPairs.push(cand);
      i--; j--;
    } else if (choice[i][j] === 1) {
      i--;
    } else {
      j--;
    }
  }
  matchedPairs.reverse();

  const matchedIndicesA = new Set(matchedPairs.map(p => p.indexA));
  const matchedIndicesB = new Set(matchedPairs.map(p => p.indexB));

  const matched: MatchedGroup[] = matchedPairs.map((pair, idx) => {
    const featureA = anomaliesA[pair.indexA];
    const featureB = anomaliesB[pair.indexB];
    const confidence = getConfidence(pair.score, settings);

    const altCandidates: AlternativeCandidate[] = candidates
      .filter(c => c.indexA === pair.indexA && c.indexB !== pair.indexB)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(c => ({
        runId: runBId,
        feature: anomaliesB[c.indexB],
        score: c.score,
        components: c.components,
      }));

    return {
      group_id: `MG-${String(idx + 1).padStart(4, '0')}`,
      features: { [runAId]: featureA, [runBId]: featureB },
      correctedDistances: {
        [runAId]: featureA.corrected_distance ?? featureA.distance,
        [runBId]: featureB.corrected_distance ?? featureB.distance,
      },
      score: pair.score,
      confidence,
      components: pair.components,
      explanation: buildExplanation(pair.components, confidence),
      alternativeCandidates: altCandidates,
    };
  });

  const unmatchedA = anomaliesA.filter((_, idx) => !matchedIndicesA.has(idx));
  const unmatchedB = anomaliesB.filter((_, idx) => !matchedIndicesB.has(idx));

  return { matched, unmatchedA, unmatchedB };
}

export function extendMatchesToThreeRuns(
  matchedAB: MatchedGroup[],
  _unmatchedA: RawFeature[],
  _unmatchedB: RawFeature[],
  anomaliesC: RawFeature[],
  runAId: string,
  _runBId: string,
  runCId: string,
  settings: Settings
): { groups: MatchedGroup[]; unmatchedC: RawFeature[] } {
  const usedC = new Set<number>();
  const groups: MatchedGroup[] = [];

  for (const group of matchedAB) {
    const featureA = group.features[runAId];
    if (!featureA) {
      groups.push({ ...group, features: { ...group.features, [runCId]: null }, correctedDistances: { ...group.correctedDistances, [runCId]: null } });
      continue;
    }

    const distA = featureA.corrected_distance ?? featureA.distance;
    let bestC: { index: number; score: number; components: MatchScoreComponents } | null = null;

    for (let k = 0; k < anomaliesC.length; k++) {
      if (usedC.has(k)) continue;
      const fc = anomaliesC[k];
      const distC = fc.corrected_distance ?? fc.distance;
      if (Math.abs(distA - distC) > settings.distTolerance) continue;

      const { score, components } = computeMatchScore(featureA, fc, distA, distC, settings);
      if (score >= settings.scoreThreshLow * 0.5 && (!bestC || score > bestC.score)) {
        bestC = { index: k, score, components };
      }
    }

    const newGroup = { ...group };
    if (bestC) {
      usedC.add(bestC.index);
      newGroup.features = { ...newGroup.features, [runCId]: anomaliesC[bestC.index] };
      newGroup.correctedDistances = {
        ...newGroup.correctedDistances,
        [runCId]: anomaliesC[bestC.index].corrected_distance ?? anomaliesC[bestC.index].distance,
      };
      newGroup.score = (newGroup.score + bestC.score) / 2;
      newGroup.confidence = getConfidence(newGroup.score, settings);
    } else {
      newGroup.features = { ...newGroup.features, [runCId]: null };
      newGroup.correctedDistances = { ...newGroup.correctedDistances, [runCId]: null };
    }
    groups.push(newGroup);
  }

  const unmatchedC = anomaliesC.filter((_, idx) => !usedC.has(idx));
  return { groups, unmatchedC };
}
