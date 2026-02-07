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
  { component: UploadStep, label: 'Upload & Configure' },
  { component: AlignmentStep, label: 'Alignment Results' },
  { component: MatchingStep, label: 'Matched Anomalies' },
  { component: GrowthStep, label: 'Growth & Exceptions' },
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
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b bg-card px-6 py-3 shrink-0">
          <h2 className="text-lg font-semibold text-foreground">
            {STEPS[state.step]?.label ?? 'Upload & Configure'}
          </h2>
          <SettingsDrawer />
        </header>
        <main className="flex-1 overflow-auto p-6">
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
