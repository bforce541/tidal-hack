import { useState, useCallback, useRef } from 'react';
import { useAnalysis } from '@/context/AnalysisContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Plus, Loader2 } from 'lucide-react';
import { getSheetNames, getSheetHeaders, parseExcelFile, autoDetectMapping } from '@/lib/excel-parser';
import { RawFeature, ColumnMapping, ValidationError, RunData } from '@/lib/types';

interface RunUpload {
  name: string;
  file: File | null;
  sheets: string[];
  selectedSheet: string;
  headers: string[];
  mapping: ColumnMapping;
  features: RawFeature[];
  errors: ValidationError[];
  warnings: ValidationError[];
  date: string;
  units: 'feet' | 'meters';
  isLoading: boolean;
}

function createEmptyUpload(name: string): RunUpload {
  return {
    name, file: null, sheets: [], selectedSheet: '', headers: [],
    mapping: {} as ColumnMapping, features: [], errors: [], warnings: [],
    date: '', units: 'feet', isLoading: false,
  };
}

export function UploadStep() {
  const { state, dispatch, runAlignment } = useAnalysis();
  const [uploads, setUploads] = useState<RunUpload[]>([
    createEmptyUpload('Run 1 (Baseline)'),
    createEmptyUpload('Run 2 (Re-inspection)'),
  ]);
  const [showThird, setShowThird] = useState(false);

  const hasExampleData = state.runs.length > 0 && state.step === 0;

  const handleFileDrop = useCallback(async (index: number, file: File) => {
    setUploads(prev => {
      const next = [...prev];
      next[index] = { ...next[index], file, isLoading: true };
      return next;
    });

    try {
      const sheets = await getSheetNames(file);
      const firstSheet = sheets[0];
      const headers = await getSheetHeaders(file, firstSheet);
      const mapping = autoDetectMapping(headers);
      const { features, errors, warnings } = await parseExcelFile(file, firstSheet, mapping);

      setUploads(prev => {
        const next = [...prev];
        next[index] = {
          ...next[index], sheets, selectedSheet: firstSheet, headers, mapping,
          features, errors, warnings, isLoading: false,
        };
        return next;
      });
    } catch (err) {
      setUploads(prev => {
        const next = [...prev];
        next[index] = {
          ...next[index], isLoading: false,
          errors: [{ type: 'invalid_format', message: `Failed to parse: ${(err as Error).message}`, severity: 'error' }],
        };
        return next;
      });
    }
  }, []);

  const handleSheetChange = useCallback(async (index: number, sheetName: string) => {
    const upload = uploads[index];
    if (!upload.file) return;

    setUploads(prev => {
      const next = [...prev];
      next[index] = { ...next[index], selectedSheet: sheetName, isLoading: true };
      return next;
    });

    const headers = await getSheetHeaders(upload.file, sheetName);
    const mapping = autoDetectMapping(headers);
    const { features, errors, warnings } = await parseExcelFile(upload.file, sheetName, mapping);

    setUploads(prev => {
      const next = [...prev];
      next[index] = { ...next[index], headers, mapping, features, errors, warnings, isLoading: false };
      return next;
    });
  }, [uploads]);

  const handleProceed = () => {
    const runs: RunData[] = uploads
      .filter(u => u.features.length > 0 && u.errors.filter(e => e.severity === 'error').length === 0)
      .map((u, i) => ({
        id: `run-${i + 1}`,
        name: u.name,
        fileName: u.file!.name,
        date: u.date || undefined,
        features: u.features,
        units: u.units,
        sheetName: u.selectedSheet,
        columnMapping: u.mapping,
        validationErrors: u.errors,
        validationWarnings: u.warnings,
      }));

    dispatch({ type: 'SET_RUNS', runs });
    setTimeout(() => runAlignment(), 100);
  };

  const validUploads = uploads.filter(u => u.features.length > 0 && u.errors.filter(e => e.severity === 'error').length === 0);
  const isReady = validUploads.length >= 2;

  if (hasExampleData) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Example Data Loaded</h2>
          <p className="text-muted-foreground">
            Synthetic dataset with {state.runs.length} runs ready for analysis.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {state.runs.map(run => (
            <Card key={run.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{run.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{run.features.length} features</p>
                  <p>{run.features.filter(f => f.is_reference).length} reference points</p>
                  <p>{run.features.filter(f => !f.is_reference).length} anomalies</p>
                  {run.date && <p>Date: {run.date}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button variant="accent" size="lg" onClick={() => runAlignment()} disabled={state.isProcessing}>
          {state.isProcessing ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
          ) : (
            'Run Alignment →'
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Upload & Configure ILI Data</h2>
        <p className="text-muted-foreground">
          Upload 2 or 3 Excel files containing ILI inspection data. Columns will be auto-detected.
        </p>
      </div>

      <div className="space-y-6">
        {uploads.map((upload, index) => (
          <RunUploadCard
            key={index}
            upload={upload}
            index={index}
            onFileDrop={handleFileDrop}
            onSheetChange={handleSheetChange}
            onUpdate={(field, value) => {
              setUploads(prev => {
                const next = [...prev];
                next[index] = { ...next[index], [field]: value };
                return next;
              });
            }}
          />
        ))}

        {!showThird && (
          <Button
            variant="outline"
            onClick={() => {
              setShowThird(true);
              setUploads(prev => [...prev, createEmptyUpload('Run 3 (Optional)')]);
            }}
            className="w-full border-dashed"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Third Run (Optional)
          </Button>
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {validUploads.length} of {uploads.length} runs configured
          </p>
          <Button variant="accent" size="lg" onClick={handleProceed} disabled={!isReady || state.isProcessing}>
            {state.isProcessing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
            ) : (
              'Run Alignment →'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RunUploadCard({
  upload, index, onFileDrop, onSheetChange, onUpdate,
}: {
  upload: RunUpload;
  index: number;
  onFileDrop: (index: number, file: File) => void;
  onSheetChange: (index: number, sheet: string) => void;
  onUpdate: (field: string, value: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileDrop(index, file);
  };

  if (!upload.file) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{upload.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`drop-zone ${isDragOver ? 'drop-zone-active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground mb-1">Drop Excel file here or click to browse</p>
            <p className="text-xs text-muted-foreground">.xlsx, .xls files supported</p>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileDrop(index, file);
            }} />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (upload.isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{upload.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-accent mr-3" />
            <span className="text-sm text-muted-foreground">Parsing file...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const errors = upload.errors.filter(e => e.severity === 'error');
  const warnings = upload.warnings.concat(upload.errors.filter(e => e.severity === 'warning'));
  const refCount = upload.features.filter(f => f.is_reference).length;
  const anomCount = upload.features.filter(f => !f.is_reference).length;

  return (
    <Card className={errors.length > 0 ? 'border-destructive/50' : upload.features.length > 0 ? 'border-accent/30' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-accent" />
            {upload.name}
          </CardTitle>
          {upload.features.length > 0 && errors.length === 0 && (
            <Badge variant="outline" className="text-success border-success/30">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Ready
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{upload.file.name}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {upload.sheets.length > 1 && (
            <div>
              <Label className="text-xs">Sheet</Label>
              <Select value={upload.selectedSheet} onValueChange={(v) => onSheetChange(index, v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {upload.sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Run Date (optional)</Label>
            <Input type="date" value={upload.date} onChange={(e) => onUpdate('date', e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs">Units</Label>
            <Select value={upload.units} onValueChange={(v) => onUpdate('units', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="feet">Feet</SelectItem>
                <SelectItem value="meters">Meters</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {upload.features.length > 0 && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{upload.features.length} total features</span>
            <span>{refCount} reference points</span>
            <span>{anomCount} anomalies</span>
          </div>
        )}

        {Object.keys(upload.mapping).length > 0 && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-medium text-foreground mb-2">Detected Columns</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(upload.mapping).filter(([, v]) => v).map(([key, val]) => (
                <Badge key={key} variant="secondary" className="text-xs font-mono">
                  {key}: {val}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="space-y-1">
            {errors.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {e.message}
              </div>
            ))}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-warning">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {w.message}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
