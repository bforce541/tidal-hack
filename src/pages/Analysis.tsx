import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnalysisProvider, useAnalysis } from '@/context/AnalysisContext';
import { StepSidebar } from '@/components/analysis/StepSidebar';
import { UploadStep } from '@/components/analysis/UploadStep';
import { AlignmentStep } from '@/components/analysis/AlignmentStep';
import { MatchingStep } from '@/components/analysis/MatchingStep';
import { GrowthStep } from '@/components/analysis/GrowthStep';
import { ExportStep } from '@/components/analysis/ExportStep';
import { SettingsDrawer } from '@/components/analysis/SettingsDrawer';
import { generateExampleData } from '@/lib/example-data';

const STEPS = [
  { component: UploadStep, label: 'Upload' },
  { component: AlignmentStep, label: 'Alignment' },
  { component: MatchingStep, label: 'Matching' },
  { component: GrowthStep, label: 'Growth' },
  { component: ExportStep, label: 'Export' },
];

function AnalysisContent() {
  const { state, dispatch } = useAnalysis();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('example') === 'true' && state.runs.length === 0) {
      const exampleRuns = generateExampleData();
      dispatch({ type: 'SET_RUNS', runs: exampleRuns });
    }
  }, [searchParams, dispatch, state.runs.length]);

  const CurrentStep = STEPS[state.step]?.component ?? UploadStep;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <StepSidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="flex items-center justify-between border-b bg-card px-4 h-10 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Step {state.step + 1}/{STEPS.length}
            </span>
            <span className="text-xs text-border">|</span>
            <span className="text-xs font-medium text-foreground">
              {STEPS[state.step]?.label ?? 'Upload'}
            </span>
          </div>
          <SettingsDrawer />
        </header>
        <main className="flex-1 overflow-auto p-4">
          <CurrentStep />
        </main>
      </div>
    </div>
  );
}

const Analysis = () => (
  <AnalysisProvider>
    <AnalysisContent />
  </AnalysisProvider>
);

export default Analysis;
