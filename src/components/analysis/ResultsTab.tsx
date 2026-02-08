import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileDown } from "lucide-react";
import { pipelineOutputUrl } from "@/lib/api";

export type TabStatus = "ok" | "error" | "pending";

export interface DownloadItem {
  label: string;
  url: string;
  kind?: "primary" | "secondary";
}

export interface ResultsTabMetrics {
  matched: number;
  new_or_unmatched: number;
  match_rate: number;
}

export interface ResultsTabProps {
  title: string;
  subtitle?: string;
  status: TabStatus;
  metrics?: ResultsTabMetrics;
  downloads: DownloadItem[];
  previewTable: { columns: string[]; rows: Record<string, string | number | null>[] };
  previewText: string;
  errorMessage?: string;
  emptyMessage?: string;
}

function formatCell(val: string | number | null | undefined): string {
  if (val == null || val === "") return "—";
  if (typeof val === "number") return Number.isInteger(val) ? String(val) : val.toFixed(3);
  return String(val);
}

export function ResultsTab({
  title,
  subtitle,
  status,
  metrics,
  downloads,
  previewTable,
  previewText: _previewText,
  errorMessage,
  emptyMessage,
}: ResultsTabProps) {
  const { columns, rows } = previewTable;
  const hasPreview = columns.length > 0 && rows.length > 0;

  const statusBadge =
    status === "ok" ? (
      <Badge variant="default" className="shrink-0">Success</Badge>
    ) : status === "error" ? (
      <Badge variant="destructive" className="shrink-0">Failed</Badge>
    ) : (
      <Badge variant="secondary" className="shrink-0">Running</Badge>
    );

  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {statusBadge}
      </div>

      {status === "error" && errorMessage && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{errorMessage}</p>
        </div>
      )}

      {emptyMessage && (
        <div className="rounded-md border border-border bg-muted/20 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      )}

      {status === "ok" && metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-md border border-border/80 bg-muted/20 px-4 py-3">
            <p className="text-lg font-semibold tabular-nums text-foreground">{metrics.matched}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Matched</p>
          </div>
          <div className="rounded-md border border-border/80 bg-muted/20 px-4 py-3">
            <p className="text-lg font-semibold tabular-nums text-foreground">{metrics.new_or_unmatched}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">New / unmatched</p>
          </div>
          <div className="rounded-md border border-border/80 bg-muted/20 px-4 py-3">
            <p className="text-lg font-semibold tabular-nums text-foreground">{metrics.match_rate}%</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Match rate</p>
          </div>
        </div>
      )}

      {status === "ok" && downloads.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Downloads</p>
          <div className="flex flex-wrap gap-2">
            {downloads.map(({ label, url }) => (
              <a key={label} href={pipelineOutputUrl(url)} download target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-2">
                  <FileDown className="h-3.5 w-3.5" />
                  {label}
                </Button>
              </a>
            ))}
          </div>
        </div>
      )}

      {status === "ok" && hasPreview && !emptyMessage && (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Preview</p>
          <div className="rounded-md border border-border/80 overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[320px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/80 border-b">
                    {columns.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap font-mono text-xs text-left">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      {columns.map((col) => (
                        <TableCell key={col} className="font-mono text-xs whitespace-nowrap">
                          {formatCell(row[col])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {status === "ok" && metrics && !emptyMessage && (
        <div className="rounded-md border border-border/80 bg-muted/10 px-4 py-3 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quick Summary</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>Compared {title} inspection runs and matched anomalies across runs.</li>
            <li>
              Found {(metrics.matched ?? 0) + (metrics.new_or_unmatched ?? 0)} anomalies in later run; matched {metrics.matched ?? "(not available)"} (match rate {metrics.match_rate != null ? `${metrics.match_rate}%` : "(not available)"}).
            </li>
            <li>Identified {metrics.new_or_unmatched ?? "(not available)"} anomalies that appear new in later run.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
