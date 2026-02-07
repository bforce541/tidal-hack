import { useState, useCallback, useRef } from 'react';
import { useAnalysis } from '@/context/AnalysisContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
        next[index] = { ...next[index], sheets, selectedSheet: firstSheet, headers, mapping, features, errors, warnings, isLoading: false };
        return next;
      });
    } catch (err) {
      setUploads(prev => {
        const next = [...prev];
        next[index] = { ...next[index], isLoading: false, errors: [{ type: 'invalid_format', message: `Parse failed: ${(err as Error).message}`, severity: 'error' }] };
        return next;
      });
    }
  }, []);

  const handleSheetChange = useCallback(async (index: number, sheetName: string) => {
    const upload = uploads[index];
    if (!upload.file) return;
    setUploads(prev => { const next = [...prev]; next[index] = { ...next[index], selectedSheet: sheetName, isLoading: true }; return next; });
    const headers = await getSheetHeaders(upload.file, sheetName);
    const mapping = autoDetectMapping(headers);
    const { features, errors, warnings } = await parseExcelFile(upload.file, sheetName, mapping);
    setUploads(prev => { const next = [...prev]; next[index] = { ...next[index], headers, mapping, features, errors, warnings, isLoading: false }; return next; });
  }, [uploads]);

  const handleProceed = () => {
    const runs: RunData[] = uploads
      .filter(u => u.features.length > 0 && u.errors.filter(e => e.severity === 'error').length === 0)
      .map((u, i) => ({
        id: `run-${i + 1}`, name: u.name, fileName: u.file!.name, date: u.date || undefined,
        features: u.features, units: u.units, sheetName: u.selectedSheet,
        columnMapping: u.mapping, validationErrors: u.errors, validationWarnings: u.warnings,
      }));
    dispatch({ type: 'SET_RUNS', runs });
    setTimeout(() => runAlignment(), 100);
  };

  const validUploads = uploads.filter(u => u.features.length > 0 && u.errors.filter(e => e.severity === 'error').length === 0);
  const isReady = validUploads.length >= 2;

  if (hasExampleData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Example Data Loaded</h2>
            <p className="text-2xs text-muted-foreground mt-0.5">{state.runs.length} synthetic ILI datasets ready for analysis</p>
          </div>
          <Button variant="default" size="sm" onClick={() => runAlignment()} disabled={state.isProcessing} className="font-mono text-xs uppercase tracking-wider">
            {state.isProcessing ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Processing</> : <>Run Alignment →</>}
          </Button>
        </div>

        <div className="border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-2xs font-mono uppercase">Run</TableHead>
                <TableHead className="text-2xs font-mono uppercase">Features</TableHead>
                <TableHead className="text-2xs font-mono uppercase">Reference Pts</TableHead>
                <TableHead className="text-2xs font-mono uppercase">Anomalies</TableHead>
                <TableHead className="text-2xs font-mono uppercase">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.runs.map(run => (
                <TableRow key={run.id}>
                  <TableCell className="text-xs font-medium">{run.name}</TableCell>
                  <TableCell className="font-mono-data">{run.features.length}</TableCell>
                  <TableCell className="font-mono-data">{run.features.filter(f => f.is_reference).length}</TableCell>
                  <TableCell className="font-mono-data">{run.features.filter(f => !f.is_reference).length}</TableCell>
                  <TableCell className="font-mono-data">{run.date ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Upload ILI Data</h2>
          <p className="text-2xs text-muted-foreground mt-0.5">Upload 2–3 Excel files. Columns auto-detected.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xs text-muted-foreground font-mono">{validUploads.length}/{uploads.length} ready</span>
          <Button variant="default" size="sm" onClick={handleProceed} disabled={!isReady || state.isProcessing} className="font-mono text-xs uppercase tracking-wider">
            {state.isProcessing ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Processing</> : <>Run Alignment →</>}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {uploads.map((upload, index) => (
          <RunUploadCard key={index} upload={upload} index={index} onFileDrop={handleFileDrop} onSheetChange={handleSheetChange}
            onUpdate={(field, value) => { setUploads(prev => { const next = [...prev]; next[index] = { ...next[index], [field]: value }; return next; }); }}
          />
        ))}

        {!showThird && (
          <button
            onClick={() => { setShowThird(true); setUploads(prev => [...prev, createEmptyUpload('Run 3 (Optional)')]); }}
            className="w-full border border-dashed py-2 text-2xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="h-3 w-3" />
            Add Third Run
          </button>
        )}
      </div>
    </div>
  );
}

function RunUploadCard({ upload, index, onFileDrop, onSheetChange, onUpdate }: {
  upload: RunUpload; index: number;
  onFileDrop: (index: number, file: File) => void;
  onSheetChange: (index: number, sheet: string) => void;
  onUpdate: (field: string, value: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); const file = e.dataTransfer.files[0]; if (file) onFileDrop(index, file); };

  if (!upload.file) {
    return (
      <div className="border bg-card">
        <div className="flex items-center gap-2 border-b px-3 py-1.5 bg-muted/30">
          <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">{upload.name}</span>
        </div>
        <div
          className={`drop-zone m-3 ${isDragOver ? 'drop-zone-active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mx-auto mb-2 text-muted-foreground" />
          <p className="text-xs text-foreground">Drop .xlsx / .xls or click</p>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) onFileDrop(index, file); }} />
        </div>
      </div>
    );
  }

  if (upload.isLoading) {
    return (
      <div className="border bg-card">
        <div className="flex items-center gap-2 border-b px-3 py-1.5 bg-muted/30">
          <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">{upload.name}</span>
        </div>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-accent mr-2" />
          <span className="text-xs text-muted-foreground">Parsing...</span>
        </div>
      </div>
    );
  }

  const errors = upload.errors.filter(e => e.severity === 'error');
  const warnings = upload.warnings.concat(upload.errors.filter(e => e.severity === 'warning'));
  const refCount = upload.features.filter(f => f.is_reference).length;
  const anomCount = upload.features.filter(f => !f.is_reference).length;

  return (
    <div className={`border bg-card ${errors.length > 0 ? 'border-destructive/40' : upload.features.length > 0 ? 'border-accent/30' : ''}`}>
      <div className="flex items-center justify-between border-b px-3 py-1.5 bg-muted/30">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-3 w-3 text-accent" />
          <span className="text-2xs font-mono uppercase tracking-wider text-foreground">{upload.name}</span>
          <span className="text-2xs text-muted-foreground font-mono">— {upload.file.name}</span>
        </div>
        {upload.features.length > 0 && errors.length === 0 && (
          <Badge variant="outline" className="text-success border-success/30 text-2xs py-0 h-4">
            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Ready
          </Badge>
        )}
      </div>

      <div className="px-3 py-2 space-y-2">
        <div className="flex gap-3 items-end">
          {upload.sheets.length > 1 && (
            <div className="w-36">
              <Label className="text-2xs font-mono uppercase tracking-wider">Sheet</Label>
              <Select value={upload.selectedSheet} onValueChange={(v) => onSheetChange(index, v)}>
                <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>{upload.sheets.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="w-32">
            <Label className="text-2xs font-mono uppercase tracking-wider">Date</Label>
            <Input type="date" value={upload.date} onChange={(e) => onUpdate('date', e.target.value)} className="h-7 text-xs mt-0.5" />
          </div>
          <div className="w-24">
            <Label className="text-2xs font-mono uppercase tracking-wider">Units</Label>
            <Select value={upload.units} onValueChange={(v) => onUpdate('units', v)}>
              <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="feet">Feet</SelectItem>
                <SelectItem value="meters">Meters</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3 text-2xs text-muted-foreground font-mono ml-auto self-end pb-0.5">
            <span>{upload.features.length} features</span>
            <span>{refCount} ref</span>
            <span>{anomCount} anom</span>
          </div>
        </div>

        {Object.keys(upload.mapping).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(upload.mapping).filter(([, v]) => v).map(([key, val]) => (
              <span key={key} className="inline-flex items-center border px-1.5 py-0 text-2xs font-mono text-muted-foreground">
                {key}→{val}
              </span>
            ))}
          </div>
        )}

        {errors.length > 0 && errors.map((e, i) => (
          <div key={i} className="flex items-start gap-1.5 text-2xs text-destructive">
            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />{e.message}
          </div>
        ))}
        {warnings.length > 0 && warnings.map((w, i) => (
          <div key={i} className="flex items-start gap-1.5 text-2xs text-warning">
            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />{w.message}
          </div>
        ))}
      </div>
    </div>
  );
}
