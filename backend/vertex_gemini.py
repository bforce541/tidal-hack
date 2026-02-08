from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


def _env_string(key: str) -> Optional[str]:
    v = os.getenv(key)
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _env_bool(key: str, fallback: bool = False) -> bool:
    v = _env_string(key)
    if v is None:
        return fallback
    return v.lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class VertexGeminiEnv:
    run: bool
    project_id: Optional[str]
    location: str
    model: str


def get_vertex_gemini_env() -> VertexGeminiEnv:
    """
    Backend-only config. Do not use VITE_* vars (those are client-exposed).
    """
    return VertexGeminiEnv(
        run=_env_bool("VERTEX_GEMINI_RUN", False),
        project_id=_env_string("VERTEX_PROJECT_ID"),
        location=_env_string("VERTEX_LOCATION") or "us-central1",
        model=_env_string("VERTEX_GEMINI_MODEL") or "gemini-1.5-pro",
    )


def build_projections_storyboard_prompt(
    *,
    baseline_year: Optional[int],
    target_year: int,
    key_takeaways: List[str],
    mean2030: Optional[float],
    p90_2030: Optional[float],
    high_risk_count2030: Optional[int],
) -> str:
    baseline_label = str(baseline_year) if baseline_year is not None else "baseline year (unknown)"
    bullets = "\n".join(f"- {t}" for t in key_takeaways) if key_takeaways else "- (none)"
    stats = "\n".join(
        [
            f"mean_depth_{target_year}: {f'{mean2030:.2f}%' if mean2030 is not None else 'unknown'}",
            f"p90_depth_{target_year}: {f'{p90_2030:.2f}%' if p90_2030 is not None else 'unknown'}",
            f"high_risk_count_{target_year}: {str(high_risk_count2030) if high_risk_count2030 is not None else 'unknown'}",
        ]
    )

    return "\n".join(
        [
            "You are a technical product designer. Generate a storyboard + shot list for a short projection timeline video.",
            "",
            "Constraints:",
            "- Duration: ~8 seconds.",
            "- Theme: clean, dark navy accents (#0B1F33), muted grays, subtle grid background.",
            "- Visual: a timeline that advances through inspection years and ends at the target year.",
            "- Output: JSON with fields: title, style_guide, shots[]. Each shot has: timestamp_start, timestamp_end, on_screen_text, motion, overlays, narration.",
            "- Do not fabricate numbers; only use the provided stats.",
            "",
            f"Baseline label: {baseline_label}",
            f"Target year: {target_year}",
            "",
            "Provided stats:",
            stats,
            "",
            "Key takeaways (use as on-screen text if suitable):",
            bullets,
            "",
            "Make the storyboard usable by an engineer to implement in a renderer (After Effects / Remotion / CSS canvas).",
        ]
    )


def build_gemini_request_template(*, prompt: str, temperature: float = 0.4, max_output_tokens: int = 1024) -> Dict[str, Any]:
    """
    Returns a request template for a server-side Vertex/Gemini integration.
    """
    vtx = get_vertex_gemini_env()
    endpoint_example = (
        f"https://{vtx.location}-aiplatform.googleapis.com/v1/projects/{vtx.project_id}/locations/{vtx.location}/publishers/google/models/{vtx.model}:generateContent"
        if vtx.project_id
        else f"https://{vtx.location}-aiplatform.googleapis.com/v1/projects/{{PROJECT_ID}}/locations/{vtx.location}/publishers/google/models/{vtx.model}:generateContent"
    )

    return {
        "vertex": {
            "project_id": vtx.project_id,
            "location": vtx.location,
            "model": vtx.model,
            "endpoint_example": endpoint_example,
        },
        "request": {
            "model": vtx.model,
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": temperature, "topP": 0.95, "maxOutputTokens": max_output_tokens},
            "safetySettings": [
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            ],
        },
        "flags": {"run": vtx.run},
    }

