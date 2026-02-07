import { useAnalysis } from '@/context/AnalysisContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Anchor, TrendingUp, Maximize2, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { LucideIcon } from 'lucide-react';

export function AlignmentStep() {
  const { state, runMatching } = useAnalysis();

  if (state.alignments.length === 0) {
    return (
      <p className="text-muted-foreground">
        No alignment results yet. Upload data and run alignment first.
      </p>
    );
  }

  const alignment = state.alignments[0];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Alignment Results</h2>
        <p className="text-muted-foreground">
          Reference-point matching between {state.runs[0]?.name} and {state.runs[1]?.name}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={Anchor} label="Anchors Matched" value={String(alignment.quality.anchorCount)} />
        <MetricCard icon={TrendingUp} label="Avg Drift" value={`${alignment.quality.avgDriftError.toFixed(2)} ft`} />
        <MetricCard icon={Maximize2} label="Max Drift" value={`${alignment.quality.maxDrift.toFixed(2)} ft`} />
        <MetricCard icon={BarChart3} label="Coverage" value={`${(alignment.quality.coverage * 100).toFixed(0)}%`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Drift Plot (Piecewise Linear Correction Function)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={alignment.driftPoints}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="distance"
                  label={{ value: 'Baseline Distance (ft)', position: 'insideBottom', offset: -5, style: { fontSize: 12, fill: 'hsl(var(--muted-foreground))' } }}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  dataKey="drift"
                  label={{ value: 'Drift (ft)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: 'hsl(var(--muted-foreground))' } }}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`${value.toFixed(3)} ft`, 'Drift']}
                  labelFormatter={(label) => `Distance: ${Number(label).toFixed(1)} ft`}
                />
                <Line
                  type="monotone"
                  dataKey="drift"
                  stroke="hsl(var(--accent))"
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'hsl(var(--accent))' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Anchor Matches ({alignment.anchorMatches.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Run A Anchor</TableHead>
                  <TableHead className="text-xs">Run B Anchor</TableHead>
                  <TableHead className="text-xs font-mono">Distance A</TableHead>
                  <TableHead className="text-xs font-mono">Distance B</TableHead>
                  <TableHead className="text-xs font-mono">Drift</TableHead>
                  <TableHead className="text-xs font-mono">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alignment.anchorMatches.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-mono">{m.anchorA.feature_id}</TableCell>
                    <TableCell className="text-xs font-mono">{m.anchorB.feature_id}</TableCell>
                    <TableCell className="text-xs font-mono">{m.distanceA.toFixed(2)}</TableCell>
                    <TableCell className="text-xs font-mono">{m.distanceB.toFixed(2)}</TableCell>
                    <TableCell className="text-xs font-mono">{m.drift.toFixed(3)}</TableCell>
                    <TableCell className="text-xs font-mono">{m.score.toFixed(3)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-4 border-t">
        <Button variant="accent" size="lg" onClick={runMatching} disabled={state.isProcessing}>
          {state.isProcessing ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
          ) : (
            'Apply Correction & Match Anomalies →'
          )}
        </Button>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 shrink-0">
          <Icon className="h-5 w-5 text-accent" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold font-mono text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
