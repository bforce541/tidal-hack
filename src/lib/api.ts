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
