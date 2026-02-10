# PipeAlign: Automated ILI Alignment & Integrity Analysis

Pipeline integrity analysis is high-stakes, but ILI data is messy: inconsistent vendor schemas, unit mismatches, and odometer drift make multi-run comparison slow and error-prone. Engineers often rely on manual spreadsheet alignment just to determine what actually changed.

PipeAlign turns raw, multi-year ILI files into a **deterministic, traceable integrity analysis** in minutes.

---

## What It Does

PipeAlign automates multi-run ILI analysis end-to-end:

- Ingests Excel/CSV ILI exports from different vendors  
- Normalizes schemas, units, and feature fields  
- Aligns inspection runs using **girth welds as fixed physical anchors**  
- Matches anomalies using **deterministic physical tolerances**  
- Explicitly flags **new**, **missing**, and **ambiguous** features  
- Computes corrosion growth rates  
- Generates tables, charts, and downloadable outputs  
- Projects integrity trends through **2030** (deterministic + optional ML)

---

## How It Works

PipeAlign is **deterministic by design**. All core logic is explainable, auditable, and conservative.

---

### 1. Normalization

All runs are converted into a canonical physical representation:

- Distance → meters  
- Clock position → degrees (0–360, circular)  
- Depth → percent wall thickness  
- Length / width → millimeters  

This guarantees apples-to-apples comparison across vendors and years.

---

### 2. Weld-Anchored Alignment (Odometer Drift Correction)

Runs are aligned segment-by-segment using matching **girth welds** as fixed landmarks.

For each segment bounded by two adjacent welds:

```
scale  = (d_prev2 - d_prev1) / (d_later2 - d_later1)
offset = d_prev1 - scale * d_later1
```

For any feature with raw distance `d_raw` in the later run:

```
d_corrected = scale * d_raw + offset
```

This piecewise linear mapping corrects odometer drift **without smoothing or overfitting**, preserving physical traceability.

---

### 3. Deterministic Anomaly Matching

After alignment, anomalies are matched using **hard physical constraints**:

- Axial distance tolerance  
- Circular clock difference  
- Feature type compatibility  

Candidates failing any constraint are discarded.

Each remaining candidate pair is scored:

```
score =
  w_d   * |Δd| +
  w_c   * Δθ +
  w_dep * |Δdepth| +
  w_len * |Δlength| +
  w_wid * |Δwidth|
```

Lower score = higher physical similarity.

**Ambiguity rule:**  
If the two best scores are within a small threshold `ε`, the anomaly is marked **Ambiguous** instead of forcing a match. This prevents false continuity in dense regions.

---

### 4. Growth & Projections

For matched anomalies:

```
growth_rate = (depth_2 - depth_1) / Δt
```

- **Deterministic projections:** bounded extrapolation through **2030**  
- **Optional ML projections:** advisory only; never override deterministic matching  

---

## Why This Matters

| Problem | PipeAlign Approach |
|------|-------------------|
| Vendor inconsistency | Canonical schema + unit normalization |
| Odometer drift | Weld-anchored segment alignment |
| Dense anomalies | Explicit ambiguity, no guessing |
| Trust gap | Deterministic math over black-box models |

**Key insight:** In infrastructure analytics, **defensibility beats sophistication**. Engineers trust results they can audit.

---

## Accomplishments

- Replaced hours of manual spreadsheet alignment  
- Deterministic matching with explicit uncertainty  
- Outputs aligned with professional integrity workflows  

---

## What’s Next

- Tolerance calibration using labeled review data  
- Multi-run continuity (e.g., 2007 → 2015 → 2022)  
- Hardened deployment with audit logs and persistence  

---

## Bottom Line

PipeAlign delivers **accurate, auditable multi-run ILI alignment**, with transparent math and explicit uncertainty — optimized for real integrity decisions.
