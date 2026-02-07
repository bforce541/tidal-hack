import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, GitCompare, TrendingUp, Download, Shield, BarChart3 } from 'lucide-react';

const features = [
  { icon: Upload, title: 'Upload ILI Data', desc: 'Import 2–3 Excel files with automatic column detection and validation.' },
  { icon: GitCompare, title: 'Align & Match', desc: 'Reference-point alignment with piecewise drift correction and DP-based matching.' },
  { icon: TrendingUp, title: 'Growth Analysis', desc: 'Compute depth, length, and width deltas with per-year rates when dates available.' },
  { icon: Shield, title: 'Exception Flagging', desc: 'Identify NEW, MISSING, UNCERTAIN, and RAPID_GROWTH anomalies automatically.' },
  { icon: BarChart3, title: 'Confidence Scoring', desc: 'Every match has a numeric score with component breakdown and explainability.' },
  { icon: Download, title: 'Export Results', desc: 'Download matched datasets, drift maps, and exception reports as CSV/XLSX/JSON.' },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <GitCompare className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">ILI Align Studio</span>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-6 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Pipeline Integrity Analysis
          </div>
          <h1 className="mb-6 text-5xl font-extrabold tracking-tight text-foreground">
            Align · Match · Analyze
          </h1>
          <p className="mb-10 text-lg text-muted-foreground leading-relaxed">
            Align multiple ILI runs, match anomalies across inspections, compute growth rates, and flag exceptions — all with full confidence scoring and explainability.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button variant="accent" size="lg" onClick={() => navigate('/analysis')} className="px-8 text-base font-semibold">
              Create New Analysis
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/analysis?example=true')} className="px-8 text-base">
              Load Example Dataset
            </Button>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-6 pb-20">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="border bg-card transition-shadow hover:shadow-md">
              <CardContent className="p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <f.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mb-2 font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t bg-card py-6">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          ILI Align Studio — Deterministic, reproducible pipeline inspection analysis
        </div>
      </footer>
    </div>
  );
};

export default Index;
