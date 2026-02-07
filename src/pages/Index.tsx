import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GitCompare, ArrowRight, Terminal } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card px-6 h-10 flex items-center shrink-0">
        <div className="flex items-center gap-2">
          <GitCompare className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-semibold uppercase tracking-widest text-foreground">ILI Align Studio</span>
        </div>
        <span className="ml-auto text-2xs text-muted-foreground font-mono">v1.0.0</span>
      </header>

      <main className="flex-1 flex items-center justify-center">
        <div className="max-w-lg text-center px-6">
          <div className="inline-flex items-center gap-1.5 border px-2 py-0.5 text-2xs font-mono text-muted-foreground mb-6 uppercase tracking-wider">
            <Terminal className="h-3 w-3" />
            Pipeline Integrity Workstation
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-3">
            ILI Alignment Workspace
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">
            Deterministic inspection alignment and anomaly growth analysis.
            Upload ILI datasets, align reference points, match anomalies across runs,
            and compute growth rates with full confidence scoring.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate('/analysis')}
              className="font-mono text-xs uppercase tracking-wider px-6"
            >
              Start Alignment
              <ArrowRight className="h-3 w-3 ml-1.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/analysis?example=true')}
              className="font-mono text-xs uppercase tracking-wider px-6"
            >
              Load Example Data
            </Button>
          </div>

          <div className="mt-12 border-t pt-6">
            <div className="grid grid-cols-4 gap-4 text-center">
              {[
                { label: 'Align', desc: 'Reference pts' },
                { label: 'Match', desc: 'DP matching' },
                { label: 'Growth', desc: 'Rate analysis' },
                { label: 'Export', desc: 'CSV / XLSX' },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xs font-mono font-medium text-foreground">{item.label}</p>
                  <p className="text-2xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t px-6 h-8 flex items-center">
        <span className="text-2xs text-muted-foreground font-mono">
          Deterministic · Reproducible · Explainable
        </span>
      </footer>
    </div>
  );
};

export default Index;
