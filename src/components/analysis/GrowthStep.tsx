import { useAnalysis } from '@/context/AnalysisContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, AlertTriangle, Plus, Minus, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const exceptionConfig: Record<string, { color: string; Icon: LucideIcon }> = {
  NEW: { color: 'bg-info', Icon: Plus },
  MISSING: { color: 'bg-warning', Icon: Minus },
  UNCERTAIN: { color: 'bg-confidence-uncertain', Icon: HelpCircle },
  RAPID_GROWTH: { color: 'bg-destructive', Icon: TrendingUp },
};

export function GrowthStep() {
  const { state, dispatch } = useAnalysis();

  if (state.growthResults.length === 0 && state.exceptions.length === 0) {
    return <p className="text-muted-foreground">No growth data yet.</p>;
  }

  const hasRates = state.growthResults.some(g => g.depth_rate != null);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Growth & Exceptions</h2>
        <p className="text-muted-foreground">
          {state.growthResults.length} growth calculations, {state.exceptions.length} exceptions flagged
          {hasRates && state.growthResults[0]?.years_between != null &&
            ` (${state.growthResults[0].years_between.toFixed(1)} years between runs)`}
        </p>
      </div>

      {state.qualityMetrics && (
        <div className="grid gap-3 md:grid-cols-5">
          <MiniMetric label="High Confidence" value={state.qualityMetrics.matchedHigh} color="text-success" />
          <MiniMetric label="Medium" value={state.qualityMetrics.matchedMed} color="text-info" />
          <MiniMetric label="Low" value={state.qualityMetrics.matchedLow} color="text-warning" />
          <MiniMetric label="Uncertain" value={state.qualityMetrics.uncertain} color="text-destructive" />
          <MiniMetric label="Rapid Growth" value={state.qualityMetrics.rapidGrowth} color="text-destructive" />
        </div>
      )}

      <Tabs defaultValue="growth">
        <TabsList>
          <TabsTrigger value="growth">Growth ({state.growthResults.length})</TabsTrigger>
          <TabsTrigger value="exceptions">Exceptions ({state.exceptions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="growth">
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[450px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sticky top-0 bg-card z-10">Group</TableHead>
                      <TableHead className="text-xs sticky top-0 bg-card z-10 font-mono">Depth Δ (%)</TableHead>
                      <TableHead className="text-xs sticky top-0 bg-card z-10 font-mono">Length Δ</TableHead>
                      <TableHead className="text-xs sticky top-0 bg-card z-10 font-mono">Width Δ</TableHead>
                      {hasRates && (
                        <>
                          <TableHead className="text-xs sticky top-0 bg-card z-10 font-mono">Depth/yr</TableHead>
                          <TableHead className="text-xs sticky top-0 bg-card z-10 font-mono">Length/yr</TableHead>
                        </>
                      )}
                      <TableHead className="text-xs sticky top-0 bg-card z-10">Flag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.growthResults.map(gr => (
                      <TableRow key={gr.group_id} className={gr.flag ? 'bg-destructive/5' : ''}>
                        <TableCell className="text-xs font-mono">{gr.group_id}</TableCell>
                        <TableCell className={cn('text-xs font-mono', gr.depth_delta != null && gr.depth_delta > 0 ? 'text-destructive' : '')}>
                          {gr.depth_delta != null ? (gr.depth_delta > 0 ? '+' : '') + gr.depth_delta.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {gr.length_delta != null ? (gr.length_delta > 0 ? '+' : '') + gr.length_delta.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {gr.width_delta != null ? (gr.width_delta > 0 ? '+' : '') + gr.width_delta.toFixed(2) : '—'}
                        </TableCell>
                        {hasRates && (
                          <>
                            <TableCell className="text-xs font-mono">
                              {gr.depth_rate != null ? gr.depth_rate.toFixed(3) : '—'}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {gr.length_rate != null ? gr.length_rate.toFixed(3) : '—'}
                            </TableCell>
                          </>
                        )}
                        <TableCell>
                          {gr.flag && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {gr.flag}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exceptions">
          <div className="space-y-3">
            {state.exceptions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No exceptions found.</p>
            ) : (
              state.exceptions.map((exc, i) => {
                const config = exceptionConfig[exc.type] || exceptionConfig.UNCERTAIN;
                const { Icon } = config;
                return (
                  <Card key={i}>
                    <CardContent className="flex items-start gap-4 p-4">
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-accent-foreground', config.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={cn('text-xs text-accent-foreground', config.color)}>
                            {exc.type}
                          </Badge>
                          <span className="text-xs font-mono text-muted-foreground">{exc.feature.feature_id}</span>
                        </div>
                        <p className="text-sm text-foreground">{exc.details}</p>
                        <p className="text-xs text-accent mt-1">{exc.recommendation}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end pt-4 border-t">
        <Button variant="accent" size="lg" onClick={() => dispatch({ type: 'SET_STEP', step: 4 })}>
          Continue to Export →
        </Button>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className={cn('text-2xl font-bold font-mono', color)}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
