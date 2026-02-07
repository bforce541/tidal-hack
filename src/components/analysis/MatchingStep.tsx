import { useState } from 'react';
import { useAnalysis } from '@/context/AnalysisContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Loader2 } from 'lucide-react';
import { MatchedGroup, ConfidenceLevel } from '@/lib/types';
import { cn } from '@/lib/utils';

const confidenceColors: Record<ConfidenceLevel, string> = {
  HIGH: 'bg-confidence-high',
  MED: 'bg-confidence-med',
  LOW: 'bg-confidence-low',
  UNCERTAIN: 'bg-confidence-uncertain',
};

export function MatchingStep() {
  const { state, runGrowthAnalysis } = useAnalysis();
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<MatchedGroup | null>(null);

  if (state.matchedGroups.length === 0) {
    return <p className="text-muted-foreground">No matching results yet. Run alignment first.</p>;
  }

  const filtered = state.matchedGroups.filter(g =>
    confidenceFilter === 'all' ? true : g.confidence === confidenceFilter
  );

  const runs = state.runs;
  const counts = {
    HIGH: state.matchedGroups.filter(g => g.confidence === 'HIGH').length,
    MED: state.matchedGroups.filter(g => g.confidence === 'MED').length,
    LOW: state.matchedGroups.filter(g => g.confidence === 'LOW').length,
    UNCERTAIN: state.matchedGroups.filter(g => g.confidence === 'UNCERTAIN').length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Matched Anomalies</h2>
          <p className="text-muted-foreground">
            {state.matchedGroups.length} matched groups across {runs.length} runs
          </p>
        </div>
        <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Filter confidence" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Confidence</SelectItem>
            <SelectItem value="HIGH">HIGH only</SelectItem>
            <SelectItem value="MED">MED only</SelectItem>
            <SelectItem value="LOW">LOW only</SelectItem>
            <SelectItem value="UNCERTAIN">UNCERTAIN only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline">Total: {state.matchedGroups.length}</Badge>
        <Badge className={cn('text-accent-foreground', confidenceColors.HIGH)}>HIGH: {counts.HIGH}</Badge>
        <Badge className={cn('text-accent-foreground', confidenceColors.MED)}>MED: {counts.MED}</Badge>
        <Badge className={cn('text-accent-foreground', confidenceColors.LOW)}>LOW: {counts.LOW}</Badge>
        <Badge className={cn('text-accent-foreground', confidenceColors.UNCERTAIN)}>UNCERTAIN: {counts.UNCERTAIN}</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sticky top-0 bg-card z-10">Group</TableHead>
                  {runs.map(r => (
                    <TableHead key={r.id} className="text-xs sticky top-0 bg-card z-10">{r.name} ID</TableHead>
                  ))}
                  <TableHead className="text-xs sticky top-0 bg-card z-10 font-mono">Corr. Dist</TableHead>
                  <TableHead className="text-xs sticky top-0 bg-card z-10">Type</TableHead>
                  <TableHead className="text-xs sticky top-0 bg-card z-10 font-mono">Score</TableHead>
                  <TableHead className="text-xs sticky top-0 bg-card z-10">Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((group) => {
                  const firstFeature = Object.values(group.features).find(f => f != null);
                  const firstDist = Object.values(group.correctedDistances).find(d => d != null);
                  return (
                    <TableRow
                      key={group.group_id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedGroup(group)}
                    >
                      <TableCell className="text-xs font-mono">{group.group_id}</TableCell>
                      {runs.map(r => (
                        <TableCell key={r.id} className="text-xs font-mono">
                          {group.features[r.id]?.feature_id ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      ))}
                      <TableCell className="text-xs font-mono">{firstDist?.toFixed(2) ?? '—'}</TableCell>
                      <TableCell className="text-xs">{firstFeature?.feature_type ?? '—'}</TableCell>
                      <TableCell className="text-xs font-mono font-medium">{group.score.toFixed(3)}</TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs text-accent-foreground', confidenceColors[group.confidence])}>
                          {group.confidence}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
        <SheetContent className="w-[480px] sm:max-w-lg overflow-auto">
          <SheetHeader>
            <SheetTitle>Match Detail: {selectedGroup?.group_id}</SheetTitle>
          </SheetHeader>
          {selectedGroup && (
            <div className="mt-6 space-y-6">
              <div>
                <h4 className="text-sm font-semibold mb-3">Score Breakdown</h4>
                <div className="space-y-2.5">
                  {[
                    { label: 'Distance', value: selectedGroup.components.distance_score },
                    { label: 'Clock Position', value: selectedGroup.components.clock_score },
                    { label: 'Feature Type', value: selectedGroup.components.type_score },
                    { label: 'Dimensions', value: selectedGroup.components.dims_score },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-24">{item.label}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{ width: `${item.value * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono w-10 text-right">{item.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs font-mono mt-2 text-muted-foreground">
                  Total: {selectedGroup.score.toFixed(3)} — {selectedGroup.confidence}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3">Per-Run Features</h4>
                {runs.map(run => {
                  const feature = selectedGroup.features[run.id];
                  if (!feature) return (
                    <Card key={run.id} className="mb-2">
                      <CardContent className="p-3 text-xs text-muted-foreground">
                        {run.name}: Not matched
                      </CardContent>
                    </Card>
                  );
                  return (
                    <Card key={run.id} className="mb-2">
                      <CardContent className="p-3 space-y-1">
                        <p className="text-xs font-medium text-foreground">{run.name}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground font-mono">
                          <span>ID: {feature.feature_id}</span>
                          <span>Dist: {(feature.corrected_distance ?? feature.distance).toFixed(2)}</span>
                          <span>Clock: {feature.clock_position ?? '—'}</span>
                          <span>Type: {feature.feature_type}</span>
                          <span>Depth: {feature.depth_percent?.toFixed(1) ?? '—'}%</span>
                          <span>Len: {feature.length?.toFixed(2) ?? '—'}</span>
                          <span>Wid: {feature.width?.toFixed(2) ?? '—'}</span>
                          <span>WT: {feature.wall_thickness?.toFixed(3) ?? '—'}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Explanation</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{selectedGroup.explanation}</p>
              </div>

              {selectedGroup.alternativeCandidates.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">
                    Alternative Candidates ({selectedGroup.alternativeCandidates.length})
                  </h4>
                  {selectedGroup.alternativeCandidates.map((alt, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-muted/50 mb-1">
                      <span className="font-mono">{alt.feature.feature_id}</span>
                      <span className="font-mono text-muted-foreground">Score: {alt.score.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <div className="flex justify-end pt-4 border-t">
        <Button variant="accent" size="lg" onClick={runGrowthAnalysis} disabled={state.isProcessing}>
          {state.isProcessing ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
          ) : (
            'Calculate Growth & Flag Exceptions →'
          )}
        </Button>
      </div>
    </div>
  );
}
