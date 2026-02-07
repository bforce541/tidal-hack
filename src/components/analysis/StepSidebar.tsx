import { useNavigate } from 'react-router-dom';
import { useAnalysis } from '@/context/AnalysisContext';
import { Upload, GitCompare, Layers, TrendingUp, Download, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = [
  { icon: Upload, label: 'Upload & Configure', key: 0 },
  { icon: GitCompare, label: 'Alignment Results', key: 1 },
  { icon: Layers, label: 'Matched Anomalies', key: 2 },
  { icon: TrendingUp, label: 'Growth & Exceptions', key: 3 },
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
    <aside className="flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground shrink-0">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Home</span>
        </button>
      </div>

      <div className="px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Analysis Steps
        </span>
      </div>

      <nav className="flex-1 px-3">
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
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors mb-1',
                isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
                !isActive && isClickable && 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                !isClickable && 'text-sidebar-foreground/30 cursor-not-allowed',
              )}
            >
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold shrink-0',
                  isActive && 'bg-sidebar-primary text-sidebar-primary-foreground',
                  isCompleted && !isActive && 'bg-sidebar-primary/20 text-sidebar-primary',
                  !isCompleted && !isActive && 'bg-sidebar-accent text-sidebar-foreground/40',
                )}
              >
                {isCompleted && !isActive ? '✓' : idx + 1}
              </div>
              <span className="truncate">{step.label}</span>
            </button>
          );
        })}
      </nav>

      {state.runs.length > 0 && (
        <div className="border-t border-sidebar-border px-5 py-4">
          <p className="text-xs text-sidebar-foreground/50 mb-2">Loaded Runs</p>
          {state.runs.map((r) => (
            <p key={r.id} className="text-xs text-sidebar-foreground/70 truncate">
              {r.name}
            </p>
          ))}
        </div>
      )}
    </aside>
  );
}
