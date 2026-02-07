import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GitCompare, ArrowRight, Terminal, Database, Shield, TrendingUp, AlertTriangle } from 'lucide-react';

const STATS = [
  { value: '2.6M mi', label: 'US pipeline network' },
  { value: '5–10 yr', label: 'Inspection interval' },
  { value: '80–90%', label: 'Time savings target' },
  { value: '<5%', label: 'Matching error target' },
];

const CAPABILITIES = [
  {
    icon: Database,
    title: 'Multi-Run Ingestion',
    desc: '2–3 ILI datasets from the same pipeline segment. Supports MFL, UT, and caliper tool data.',
  },
  {
    icon: GitCompare,
    title: 'Deterministic Alignment',
    desc: 'Girth weld matching with piecewise linear drift correction. Full anchor-by-anchor traceability.',
  },
  {
    icon: TrendingUp,
    title: 'Growth Rate Analysis',
    desc: 'Depth, length, and width deltas with annualized rates. Configurable rapid-growth thresholds.',
  },
  {
    icon: AlertTriangle,
    title: 'Exception Flagging',
    desc: 'NEW, MISSING, UNCERTAIN, and RAPID_GROWTH classifications with recommended actions.',
  },
  {
    icon: Shield,
    title: 'Confidence Scoring',
    desc: 'Every match scored 0–1 with HIGH/MED/LOW/UNCERTAIN labels. Component-level explainability.',
  },
];

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

      <main className="flex-1 flex flex-col">
        {/* Hero */}
        <section className="border-b py-16 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 border px-2 py-0.5 text-2xs font-mono text-muted-foreground mb-6 uppercase tracking-wider">
              <Terminal className="h-3 w-3" />
              Pipeline Integrity Workstation
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-3">
              Intelligent Pipeline Inspection Data Alignment &amp; Corrosion Growth Prediction
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2 max-w-2xl">
              Automated solution for aligning In-Line Inspection (ILI) datasets and predicting corrosion growth — 
              a problem that directly impacts pipeline safety, regulatory compliance, and operational efficiency.
            </p>
            <p className="text-2xs text-muted-foreground leading-relaxed max-w-2xl mb-8">
              Reduces alignment time from weeks to hours. Deterministic, reproducible, and fully explainable — every match decision is traceable to component-level scores.
            </p>

            <div className="flex items-center gap-3 mb-10">
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
                Load Example Dataset
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 border-t pt-6">
              {STATS.map(s => (
                <div key={s.label}>
                  <p className="text-sm font-mono font-semibold text-foreground">{s.value}</p>
                  <p className="text-2xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section className="py-12 px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-6">Capabilities</h2>
            <div className="space-y-4">
              {CAPABILITIES.map(cap => (
                <div key={cap.title} className="flex items-start gap-3 border-b pb-4 last:border-0">
                  <cap.icon className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-xs font-semibold text-foreground">{cap.title}</h3>
                    <p className="text-2xs text-muted-foreground mt-0.5 leading-relaxed">{cap.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Business case */}
        <section className="border-t py-12 px-6 bg-card">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-6">Business Value</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-2xs">
              {[
                { label: 'Time savings', value: 'Reduce alignment from weeks → hours (80–90% reduction)' },
                { label: 'Accuracy', value: 'Matching errors from ~10–15% → <5%' },
                { label: 'Dig avoidance', value: '5–10 unnecessary excavations prevented per 100 mi (~$250K–$500K)' },
                { label: 'Risk reduction', value: 'Earlier identification of fast-growing defects prevents failures' },
                { label: 'Consistency', value: 'Standardized process reduces analyst-to-analyst variability' },
                { label: 'Regulatory', value: 'Automated documentation supports PHMSA compliance audits' },
              ].map(item => (
                <div key={item.label} className="border-l-2 border-accent/30 pl-3">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-muted-foreground mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Example dataset info */}
        <section className="border-t py-8 px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">Included Example Dataset</h2>
            <div className="border bg-card">
              <table className="w-full text-2xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-3 py-1.5 font-mono uppercase tracking-wider text-muted-foreground">Run</th>
                    <th className="text-left px-3 py-1.5 font-mono uppercase tracking-wider text-muted-foreground">Date</th>
                    <th className="text-left px-3 py-1.5 font-mono uppercase tracking-wider text-muted-foreground">Vendor</th>
                    <th className="text-left px-3 py-1.5 font-mono uppercase tracking-wider text-muted-foreground">Tool Type</th>
                    <th className="text-left px-3 py-1.5 font-mono uppercase tracking-wider text-muted-foreground">Coverage</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <tr className="border-b">
                    <td className="px-3 py-1.5">Run 1</td>
                    <td className="px-3 py-1.5">Jun 2007</td>
                    <td className="px-3 py-1.5">Rosen</td>
                    <td className="px-3 py-1.5">Axial MFL</td>
                    <td className="px-3 py-1.5">0–57,267 ft</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-3 py-1.5">Run 2</td>
                    <td className="px-3 py-1.5">May 2015</td>
                    <td className="px-3 py-1.5">Baker Hughes</td>
                    <td className="px-3 py-1.5">MFL-A/XT</td>
                    <td className="px-3 py-1.5">0–57,340 ft</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5">Run 3</td>
                    <td className="px-3 py-1.5">Feb 2022</td>
                    <td className="px-3 py-1.5">Baker Hughes</td>
                    <td className="px-3 py-1.5">C-MFL</td>
                    <td className="px-3 py-1.5">0–57,445 ft</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-2xs text-muted-foreground mt-2">
              ~57,000 ft pipeline with 3 inspection runs spanning 15 years. Includes girth welds, bends, valves, 
              and hundreds of metal loss / cluster anomalies with depth, length, width, and clock position data.
            </p>
          </div>
        </section>
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
