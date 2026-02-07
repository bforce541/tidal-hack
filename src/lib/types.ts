export interface RawFeature {
  feature_id: string;
  distance: number;
  odometer?: number;
  joint_number?: number;
  relative_position?: number;
  clock_position?: string;
  clock_position_deg: number;
  feature_type: string;
  depth_percent?: number;
  length?: number;
  width?: number;
  wall_thickness?: number;
  weld_type?: string;
  corrected_distance?: number;
  is_reference: boolean;
}

export interface RunData {
  id: string;
  name: string;
  fileName: string;
  date?: string;
  features: RawFeature[];
  units: 'feet' | 'meters';
  sheetName: string;
  columnMapping: ColumnMapping;
  validationErrors: ValidationError[];
  validationWarnings: ValidationError[];
}

export interface ColumnMapping {
  feature_id: string;
  distance: string;
  odometer?: string;
  joint_number?: string;
  relative_position?: string;
  clock_position?: string;
  feature_type: string;
  depth_percent?: string;
  length?: string;
  width?: string;
  wall_thickness?: string;
  weld_type?: string;
  [key: string]: string | undefined;
}

export interface ValidationError {
  type: 'missing_column' | 'missing_values' | 'duplicates' | 'invalid_format';
  message: string;
  severity: 'error' | 'warning';
  details?: string;
}

export interface AnchorMatch {
  anchorA: RawFeature;
  anchorB: RawFeature;
  distanceA: number;
  distanceB: number;
  drift: number;
  score: number;
}

export interface DriftPoint {
  distance: number;
  drift: number;
}

export interface AlignmentResult {
  runAId: string;
  runBId: string;
  anchorMatches: AnchorMatch[];
  driftPoints: DriftPoint[];
  quality: AlignmentQuality;
}

export interface AlignmentQuality {
  anchorCount: number;
  avgDriftError: number;
  maxDrift: number;
  coverage: number;
  score: number;
}

export interface MatchScoreComponents {
  distance_score: number;
  clock_score: number;
  type_score: number;
  dims_score: number;
}

export type ConfidenceLevel = 'HIGH' | 'MED' | 'LOW' | 'UNCERTAIN';

export interface MatchedGroup {
  group_id: string;
  features: Record<string, RawFeature | null>;
  correctedDistances: Record<string, number | null>;
  score: number;
  confidence: ConfidenceLevel;
  components: MatchScoreComponents;
  explanation: string;
  alternativeCandidates: AlternativeCandidate[];
}

export interface AlternativeCandidate {
  runId: string;
  feature: RawFeature;
  score: number;
  components: MatchScoreComponents;
}

export interface GrowthResult {
  group_id: string;
  depth_delta: number | null;
  length_delta: number | null;
  width_delta: number | null;
  depth_rate: number | null;
  length_rate: number | null;
  width_rate: number | null;
  years_between: number | null;
  flag: 'RAPID_GROWTH' | null;
}

export interface PipelineException {
  type: 'NEW' | 'MISSING' | 'UNCERTAIN' | 'RAPID_GROWTH';
  feature: RawFeature;
  runId: string;
  details: string;
  recommendation: string;
  matchedGroup?: MatchedGroup;
}

export interface Settings {
  distTolerance: number;
  clockTolerance: number;
  scoreThreshHigh: number;
  scoreThreshMed: number;
  scoreThreshLow: number;
  rapidGrowthDepth: number;
  rapidGrowthLength: number;
  weights: {
    distance: number;
    clock: number;
    type: number;
    dims: number;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  distTolerance: 5,
  clockTolerance: 30,
  scoreThreshHigh: 0.85,
  scoreThreshMed: 0.70,
  scoreThreshLow: 0.55,
  rapidGrowthDepth: 10,
  rapidGrowthLength: 2,
  weights: {
    distance: 0.4,
    clock: 0.2,
    type: 0.2,
    dims: 0.2,
  },
};

export interface QualityMetrics {
  totalAnchors: number;
  avgDriftError: number;
  matchedHigh: number;
  matchedMed: number;
  matchedLow: number;
  uncertain: number;
  newAnomalies: number;
  missingAnomalies: number;
  rapidGrowth: number;
  totalAnomalies: number;
}
