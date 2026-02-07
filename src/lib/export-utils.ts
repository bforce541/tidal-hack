import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { MatchedGroup, GrowthResult, AlignmentResult, PipelineException, RunData, QualityMetrics } from './types';

export function exportMatchedResults(
  groups: MatchedGroup[],
  growth: GrowthResult[],
  runs: RunData[],
  format: 'csv' | 'xlsx'
) {
  const rows = groups.map(g => {
    const row: Record<string, string | number> = {
      group_id: g.group_id,
      score: parseFloat(g.score.toFixed(3)),
      confidence: g.confidence,
    };
    for (const run of runs) {
      const feature = g.features[run.id];
      const corrDist = g.correctedDistances[run.id];
      row[`${run.name}_feature_id`] = feature?.feature_id ?? '';
      row[`${run.name}_corrected_dist`] = corrDist != null ? parseFloat(corrDist.toFixed(2)) : '';
      row[`${run.name}_clock`] = feature?.clock_position ?? '';
      row[`${run.name}_type`] = feature?.feature_type ?? '';
      row[`${run.name}_depth%`] = feature?.depth_percent != null ? parseFloat(feature.depth_percent.toFixed(1)) : '';
      row[`${run.name}_length`] = feature?.length != null ? parseFloat(feature.length.toFixed(2)) : '';
      row[`${run.name}_width`] = feature?.width != null ? parseFloat(feature.width.toFixed(2)) : '';
    }
    const gr = growth.find(gr => gr.group_id === g.group_id);
    if (gr) {
      row.depth_delta = gr.depth_delta != null ? parseFloat(gr.depth_delta.toFixed(2)) : '';
      row.length_delta = gr.length_delta != null ? parseFloat(gr.length_delta.toFixed(2)) : '';
      row.width_delta = gr.width_delta != null ? parseFloat(gr.width_delta.toFixed(2)) : '';
      row.depth_rate_yr = gr.depth_rate != null ? parseFloat(gr.depth_rate.toFixed(3)) : '';
      row.growth_flag = gr.flag ?? '';
    }
    row.explanation = g.explanation;
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  if (format === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(ws);
    saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'matched_results.csv');
  } else {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Matched Results');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'matched_results.xlsx');
  }
}

export function exportDriftMap(alignments: AlignmentResult[]) {
  const data = alignments.map(a => ({
    runA: a.runAId,
    runB: a.runBId,
    anchors: a.anchorMatches.map(m => ({
      anchorA_id: m.anchorA.feature_id,
      anchorB_id: m.anchorB.feature_id,
      distanceA: m.distanceA,
      distanceB: m.distanceB,
      drift: m.drift,
      score: m.score,
    })),
    driftPoints: a.driftPoints,
    quality: a.quality,
  }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  saveAs(blob, 'alignment_drift.json');
}

export function exportExceptions(exceptions: PipelineException[]) {
  const rows = exceptions.map(e => ({
    type: e.type,
    feature_id: e.feature.feature_id,
    run_id: e.runId,
    distance: e.feature.distance,
    feature_type: e.feature.feature_type,
    details: e.details,
    recommendation: e.recommendation,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'exceptions.csv');
}

export function exportSummary(metrics: QualityMetrics, runs: RunData[]) {
  const summary = {
    runs: runs.map(r => ({ id: r.id, name: r.name, date: r.date, featureCount: r.features.length })),
    metrics,
    generated_at: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
  saveAs(blob, 'summary.json');
}
