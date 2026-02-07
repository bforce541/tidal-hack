import { useState } from 'react';
import { useAnalysis } from '@/context/AnalysisContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, X } from 'lucide-react';
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
    return <p className="text-xs text-muted-foreground">No matching results yet.</p>;
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
    <div className="flex gap-4 h-full">
      {/* Main table */}
      <div className="flex-1 min-w-0 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-foreground">Matched Anomalies</h2>
            <div className="flex gap-1">
              <ConfBadge label="H" count={counts.HIGH} level="HIGH" />
              <ConfBadge label="M" count={counts.MED} level="MED" />
              <ConfBadge label="L" count={counts.LOW} level="LOW" />
              <ConfBadge label="U" count={counts.UNCERTAIN} level="UNCERTAIN" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
              <SelectTrigger className="w-32 h-7 text-2xs font-mono"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ({state.matchedGroups.length})</SelectItem>
                <SelectItem value="HIGH">HIGH ({counts.HIGH})</SelectItem>
                <SelectItem value="MED">MED ({counts.MED})</SelectItem>
                <SelectItem value="LOW">LOW ({counts.LOW})</SelectItem>
                <SelectItem value="UNCERTAIN">UNCERTAIN ({counts.UNCERTAIN})</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="default" size="sm" onClick={runGrowthAnalysis} disabled={state.isProcessing} className="font-mono text-xs uppercase tracking-wider">
              {state.isProcessing ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Processing</> : <>Growth Analysis →</>}
            </Button>
          </div>
        </div>

        <div className="border bg-card">
          <div className="max-h-[calc(100vh-180px)] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10 w-20">Group</TableHead>
                  {runs.map(r => (
                    <TableHead key={r.id} className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10">{r.name.split(' ')[0]} ID</TableHead>
                  ))}
                  <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10">Dist</TableHead>
                  <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10">Type</TableHead>
                  <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10 w-16">Score</TableHead>
                  <TableHead className="text-2xs font-mono uppercase sticky top-0 bg-muted/50 z-10 w-20">Conf</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((group) => {
                  const firstFeature = Object.values(group.features).find(f => f != null);
                  const firstDist = Object.values(group.correctedDistances).find(d => d != null);
                  const isSelected = selectedGroup?.group_id === group.group_id;
                  return (
                    <TableRow
                      key={group.group_id}
                      className={cn('cursor-pointer', isSelected ? 'bg-accent/10' : 'hover:bg-muted/50')}
                      onClick={() => setSelectedGroup(group)}
                    >
                      <TableCell className="font-mono-data">{group.group_id}</TableCell>
                      {runs.map(r => (
                        <TableCell key={r.id} className="font-mono-data">
                          {group.features[r.id]?.feature_id ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      ))}
                      <TableCell className="font-mono-data">{firstDist?.toFixed(1) ?? '—'}</TableCell>
                      <TableCell className="text-2xs">{firstFeature?.feature_type ?? '—'}</TableCell>
                      <TableCell className="font-mono-data font-semibold">{group.score.toFixed(3)}</TableCell>
                      <TableCell>
                        <span className={cn('inline-block px-1.5 py-0 text-2xs font-mono text-accent-foreground', confidenceColors[group.confidence])}>
                          {group.confidence}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Inspector panel */}
      {selectedGroup && (
        <div className="w-72 shrink-0 border bg-card overflow-auto">
          <div className="flex items-center justify-between border-b px-3 py-1.5 bg-muted/30">
            <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">Inspector</span>
            <button onClick={() => setSelectedGroup(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="p-3 space-y-4">
            <div>
              <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">Match</span>
              <p className="text-xs font-mono font-semibold text-foreground">{selectedGroup.group_id}</p>
            </div>

            {/* Score bars */}
            <div>
              <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">Score Breakdown</span>
              <div className="mt-1.5 space-y-1.5">
                {[
                  { label: 'DIST', value: selectedGroup.components.distance_score },
                  { label: 'CLOCK', value: selectedGroup.components.clock_score },
                  { label: 'TYPE', value: selectedGroup.components.type_score },
                  { label: 'DIMS', value: selectedGroup.components.dims_score },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className="text-2xs font-mono text-muted-foreground w-10">{item.label}</span>
                    <div className="flex-1 h-1.5 bg-muted overflow-hidden">
                      <div className="h-full bg-accent transition-all" style={{ width: `${item.value * 100}%` }} />
                    </div>
                    <span className="text-2xs font-mono w-7 text-right">{item.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t">
                <span className="text-2xs font-mono text-muted-foreground">TOTAL</span>
                <span className="text-xs font-mono font-semibold">{selectedGroup.score.toFixed(3)}</span>
                <span className={cn('px-1.5 py-0 text-2xs font-mono text-accent-foreground', confidenceColors[selectedGroup.confidence])}>
                  {selectedGroup.confidence}
                </span>
              </div>
            </div>

            {/* Per-run features */}
            <div>
              <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">Features</span>
              {runs.map(run => {
                const feature = selectedGroup.features[run.id];
                if (!feature) return (
                  <div key={run.id} className="border mt-1.5 p-2 text-2xs text-muted-foreground">{run.name}: —</div>
                );
                return (
                  <div key={run.id} className="border mt-1.5 p-2">
                    <p className="text-2xs font-mono font-medium text-foreground mb-1">{run.name}</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-2xs font-mono text-muted-foreground">
                      <span>ID: {feature.feature_id}</span>
                      <span>Dist: {(feature.corrected_distance ?? feature.distance).toFixed(1)}</span>
                      <span>Clock: {feature.clock_position ?? '—'}</span>
                      <span>Type: {feature.feature_type}</span>
                      <span>Depth: {feature.depth_percent?.toFixed(1) ?? '—'}%</span>
                      <span>Len: {feature.length?.toFixed(2) ?? '—'}</span>
                      <span>Wid: {feature.width?.toFixed(2) ?? '—'}</span>
                      <span>WT: {feature.wall_thickness?.toFixed(3) ?? '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Explanation */}
            <div>
              <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">Explanation</span>
              <p className="text-2xs text-muted-foreground mt-1 leading-relaxed">{selectedGroup.explanation}</p>
            </div>

            {/* Alternatives */}
            {selectedGroup.alternativeCandidates.length > 0 && (
              <div>
                <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
                  Alternatives ({selectedGroup.alternativeCandidates.length})
                </span>
                {selectedGroup.alternativeCandidates.map((alt, i) => (
                  <div key={i} className="flex items-center justify-between text-2xs font-mono p-1.5 border mt-1">
                    <span>{alt.feature.feature_id}</span>
                    <span className="text-muted-foreground">{alt.score.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfBadge({ label, count, level }: { label: string; count: number; level: ConfidenceLevel }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5 px-1 text-2xs font-mono text-accent-foreground', confidenceColors[level])}>
      {label}:{count}
    </span>
  );
}
