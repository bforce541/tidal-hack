import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnalysisProvider, useAnalysis } from '@/context/AnalysisContext';
import { StepSidebar } from '@/components/analysis/StepSidebar';
import { UploadStep } from '@/components/analysis/UploadStep';
import { AlignmentStep } from '@/components/analysis/AlignmentStep';
import { MatchingStep } from '@/components/analysis/MatchingStep';
import { GrowthStep } from '@/components/analysis/GrowthStep';
import { ExportStep } from '@/components/analysis/ExportStep';
import { SettingsDrawer } from '@/components/analysis/SettingsDrawer';
import { loadExampleData } from '@/lib/example-data';
import { Loader2, AlertCircle } from 'lucide-react';

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
  const [loadingExample, setLoadingExample] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('example') === 'true' && state.runs.length === 0 && !loadingExample) {
      setLoadingExample(true);
      setLoadError(null);

      loadExampleData()
        .then(runs => {
          dispatch({ type: 'SET_RUNS', runs });
          setLoadingExample(false);
        })
        .catch(err => {
          console.error('Failed to load example data:', err);
          setLoadError(err.message || 'Failed to load example data');
          setLoadingExample(false);
        });
    }
  }, [searchParams, dispatch, state.runs.length, loadingExample]);

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
          {loadingExample ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Loading ILI Dataset</p>
                <p className="text-2xs text-muted-foreground mt-1">
                  Parsing 3 inspection runs from ILIDataV2.xlsx...
                </p>
              </div>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Failed to Load Example Data</p>
                <p className="text-2xs text-destructive mt-1">{loadError}</p>
                <p className="text-2xs text-muted-foreground mt-2">
                  You can still upload your own ILI data files manually.
                </p>
              </div>
            </div>
          ) : (
            <CurrentStep />
          )}
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
