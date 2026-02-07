import { RawFeature, RunData, AnchorMatch, DriftPoint, AlignmentResult, AlignmentQuality, Settings } from './types';

const REFERENCE_TYPES = ['girth weld', 'girth_weld', 'weld', 'valve', 'tee', 'bend', 'cutout', 'flange'];

export function isReferencePoint(feature: RawFeature): boolean {
  const type = feature.feature_type.toLowerCase().trim();
  return REFERENCE_TYPES.some(rt => type.includes(rt)) || feature.is_reference;
}

export function getReferencePoints(run: RunData): RawFeature[] {
  return run.features.filter(isReferencePoint).sort((a, b) => a.distance - b.distance);
}

export function getAnomalies(run: RunData): RawFeature[] {
  return run.features.filter(f => !isReferencePoint(f)).sort((a, b) => (a.corrected_distance ?? a.distance) - (b.corrected_distance ?? b.distance));
}

export function matchAnchors(anchorsA: RawFeature[], anchorsB: RawFeature[], _settings: Settings): AnchorMatch[] {
  const matches: AnchorMatch[] = [];
  const usedB = new Set<number>();

  for (const anchorA of anchorsA) {
    let bestMatch: { index: number; score: number; anchorB: RawFeature } | null = null;

    for (let j = 0; j < anchorsB.length; j++) {
      if (usedB.has(j)) continue;
      const anchorB = anchorsB[j];
      let score = 0;
      let factors = 0;

      if (anchorA.joint_number != null && anchorB.joint_number != null) {
        const jDiff = Math.abs(anchorA.joint_number - anchorB.joint_number);
        score += jDiff === 0 ? 1 : jDiff <= 2 ? 0.5 : 0;
        factors++;
      }

      if (anchorA.weld_type && anchorB.weld_type) {
        score += anchorA.weld_type.toLowerCase() === anchorB.weld_type.toLowerCase() ? 1 : 0;
        factors++;
      }

      if (anchorA.feature_type && anchorB.feature_type) {
        score += anchorA.feature_type.toLowerCase() === anchorB.feature_type.toLowerCase() ? 1 : 0.3;
        factors++;
      }

      const maxDist = Math.max(
        anchorsA[anchorsA.length - 1]?.distance ?? 1,
        anchorsB[anchorsB.length - 1]?.distance ?? 1
      );
      const distDiff = Math.abs(anchorA.distance - anchorB.distance);
      const distScore = Math.max(0, 1 - distDiff / (maxDist * 0.1));
      score += distScore;
      factors++;

      const avgScore = factors > 0 ? score / factors : 0;
      if (avgScore > 0.3 && (!bestMatch || avgScore > bestMatch.score)) {
        bestMatch = { index: j, score: avgScore, anchorB };
      }
    }

    if (bestMatch) {
      usedB.add(bestMatch.index);
      matches.push({
        anchorA,
        anchorB: bestMatch.anchorB,
        distanceA: anchorA.distance,
        distanceB: bestMatch.anchorB.distance,
        drift: bestMatch.anchorB.distance - anchorA.distance,
        score: bestMatch.score,
      });
    }
  }

  return matches.sort((a, b) => a.distanceA - b.distanceA);
}

export function computeDriftPoints(anchorMatches: AnchorMatch[]): DriftPoint[] {
  return anchorMatches.map(m => ({
    distance: m.distanceA,
    drift: m.drift,
  }));
}

export function applyCorrectionFunction(distance: number, driftPoints: DriftPoint[]): number {
  if (driftPoints.length === 0) return distance;
  if (driftPoints.length === 1) return distance - driftPoints[0].drift;

  if (distance <= driftPoints[0].distance) {
    return distance - driftPoints[0].drift;
  }

  if (distance >= driftPoints[driftPoints.length - 1].distance) {
    return distance - driftPoints[driftPoints.length - 1].drift;
  }

  for (let i = 0; i < driftPoints.length - 1; i++) {
    const p1 = driftPoints[i];
    const p2 = driftPoints[i + 1];
    if (distance >= p1.distance && distance <= p2.distance) {
      const t = (distance - p1.distance) / (p2.distance - p1.distance);
      const interpolatedDrift = p1.drift + t * (p2.drift - p1.drift);
      return distance - interpolatedDrift;
    }
  }

  return distance - driftPoints[0].drift;
}

export function alignRuns(runA: RunData, runB: RunData, settings: Settings): AlignmentResult {
  const anchorsA = getReferencePoints(runA);
  const anchorsB = getReferencePoints(runB);
  const anchorMatches = matchAnchors(anchorsA, anchorsB, settings);
  const driftPoints = computeDriftPoints(anchorMatches);

  const avgDrift = driftPoints.length > 0
    ? driftPoints.reduce((sum, d) => sum + Math.abs(d.drift), 0) / driftPoints.length
    : 0;
  const maxDrift = driftPoints.length > 0
    ? Math.max(...driftPoints.map(d => Math.abs(d.drift)))
    : 0;
  const coverage = anchorsA.length > 0
    ? anchorMatches.length / Math.max(anchorsA.length, anchorsB.length)
    : 0;

  const quality: AlignmentQuality = {
    anchorCount: anchorMatches.length,
    avgDriftError: avgDrift,
    maxDrift,
    coverage,
    score: coverage * (anchorMatches.length > 0 ? anchorMatches.reduce((s, m) => s + m.score, 0) / anchorMatches.length : 0),
  };

  return { runAId: runA.id, runBId: runB.id, anchorMatches, driftPoints, quality };
}

export function applyCorrection(features: RawFeature[], driftPoints: DriftPoint[]): RawFeature[] {
  return features.map(f => ({
    ...f,
    corrected_distance: applyCorrectionFunction(f.distance, driftPoints),
  }));
}
