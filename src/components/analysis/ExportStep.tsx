import { useAnalysis } from '@/context/AnalysisContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, FileSpreadsheet, FileJson, FileText } from 'lucide-react';
import { exportMatchedResults, exportDriftMap, exportExceptions, exportSummary } from '@/lib/export-utils';
import type { LucideIcon } from 'lucide-react';

export function ExportStep() {
  const { state } = useAnalysis();

  if (!state.qualityMetrics) {
    return <p className="text-muted-foreground">Complete the analysis first to export results.</p>;
  }

  const exports: { icon: LucideIcon; title: string; desc: string; onClick: () => void }[] = [
    {
      icon: FileSpreadsheet,
      title: 'Matched Results (XLSX)',
      desc: 'Complete matched dataset with growth calculations and confidence scores.',
      onClick: () => exportMatchedResults(state.matchedGroups, state.growthResults, state.runs, 'xlsx'),
    },
    {
      icon: FileText,
      title: 'Matched Results (CSV)',
      desc: 'Same data in CSV format for easy import into other tools.',
      onClick: () => exportMatchedResults(state.matchedGroups, state.growthResults, state.runs, 'csv'),
    },
    {
      icon: FileJson,
      title: 'Alignment Drift Map (JSON)',
      desc: 'Correction function and anchor matches for each run pair.',
      onClick: () => exportDriftMap(state.alignments),
    },
    {
      icon: FileText,
      title: 'Exceptions Report (CSV)',
      desc: `${state.exceptions.length} exceptions including NEW, MISSING, UNCERTAIN, and RAPID_GROWTH.`,
      onClick: () => exportExceptions(state.exceptions),
    },
    {
      icon: FileJson,
      title: 'Summary Report (JSON)',
      desc: 'Quality metrics and analysis summary.',
      onClick: () => exportSummary(state.qualityMetrics!, state.runs),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Export Results</h2>
        <p className="text-muted-foreground">Download analysis outputs in various formats.</p>
      </div>

      <Card className="bg-accent/5 border-accent/20">
        <CardContent className="p-6">
          <h3 className="font-semibold text-foreground mb-3">Analysis Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Runs Analyzed</p>
              <p className="font-bold font-mono">{state.runs.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Anchors Matched</p>
              <p className="font-bold font-mono">{state.qualityMetrics.totalAnchors}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Anomalies Matched</p>
              <p className="font-bold font-mono">{state.qualityMetrics.totalAnomalies}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Exceptions</p>
              <p className="font-bold font-mono">{state.exceptions.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {exports.map((exp) => (
          <Card key={exp.title} className="hover:shadow-md transition-shadow">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                <exp.icon className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-foreground mb-1">{exp.title}</h4>
                <p className="text-xs text-muted-foreground mb-3">{exp.desc}</p>
                <Button variant="outline" size="sm" onClick={exp.onClick}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
