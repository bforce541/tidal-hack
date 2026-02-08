import { useNavigate } from 'react-router-dom';
import { useAnalysis } from '@/context/AnalysisContext';
import { ArrowLeft, Upload, GitCompare, Layers, TrendingUp, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentDrawer } from '@/components/analysis/AgentDrawer';

const steps = [
  { icon: Upload, label: 'Upload', key: 0 },
  { icon: GitCompare, label: 'Alignment', key: 1 },
  { icon: Layers, label: 'Matching', key: 2 },
  { icon: TrendingUp, label: 'Growth', key: 3 },
  { icon: Download, label: 'Export', key: 4 },
];

export function StepSidebar() {
  const { state, dispatch } = useAnalysis();
  const navigate = useNavigate();

  const canNavigateTo = (step: number) => {
    if (step === 0) return true;
    if (step === 1) return state.alignments.length > 0;
    if (step === 2) return state.matchedGroups.length > 0;
    if (step === 3) return state.growthResults.length > 0 || state.exceptions.length > 0;
    if (step === 4) return state.qualityMetrics != null;
    return false;
  };

  return (
    <aside className="flex w-72 flex-col border-r bg-sidebar text-sidebar-foreground shrink-0">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-3 h-10">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors font-mono uppercase tracking-wider"
        >
          <ArrowLeft className="h-3 w-3" />
          Home
        </button>
      </div>

      <nav className="flex-1 py-2 px-2">
        <p className="text-xs font-mono uppercase tracking-widest text-sidebar-foreground/40 px-2 py-1.5 mb-1">
          Pipeline
        </p>
        {steps.map((step, idx) => {
          const isActive = state.step === step.key;
          const isCompleted = canNavigateTo(step.key + 1);
          const isClickable = canNavigateTo(step.key);

          return (
            <button
              key={step.key}
              onClick={() => isClickable && dispatch({ type: 'SET_STEP', step: step.key })}
              disabled={!isClickable}
              className={cn(
                'flex w-full items-center gap-2 px-2 py-1.5 text-xs transition-colors',
                isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                !isActive && isClickable && 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                !isClickable && 'text-sidebar-foreground/25 cursor-not-allowed',
              )}
            >
              <span className={cn(
                'flex h-4 w-4 items-center justify-center text-2xs font-mono shrink-0',
                isActive && 'text-sidebar-primary',
                isCompleted && !isActive && 'text-sidebar-primary/70',
              )}>
                {isCompleted && !isActive ? '✓' : idx + 1}
              </span>
              <span className="truncate font-mono text-xs uppercase tracking-wider">{step.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-2">
        <p className="text-xs font-mono uppercase tracking-widest text-sidebar-foreground/40 mb-2">Assistant</p>
        <AgentDrawer />
      </div>

      {state.runs.length > 0 && (
        <div className="border-t border-sidebar-border px-3 py-2">
          <p className="text-xs font-mono uppercase tracking-widest text-sidebar-foreground/40 mb-1.5">Runs</p>
          {state.runs.map((r) => (
            <div key={r.id} className="flex items-center gap-1.5 py-0.5">
              <span className="h-1 w-1 bg-sidebar-primary shrink-0" />
              <p className="text-xs text-sidebar-foreground/60 truncate font-mono">{r.name}</p>
            </div>
          ))}
        </div>
      )}

      {state.qualityMetrics && (
        <div className="border-t border-sidebar-border px-3 py-2">
          <p className="text-xs font-mono uppercase tracking-widest text-sidebar-foreground/40 mb-1.5">Stats</p>
          <div className="grid grid-cols-2 gap-1">
            <Stat label="Anchors" value={state.qualityMetrics.totalAnchors} />
            <Stat label="Matched" value={state.qualityMetrics.totalAnomalies} />
            <Stat label="Except." value={state.qualityMetrics.newAnomalies + state.qualityMetrics.missingAnomalies} />
            <Stat label="Uncertain" value={state.qualityMetrics.uncertain} />
          </div>
        </div>
      )}
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-sidebar-foreground/40">{label}</p>
      <p className="text-xs font-mono text-sidebar-foreground">{value}</p>
    </div>
  );
}
