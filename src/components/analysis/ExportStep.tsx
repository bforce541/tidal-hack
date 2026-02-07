import { useAnalysis } from '@/context/AnalysisContext';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportMatchedResults, exportDriftMap, exportExceptions, exportSummary } from '@/lib/export-utils';

export function ExportStep() {
  const { state } = useAnalysis();

  if (!state.qualityMetrics) {
    return <p className="text-xs text-muted-foreground">Complete the analysis first.</p>;
  }

  const exports = [
    { label: 'Matched Results (XLSX)', desc: 'Full matched dataset + growth + confidence', onClick: () => exportMatchedResults(state.matchedGroups, state.growthResults, state.runs, 'xlsx') },
    { label: 'Matched Results (CSV)', desc: 'Same data in CSV format', onClick: () => exportMatchedResults(state.matchedGroups, state.growthResults, state.runs, 'csv') },
    { label: 'Drift Map (JSON)', desc: 'Correction function + anchor matches', onClick: () => exportDriftMap(state.alignments) },
    { label: 'Exceptions (CSV)', desc: `${state.exceptions.length} exceptions flagged`, onClick: () => exportExceptions(state.exceptions) },
    { label: 'Summary (JSON)', desc: 'Quality metrics + analysis summary', onClick: () => exportSummary(state.qualityMetrics!, state.runs) },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Export</h2>
        <p className="text-2xs text-muted-foreground mt-0.5">Download analysis outputs.</p>
      </div>

      {/* Summary stats */}
      <div className="border bg-card">
        <div className="border-b px-3 py-1.5 bg-muted/30">
          <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">Analysis Summary</span>
        </div>
        <div className="px-3 py-2 flex gap-8">
          <SumStat label="Runs" value={state.runs.length} />
          <SumStat label="Anchors" value={state.qualityMetrics.totalAnchors} />
          <SumStat label="Matched" value={state.qualityMetrics.totalAnomalies} />
          <SumStat label="High" value={state.qualityMetrics.matchedHigh} />
          <SumStat label="Med" value={state.qualityMetrics.matchedMed} />
          <SumStat label="Low" value={state.qualityMetrics.matchedLow} />
          <SumStat label="Uncertain" value={state.qualityMetrics.uncertain} />
          <SumStat label="Exceptions" value={state.exceptions.length} />
        </div>
      </div>

      {/* Export buttons */}
      <div className="border bg-card divide-y">
        {exports.map((exp) => (
          <div key={exp.label} className="flex items-center justify-between px-3 py-2">
            <div>
              <p className="text-xs font-medium text-foreground">{exp.label}</p>
              <p className="text-2xs text-muted-foreground">{exp.desc}</p>
            </div>
            <Button variant="outline" size="sm" onClick={exp.onClick} className="font-mono text-2xs uppercase tracking-wider h-7">
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SumStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-mono font-semibold text-foreground">{value}</p>
    </div>
  );
}
