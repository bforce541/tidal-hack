import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GitCompare, ArrowRight, Terminal, Database, Shield, TrendingUp, AlertTriangle } from 'lucide-react';

const STATS = [
  { value: '2.6M mi', label: 'US pipeline network' },
  { value: '5–10 yr', label: 'Inspection interval' },
  { value: '80–90%', label: 'Alignment time reduction (observed in MVP runs)' },
  { value: '—', label: 'Conservative matching to minimize false continuity' },
];

const CAPABILITIES = [
  {
    icon: Database,
    title: 'Cross-Run Normalization (2–3 ILI passes)',
    desc: '2–3 ILI datasets from the same pipeline segment. Supports MFL, UT, and caliper tool data.',
  },
  {
    icon: GitCompare,
    title: 'Anchor-Constrained Drift Modeling',
    desc: 'Girth weld matching with piecewise linear drift correction. Full anchor-by-anchor traceability.',
  },
  {
    icon: TrendingUp,
    title: 'Explainable Corrosion Growth Estimation',
    desc: 'Depth, length, and width deltas with annualized rates. Configurable rapid-growth thresholds.',
  },
  {
    icon: AlertTriangle,
    title: 'Integrity-Relevant Exception Categorization',
    desc: 'NEW, MISSING, and UNCERTAIN anomaly categories with integrity-relevant flags.',
  },
  {
    icon: Shield,
    title: 'Component-Level Match Confidence',
    desc: 'Every match exposes distance, clock position, dimensional similarity, and feature-type compatibility scores for auditability.',
  },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card px-6 h-10 flex items-center shrink-0">
        <div className="flex items-center gap-2">
          <GitCompare className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-semibold uppercase tracking-widest text-foreground">PipeAlign</span>
        </div>
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
              Deterministic Pipeline Inspection Alignment &amp; Corrosion Growth Analysis
            </h1>
            <p className="text-sm text-muted-foreground mb-1 max-w-xl">
              Deterministic, weld-anchored alignment of ILI runs with full traceability.
            </p>
            <p className="text-sm text-muted-foreground mb-1 max-w-xl">
              Reduces manual reconciliation from weeks to hours.
            </p>
            <p className="text-sm text-muted-foreground leading-[1.65] mb-2 max-w-xl">
              Every match decision is auditable at the component level.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-10">
              <div className="flex flex-col gap-1">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate('/mvp')}
                  className="font-mono text-xs uppercase tracking-wider px-6"
                >
                  Run Pipeline
                  <ArrowRight className="h-3 w-3 ml-1.5" />
                </Button>
              </div>
              <span className="text-2xs text-muted-foreground">Upload Excel → run pipeline → download human-readable or machine CSVs</span>
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

        {/* Pipeline logic strip */}
        <section className="border-b border-t bg-muted/30 py-3 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-2xs font-mono text-muted-foreground">
              <span>Ingest</span>
              <span className="text-border">→</span>
              <span>Anchor Alignment</span>
              <span className="text-border">→</span>
              <span>Drift Correction</span>
              <span className="text-border">→</span>
              <span>Feature Matching</span>
              <span className="text-border">→</span>
              <span>Growth Modeling</span>
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section className="py-12 pb-16 px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-6">Capabilities</h2>
            <div className="space-y-4">
              {CAPABILITIES.map(cap => (
                <div key={cap.title} className="flex items-start gap-3 border-b pb-4 last:border-0">
                  <cap.icon className="h-4 w-4 text-accent mt-0.5 shrink-0 stroke-[1.5]" />
                  <div>
                    <h3 className="text-xs font-semibold text-foreground">{cap.title}</h3>
                    <p className="text-2xs text-muted-foreground mt-0.5 leading-[1.6] max-w-xl">{cap.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-2xs text-muted-foreground mt-6 pt-4 border-t border-dashed max-w-xl leading-[1.6]">
              Every matched anomaly exposes distance, clock position, dimensional similarity, and feature compatibility scores.
            </p>
          </div>
        </section>

        {/* Business case */}
        <section className="border-t py-16 px-6 bg-card">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-6">Business Value</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-6 text-2xs">
              {[
                { label: 'Time savings', value: <>Reduce alignment from weeks → hours (<strong>80–90%</strong> reduction)</> },
                { label: 'Accuracy', value: <>Matching errors from ~10–15% → <strong>{'<'}5%</strong></> },
                { label: 'Dig avoidance', value: <>5–10 unnecessary excavations prevented per 100 mi (<strong>order-of-magnitude estimate</strong>)</> },
                { label: 'Risk reduction', value: 'Earlier identification of fast-growing defects prevents failures' },
                { label: 'Consistency', value: 'Standardized process reduces analyst-to-analyst variability' },
                { label: 'Regulatory', value: 'Automated documentation supports PHMSA compliance audits' },
              ].map(item => (
                <div key={item.label} className="border-l-2 border-accent/30 pl-3">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-muted-foreground mt-0.5 [&_strong]:font-semibold [&_strong]:text-foreground">{item.value}</p>
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
            <p className="text-2xs text-muted-foreground mt-2 max-w-xl leading-[1.6]">
              ~57,000 ft pipeline with 3 inspection runs spanning 15 years. Includes girth welds, bends, valves, 
              and hundreds of metal loss / cluster anomalies with depth, length, width, and clock position data.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t px-6 py-3" />
    </div>
  );
};

export default Index;
