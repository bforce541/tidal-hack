/**
 * Backend API base URL for ILI MVP.
 * Set VITE_API_BASE_URL in .env (e.g. http://localhost:8000) or it defaults to http://localhost:8000.
 */
const base = () =>
  (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL) ||
  "http://localhost:8000";
export const API_BASE_URL = base();

export function runMvpUrl(): string {
  return `${base().replace(/\/$/, "")}/run-mvp`;
}

export function downloadUrl(jobId: string): string {
  return `${base().replace(/\/$/, "")}/download/${jobId}`;
}

export function previewUrl(jobId: string, limit = 50, ambiguousLimit = 25): string {
  return `${base().replace(/\/$/, "")}/preview/${jobId}?limit=${limit}&ambiguous_limit=${ambiguousLimit}`;
}

export function schemaReportUrl(jobId: string): string {
  return `${base().replace(/\/$/, "")}/schema/${jobId}`;
}

// File upload (before pipeline run)
export function uploadsUrl(): string {
  return `${base().replace(/\/$/, "")}/api/uploads`;
}

export interface UploadResponse {
  storedPath: string;
  originalName: string;
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(uploadsUrl(), { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail || "Upload failed");
  }
  return res.json();
}

// Unified pipeline (primary CTA: Analyze)
export function pipelineRunUrl(): string {
  return `${base().replace(/\/$/, "")}/api/pipeline/run`;
}

export function pipelineFileUrl(jobId: string, relativePath: string): string {
  const path = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
  return `${base().replace(/\/$/, "")}/api/files/${jobId}/${path}`;
}

/** Full URL for an output path returned by the pipeline API (e.g. /api/files/...). */
export function pipelineOutputUrl(serverRelativePath: string): string {
  const path = serverRelativePath.startsWith("/") ? serverRelativePath : `/${serverRelativePath}`;
  return `${base().replace(/\/$/, "")}${path}`;
}

export function dataReadyBundleUrl(): string {
  return `${base().replace(/\/$/, "")}/api/pipeline/data_ready_bundle.zip`;
}

export interface PipelineRunBody {
  inputPath: string;
  runs: number[];
  debug?: boolean;
}

export interface PipelineRunOutputs {
  matches_csv: string;
  summary_txt: string;
}

export interface PipelineRunResponse {
  status: string;
  job_id?: string;
  outputs: PipelineRunOutputs;
  preview: {
    matches_rows: Record<string, string | number | null>[];
    summary_text: string;
  };
  metrics: {
    matched: number;
    new_or_unmatched: number;
    missing: number;
    ambiguous: number;
    match_rate: number;
  };
}

export function projectUrl(): string {
  return `${base().replace(/\/$/, "")}/project`;
}

export interface ProjectRequestBody {
  job_id: string;
  target_years: number[];
}

export interface ProjectResponse {
  download_url: string;
  preview: Record<string, string | number | null>[];
}

export async function requestProject(body: ProjectRequestBody): Promise<ProjectResponse> {
  const res = await fetch(projectUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail || "Projections failed");
  }
  return res.json();
}

export interface VisualPoint {
  anomaly_id: string;
  year: number;
  depth: number;
  growth_rate: number | null;
  flags: string[];
}

export interface ProjectVisualResponse {
  points: VisualPoint[];
  years: number[];
}

export function projectVisualUrl(jobId: string): string {
  return `${base().replace(/\/$/, "")}/project/visual/${jobId}`;
}

export async function fetchProjectVisual(jobId: string): Promise<ProjectVisualResponse> {
  const res = await fetch(projectVisualUrl(jobId));
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail || "Visual data failed");
  }
  return res.json();
}

export function pipelinePreviewUrl(limit: number, prevYear: number, laterYear: number): string {
  return `${base().replace(/\/$/, "")}/api/pipeline/preview?limit=${limit}&prev_year=${prevYear}&later_year=${laterYear}`;
}

export async function runPipeline(body: PipelineRunBody): Promise<PipelineRunResponse> {
  const res = await fetch(pipelineRunUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail || "Pipeline failed");
  }
  return res.json();
}

export interface PreviewResponse {
  matched_preview: Record<string, string | number>[];
  ambiguous_preview: Record<string, string | number>[];
  new_count: number;
  missing_count: number;
  ambiguous_count: number;
  matched_count: number;
}

export async function fetchPreview(jobId: string): Promise<PreviewResponse> {
  const res = await fetch(previewUrl(jobId));
  if (!res.ok) throw new Error(res.status === 404 ? "Preview not found" : "Failed to load preview");
  return res.json();
}
