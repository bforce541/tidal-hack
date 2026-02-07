import { useAnalysis } from '@/context/AnalysisContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const exceptionStyles: Record<string, string> = {
  NEW: 'bg-info text-accent-foreground',
  MISSING: 'bg-warning text-accent-foreground',
  UNCERTAIN: 'bg-confidence-uncertain text-accent-foreground',
  RAPID_GROWTH: 'bg-destructive text-destructive-foreground',
};

export function GrowthStep() {
  const { state, dispatch } = useAnalysis();

  if (state.growthResults.length === 0 && state.exceptions.length === 0) {
    return <p className="text-xs text-muted-foreground">No growth data yet.</p>;
  }

  const hasRates = state.growthResults.some(g => g.depth_rate != null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Growth & Exceptions</h2>
          <p className="text-2xs text-muted-foreground mt-0.5">
            {state.growthResults.length} growth records · {state.exceptions.length} exceptions
            {hasRates && state.growthResults[0]?.years_between != null && ` · ${state.growthResults[0].years_between.toFixed(1)}yr span`}
          </p>
        </div>
        <Button variant="default" size="sm" onClick={() => dispatch({ type: 'SET_STEP', step: 4 })} className="font-mono text-xs uppercase tracking-wider">
          Export →
        </Button>
      </div>

      {/* Summary bar */}
      {state.qualityMetrics && (
        <div className="flex gap-6 border-b pb-3">
          <MetricInline label="HIGH" value={state.qualityMetrics.matchedHigh} color="text-success" />
          <MetricInline label="MED" value={state.qualityMetrics.matchedMed} color="text-info" />
          <MetricInline label="LOW" value={state.qualityMetrics.matchedLow} color="text-warning" />
          <MetricInline label="UNCERTAIN" value={state.qualityMetrics.uncertain} color="text-destructive" />
          <MetricInline label="NEW" value={state.qualityMetrics.newAnomalies} />
          <MetricInline label="MISSING" value={state.qualityMetrics.missingAnomalies} />
          <MetricInline label="RAPID" value={state.qualityMetrics.rapidGrowth} color="text-destructive" />
        </div>
      )}

      <Tabs defaultValue="growth">
        <TabsList className="h-7">
          <TabsTrigger value="growth" className="text-2xs font-mono uppercase">Growth ({state.growthResults.length})</TabsTrigger>
          <TabsTrigger value="exceptions" className="text-2xs font-mono uppercase">Exceptions ({state.exceptions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="growth" className="mt-3">
          <div className="border bg-card">
            <div className="max-h-[calc(100vh-280px)] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10">Group</TableHead>
                    <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10">Depth Δ%</TableHead>
                    <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10">Len Δ</TableHead>
                    <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10">Wid Δ</TableHead>
                    {hasRates && <>
                      <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10">Depth/yr</TableHead>
                      <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10">Len/yr</TableHead>
                    </>}
                    <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10">Flag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.growthResults.map(gr => (
                    <TableRow key={gr.group_id} className={gr.flag ? 'bg-destructive/5' : ''}>
                      <TableCell className="font-mono-data">{gr.group_id}</TableCell>
                      <TableCell className={cn('font-mono-data', gr.depth_delta != null && gr.depth_delta > 0 ? 'text-destructive' : '')}>
                        {gr.depth_delta != null ? (gr.depth_delta > 0 ? '+' : '') + gr.depth_delta.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell className="font-mono-data">
                        {gr.length_delta != null ? (gr.length_delta > 0 ? '+' : '') + gr.length_delta.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell className="font-mono-data">
                        {gr.width_delta != null ? (gr.width_delta > 0 ? '+' : '') + gr.width_delta.toFixed(2) : '—'}
                      </TableCell>
                      {hasRates && <>
                        <TableCell className="font-mono-data">{gr.depth_rate != null ? gr.depth_rate.toFixed(3) : '—'}</TableCell>
                        <TableCell className="font-mono-data">{gr.length_rate != null ? gr.length_rate.toFixed(3) : '—'}</TableCell>
                      </>}
                      <TableCell>
                        {gr.flag && (
                          <span className="inline-flex items-center gap-0.5 px-1 text-2xs font-mono bg-destructive text-destructive-foreground">
                            <AlertTriangle className="h-2.5 w-2.5" />{gr.flag}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="exceptions" className="mt-3">
          {state.exceptions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center border">No exceptions.</p>
          ) : (
            <div className="border bg-card">
              <div className="max-h-[calc(100vh-280px)] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10 w-24">Type</TableHead>
                      <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10">Feature</TableHead>
                      <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10">Details</TableHead>
                      <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.exceptions.map((exc, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <span className={cn('inline-block px-1.5 py-0 text-2xs font-mono', exceptionStyles[exc.type] || '')}>
                            {exc.type}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono-data">{exc.feature.feature_id}</TableCell>
                        <TableCell className="text-2xs text-muted-foreground max-w-xs truncate">{exc.details}</TableCell>
                        <TableCell className="text-2xs text-accent">{exc.recommendation}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricInline({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-mono font-semibold', color || 'text-foreground')}>{value}</span>
    </div>
  );
}
