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
    dispatch({
      type: 'SET_SETTINGS',
      settings: { ...settings, weights: { ...settings.weights, [key]: value } },
    });
  };

  const weightSum = settings.weights.distance + settings.weights.clock + settings.weights.type + settings.weights.dims;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          <SettingsIcon className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-auto">
        <SheetHeader>
          <SheetTitle>Analysis Settings</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-8">
          <SettingsSection title="Tolerances">
            <SettingsField
              label="Distance Tolerance (ft)"
              hint="Max distance between matched features"
              value={settings.distTolerance}
              onChange={(v) => update({ distTolerance: v })}
            />
            <SettingsField
              label="Clock Tolerance (degrees)"
              hint="Max angular difference for clock position"
              value={settings.clockTolerance}
              onChange={(v) => update({ clockTolerance: v })}
            />
          </SettingsSection>

          <SettingsSection title="Confidence Thresholds">
            <SettingsField
              label="HIGH threshold"
              hint="Score ≥ this = HIGH confidence"
              value={settings.scoreThreshHigh}
              onChange={(v) => update({ scoreThreshHigh: v })}
              step={0.05}
            />
            <SettingsField
              label="MED threshold"
              hint="Score ≥ this = MED confidence"
              value={settings.scoreThreshMed}
              onChange={(v) => update({ scoreThreshMed: v })}
              step={0.05}
            />
            <SettingsField
              label="LOW threshold"
              hint="Score ≥ this = LOW; below = UNCERTAIN"
              value={settings.scoreThreshLow}
              onChange={(v) => update({ scoreThreshLow: v })}
              step={0.05}
            />
          </SettingsSection>

          <SettingsSection title="Growth Flagging">
            <SettingsField
              label="Rapid Depth Growth (%)"
              hint="Depth delta above this triggers RAPID_GROWTH"
              value={settings.rapidGrowthDepth}
              onChange={(v) => update({ rapidGrowthDepth: v })}
            />
            <SettingsField
              label="Rapid Length Growth"
              hint="Length delta above this triggers RAPID_GROWTH"
              value={settings.rapidGrowthLength}
              onChange={(v) => update({ rapidGrowthLength: v })}
              step={0.5}
            />
          </SettingsSection>

          <SettingsSection title="Score Weights">
            <SettingsField label="Distance weight" value={settings.weights.distance} onChange={(v) => updateWeight('distance', v)} step={0.05} />
            <SettingsField label="Clock weight" value={settings.weights.clock} onChange={(v) => updateWeight('clock', v)} step={0.05} />
            <SettingsField label="Type weight" value={settings.weights.type} onChange={(v) => updateWeight('type', v)} step={0.05} />
            <SettingsField label="Dimensions weight" value={settings.weights.dims} onChange={(v) => updateWeight('dims', v)} step={0.05} />
            <p className="text-xs text-muted-foreground">
              Sum: {weightSum.toFixed(2)}
              {Math.abs(weightSum - 1) > 0.01 && (
                <span className="text-destructive ml-1">(should be 1.0)</span>
              )}
            </p>
          </SettingsSection>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => dispatch({ type: 'SET_SETTINGS', settings: DEFAULT_SETTINGS })}
          >
            Reset to Defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-foreground mb-3">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SettingsField({
  label, hint, value, onChange, step = 1,
}: {
  label: string; hint?: string; value: number; onChange: (v: number) => void; step?: number;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground mb-1">{hint}</p>}
      <Input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-8 text-xs font-mono w-32"
      />
    </div>
  );
}
