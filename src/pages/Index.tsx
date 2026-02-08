import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GitCompare, ArrowRight, Database, GitBranch, Target, TrendingUp } from 'lucide-react';

const STATS = [
  { value: '2.6M mi', label: 'US pipeline network' },
  { value: '5–10 yr', label: 'Typical inspection interval' },
  { value: '80–90%', label: 'Alignment time reduction (MVP)' },
  { value: 'Deterministic', label: 'Conservative matching to reduce false continuity' },
];

const CAPABILITIES = [
  {
    icon: Database,
    title: 'Cross-Run Normalization (2–3 passes)',
    desc: 'Standardizes units and feature fields across ILI exports.',
  },
  {
    icon: GitBranch,
    title: 'Weld-Anchored Drift Correction',
    desc: 'Piecewise drift correction with anchor-by-anchor traceability.',
  },
  {
    icon: Target,
    title: 'Deterministic Feature Matching',
    desc: 'Tolerance-based matching with ambiguity flags.',
  },
  {
    icon: TrendingUp,
    title: 'Growth Computation',
    desc: 'Quantifies depth change between runs and exports audit tables.',
  },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <header className="border-b border-[var(--border)] bg-[var(--bg)] px-6 h-12 flex items-center shrink-0">
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-accent" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-widest text-[var(--text)]">PipeAlign</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {/* Hero */}
        <section className="bg-[var(--bg)] border-b border-[var(--border)] py-20 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 border border-[var(--border)] px-2.5 py-1 text-[10px] font-mono text-[var(--text-muted)] mb-8 uppercase tracking-wider">
              PIPELINE INTEGRITY WORKSTATION
            </div>

            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-[var(--text)] mb-6 leading-tight">
              Deterministic ILI Alignment &amp; Corrosion Growth Analysis
            </h1>
            <div className="space-y-1.5 text-base text-[var(--text-muted)] mb-10 max-w-xl">
              <p>Weld-anchored alignment across inspection runs.</p>
              <p>Audit-ready matching with traceable decisions.</p>
              <p>Turn weeks of spreadsheet reconciliation into minutes.</p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-12">
              <Button
                variant="default"
                size="lg"
                onClick={() => navigate('/mvp')}
                className="h-[52px] px-6 py-3 bg-[var(--accent-hex)] hover:bg-[#081828] text-white font-medium transition-colors shadow-sm hover:shadow-md [&_svg]:transition-transform [&_svg]:hover:translate-x-0.5"
              >
                Analyze ILI File
                <ArrowRight className="h-4 w-4 ml-1.5" aria-hidden />
              </Button>
              <span className="text-xs text-[var(--text-muted)]">Upload Excel → run alignment → download results</span>
            </div>

            {/* Divider */}
            <div className="border-t border-[var(--border)] pt-8" />

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="card-hover-accent p-4 cursor-default"
                  tabIndex={0}
                  role="article"
                >
                  <p className="card-title text-base font-semibold font-mono text-[var(--accent-hex)] transition-colors duration-200 ease-out">{s.value}</p>
                  <p className="card-sub text-xs text-[var(--text-muted)] mt-1 transition-colors duration-200 ease-out">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pipeline strip */}
        <section className="bg-[var(--bg-muted)] border-y border-[var(--border)] py-3 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs font-mono text-[var(--text-muted)]">
              <span>Ingest</span>
              <span className="text-[var(--border)]">→</span>
              <span>Anchor Alignment</span>
              <span className="text-[var(--border)]">→</span>
              <span>Drift Correction</span>
              <span className="text-[var(--border)]">→</span>
              <span>Feature Matching</span>
              <span className="text-[var(--border)]">→</span>
              <span>Growth Modeling</span>
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section className="py-16 px-6 bg-[var(--bg-muted)]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] mb-8">Capabilities</h2>
            <div className="space-y-4">
              {CAPABILITIES.map((cap) => (
                <div
                  key={cap.title}
                  className="card-hover-accent flex items-start gap-4 p-5 cursor-default"
                  tabIndex={0}
                  role="article"
                >
                  <div className="card-icon-wrapper flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft transition-colors duration-200 ease-out">
                    <cap.icon className="card-icon h-5 w-5 text-accent stroke-[1.5] transition-colors duration-200 ease-out" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h3 className="card-title text-sm font-semibold text-[var(--text)] transition-colors duration-200 ease-out">{cap.title}</h3>
                    <p className="card-sub text-sm text-[var(--text-muted)] mt-1 leading-relaxed transition-colors duration-200 ease-out">{cap.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Example dataset (slim) */}
        <section className="border-t border-[var(--border)] py-10 px-6 bg-[var(--bg)]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] mb-4">Included Example Dataset</h2>
            <div className="border border-[var(--border)] rounded-lg bg-white overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
                    <th className="text-left px-3 py-2.5 font-mono uppercase tracking-wider text-[var(--text-muted)]">Run</th>
                    <th className="text-left px-3 py-2.5 font-mono uppercase tracking-wider text-[var(--text-muted)]">Date</th>
                    <th className="text-left px-3 py-2.5 font-mono uppercase tracking-wider text-[var(--text-muted)]">Vendor</th>
                    <th className="text-left px-3 py-2.5 font-mono uppercase tracking-wider text-[var(--text-muted)]">Tool Type</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-[var(--text)]">
                  <tr className="border-b border-[var(--border)]">
                    <td className="px-3 py-2.5">Run 1</td>
                    <td className="px-3 py-2.5">Jun 2007</td>
                    <td className="px-3 py-2.5">Rosen</td>
                    <td className="px-3 py-2.5">Axial MFL</td>
                  </tr>
                  <tr className="border-b border-[var(--border)]">
                    <td className="px-3 py-2.5">Run 2</td>
                    <td className="px-3 py-2.5">May 2015</td>
                    <td className="px-3 py-2.5">Baker Hughes</td>
                    <td className="px-3 py-2.5">MFL-A/XT</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2.5">Run 3</td>
                    <td className="px-3 py-2.5">Feb 2022</td>
                    <td className="px-3 py-2.5">Baker Hughes</td>
                    <td className="px-3 py-2.5">C-MFL</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2 max-w-xl leading-relaxed">
              ~57,000 ft pipeline, 3 runs over 15 years. Girth welds, metal loss / cluster anomalies with depth, length, width, clock position.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] px-6 py-4 bg-[var(--bg)]" />
    </div>
  );
};

export default Index;
