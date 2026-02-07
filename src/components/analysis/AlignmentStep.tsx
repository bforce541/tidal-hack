import { useAnalysis } from '@/context/AnalysisContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function AlignmentStep() {
  const { state, runMatching } = useAnalysis();

  if (state.alignments.length === 0) {
    return <p className="text-xs text-muted-foreground">No alignment results. Upload data and run alignment first.</p>;
  }

  const alignment = state.alignments[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Alignment Results</h2>
          <p className="text-2xs text-muted-foreground mt-0.5">
            {state.runs[0]?.name} → {state.runs[1]?.name}
          </p>
        </div>
        <Button variant="default" size="sm" onClick={runMatching} disabled={state.isProcessing} className="font-mono text-xs uppercase tracking-wider">
          {state.isProcessing ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Processing</> : <>Match Anomalies →</>}
        </Button>
      </div>

      {/* Metrics bar */}
      <div className="flex gap-6 border-b pb-3">
        <MetricInline label="ANCHORS" value={String(alignment.quality.anchorCount)} />
        <MetricInline label="AVG DRIFT" value={`${alignment.quality.avgDriftError.toFixed(2)} ft`} />
        <MetricInline label="MAX DRIFT" value={`${alignment.quality.maxDrift.toFixed(2)} ft`} />
        <MetricInline label="COVERAGE" value={`${(alignment.quality.coverage * 100).toFixed(0)}%`} />
        <MetricInline label="SCORE" value={alignment.quality.score.toFixed(3)} />
      </div>

      {/* Drift plot */}
      <div className="border bg-card">
        <div className="border-b px-3 py-1.5 bg-muted/30">
          <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">Drift Correction Function</span>
        </div>
        <div className="p-3 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={alignment.driftPoints}>
              <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="distance"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                dataKey="drift"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                label={{ value: 'Drift (ft)', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
              />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 0, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                formatter={(value: number) => [`${value.toFixed(3)} ft`, 'Drift']}
                labelFormatter={(label) => `Dist: ${Number(label).toFixed(1)} ft`}
              />
              <Line type="linear" dataKey="drift" stroke="hsl(var(--accent))" strokeWidth={1.5} dot={{ r: 2, fill: 'hsl(var(--accent))', stroke: 'none' }} activeDot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Anchor table */}
      <div className="border bg-card">
        <div className="border-b px-3 py-1.5 bg-muted/30">
          <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
            Anchor Matches ({alignment.anchorMatches.length})
          </span>
        </div>
        <div className="max-h-56 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10">Run A</TableHead>
                <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10">Run B</TableHead>
                <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10">Dist A</TableHead>
                <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10">Dist B</TableHead>
                <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10">Drift</TableHead>
                <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alignment.anchorMatches.map((m, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono-data">{m.anchorA.feature_id}</TableCell>
                  <TableCell className="font-mono-data">{m.anchorB.feature_id}</TableCell>
                  <TableCell className="font-mono-data">{m.distanceA.toFixed(2)}</TableCell>
                  <TableCell className="font-mono-data">{m.distanceB.toFixed(2)}</TableCell>
                  <TableCell className="font-mono-data">{m.drift.toFixed(3)}</TableCell>
                  <TableCell className="font-mono-data">{m.score.toFixed(3)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function MetricInline({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-xs font-mono font-semibold text-foreground">{value}</span>
    </div>
  );
}
