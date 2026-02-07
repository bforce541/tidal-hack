import { useAnalysis } from '@/context/AnalysisContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Settings as SettingsIcon } from 'lucide-react';
import { Settings, DEFAULT_SETTINGS } from '@/lib/types';

export function SettingsDrawer() {
  const { state, dispatch } = useAnalysis();
  const settings = state.settings;

  const update = (partial: Partial<Settings>) => {
    dispatch({ type: 'SET_SETTINGS', settings: { ...settings, ...partial } });
  };
  const updateWeight = (key: keyof Settings['weights'], value: number) => {
    dispatch({ type: 'SET_SETTINGS', settings: { ...settings, weights: { ...settings.weights, [key]: value } } });
  };
  const weightSum = settings.weights.distance + settings.weights.clock + settings.weights.type + settings.weights.dims;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-2xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
          <SettingsIcon className="h-3 w-3 mr-1" />
          Config
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-auto w-80">
        <SheetHeader>
          <SheetTitle className="text-sm font-mono uppercase tracking-wider">Settings</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-6">
          <Section title="Tolerances">
            <Field label="Dist Tol (ft)" hint="Max distance between matches" value={settings.distTolerance} onChange={(v) => update({ distTolerance: v })} />
            <Field label="Clock Tol (°)" hint="Max angular difference" value={settings.clockTolerance} onChange={(v) => update({ clockTolerance: v })} />
          </Section>

          <Section title="Thresholds">
            <Field label="HIGH ≥" value={settings.scoreThreshHigh} onChange={(v) => update({ scoreThreshHigh: v })} step={0.05} />
            <Field label="MED ≥" value={settings.scoreThreshMed} onChange={(v) => update({ scoreThreshMed: v })} step={0.05} />
            <Field label="LOW ≥" value={settings.scoreThreshLow} onChange={(v) => update({ scoreThreshLow: v })} step={0.05} />
          </Section>

          <Section title="Growth Flags">
            <Field label="Depth (%)" value={settings.rapidGrowthDepth} onChange={(v) => update({ rapidGrowthDepth: v })} />
            <Field label="Length" value={settings.rapidGrowthLength} onChange={(v) => update({ rapidGrowthLength: v })} step={0.5} />
          </Section>

          <Section title="Weights">
            <Field label="Distance" value={settings.weights.distance} onChange={(v) => updateWeight('distance', v)} step={0.05} />
            <Field label="Clock" value={settings.weights.clock} onChange={(v) => updateWeight('clock', v)} step={0.05} />
            <Field label="Type" value={settings.weights.type} onChange={(v) => updateWeight('type', v)} step={0.05} />
            <Field label="Dims" value={settings.weights.dims} onChange={(v) => updateWeight('dims', v)} step={0.05} />
            <p className="text-2xs font-mono text-muted-foreground">
              Σ = {weightSum.toFixed(2)} {Math.abs(weightSum - 1) > 0.01 && <span className="text-destructive">(≠ 1.0)</span>}
            </p>
          </Section>

          <Button
            variant="outline"
            size="sm"
            className="w-full font-mono text-2xs uppercase tracking-wider"
            onClick={() => dispatch({ type: 'SET_SETTINGS', settings: DEFAULT_SETTINGS })}
          >
            Reset Defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-2xs font-mono uppercase tracking-wider text-muted-foreground border-b pb-1 mb-2">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, hint, value, onChange, step = 1 }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void; step?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Label className="text-2xs font-mono">{label}</Label>
        {hint && <p className="text-2xs text-muted-foreground">{hint}</p>}
      </div>
      <Input type="number" value={value} step={step} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="h-6 text-2xs font-mono w-20" />
    </div>
  );
}
