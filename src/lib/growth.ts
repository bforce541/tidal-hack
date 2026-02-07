import { MatchedGroup, GrowthResult, PipelineException, Settings, RunData, RawFeature } from './types';

export function calculateGrowth(
  matchedGroups: MatchedGroup[],
  runs: RunData[],
  settings: Settings
): { growthResults: GrowthResult[]; exceptions: PipelineException[] } {
  const growthResults: GrowthResult[] = [];
  const exceptions: PipelineException[] = [];

  const sortedRuns = [...runs].sort((a, b) => {
    if (a.date && b.date) return new Date(a.date).getTime() - new Date(b.date).getTime();
    return 0;
  });

  const firstRunId = sortedRuns[0].id;
  const lastRunId = sortedRuns[sortedRuns.length - 1].id;

  let yearsBetween: number | null = null;
  if (sortedRuns[0].date && sortedRuns[sortedRuns.length - 1].date) {
    const d1 = new Date(sortedRuns[0].date);
    const d2 = new Date(sortedRuns[sortedRuns.length - 1].date);
    yearsBetween = (d2.getTime() - d1.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  }

  for (const group of matchedGroups) {
    const featureFirst = group.features[firstRunId];
    const featureLast = group.features[lastRunId];
    if (!featureFirst || !featureLast) continue;

    const depth_delta = featureLast.depth_percent != null && featureFirst.depth_percent != null
      ? featureLast.depth_percent - featureFirst.depth_percent : null;
    const length_delta = featureLast.length != null && featureFirst.length != null
      ? featureLast.length - featureFirst.length : null;
    const width_delta = featureLast.width != null && featureFirst.width != null
      ? featureLast.width - featureFirst.width : null;

    const gr: GrowthResult = {
      group_id: group.group_id,
      depth_delta,
      length_delta,
      width_delta,
      depth_rate: yearsBetween && depth_delta !== null ? depth_delta / yearsBetween : null,
      length_rate: yearsBetween && length_delta !== null ? length_delta / yearsBetween : null,
      width_rate: yearsBetween && width_delta !== null ? width_delta / yearsBetween : null,
      years_between: yearsBetween,
      flag: null,
    };

    if ((depth_delta !== null && Math.abs(depth_delta) > settings.rapidGrowthDepth) ||
        (length_delta !== null && Math.abs(length_delta) > settings.rapidGrowthLength)) {
      gr.flag = 'RAPID_GROWTH';
      exceptions.push({
        type: 'RAPID_GROWTH',
        feature: featureLast,
        runId: lastRunId,
        details: `Depth Δ: ${depth_delta?.toFixed(1)}%, Length Δ: ${length_delta?.toFixed(2)}`,
        recommendation: 'Manual review recommended. Consider scheduling repair or more frequent inspections.',
        matchedGroup: group,
      });
    }

    growthResults.push(gr);
  }

  return { growthResults, exceptions };
}

export function findExceptions(
  matchedGroups: MatchedGroup[],
  unmatchedByRun: Record<string, RawFeature[]>,
  runs: RunData[],
  growthExceptions: PipelineException[]
): PipelineException[] {
  const exceptions: PipelineException[] = [...growthExceptions];
  const sortedRuns = [...runs].sort((a, b) => {
    if (a.date && b.date) return new Date(a.date).getTime() - new Date(b.date).getTime();
    return 0;
  });

  for (let i = 1; i < sortedRuns.length; i++) {
    const runId = sortedRuns[i].id;
    const unmatched = unmatchedByRun[runId] || [];
    for (const f of unmatched) {
      exceptions.push({
        type: 'NEW',
        feature: f,
        runId,
        details: `Feature ${f.feature_id} found in ${sortedRuns[i].name} but not in earlier runs.`,
        recommendation: 'Verify this is a newly developed anomaly. Check for possible alignment issues.',
      });
    }
  }

  if (sortedRuns.length > 0) {
    const firstRunId = sortedRuns[0].id;
    const unmatched = unmatchedByRun[firstRunId] || [];
    for (const f of unmatched) {
      exceptions.push({
        type: 'MISSING',
        feature: f,
        runId: firstRunId,
        details: `Feature ${f.feature_id} found in ${sortedRuns[0].name} but not in later runs.`,
        recommendation: 'Verify if anomaly was repaired, or if this is a detection/alignment issue.',
      });
    }
  }

  for (const group of matchedGroups) {
    if (group.confidence === 'UNCERTAIN') {
      const features = Object.entries(group.features).filter(([, f]) => f != null);
      if (features.length > 0) {
        exceptions.push({
          type: 'UNCERTAIN',
          feature: features[0][1]!,
          runId: features[0][0],
          details: `Match score ${group.score.toFixed(3)} below threshold. ${group.alternativeCandidates.length} alternatives exist.`,
          recommendation: 'Manual review recommended. Compare alternative candidates.',
          matchedGroup: group,
        });
      }
    }
  }

  return exceptions;
}
