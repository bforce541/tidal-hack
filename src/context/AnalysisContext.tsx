import React, { createContext, useContext, useReducer, useCallback, useRef, ReactNode } from 'react';
import { RunData, Settings, DEFAULT_SETTINGS, AlignmentResult, MatchedGroup, GrowthResult, PipelineException, QualityMetrics, RawFeature } from '@/lib/types';
import { alignRuns, applyCorrection, getAnomalies } from '@/lib/alignment';
import { matchAnomalies, extendMatchesToThreeRuns } from '@/lib/matching';
import { calculateGrowth, findExceptions } from '@/lib/growth';

export interface AnalysisState {
  step: number;
  runs: RunData[];
  settings: Settings;
  alignments: AlignmentResult[];
  matchedGroups: MatchedGroup[];
  growthResults: GrowthResult[];
  exceptions: PipelineException[];
  unmatchedByRun: Record<string, RawFeature[]>;
  qualityMetrics: QualityMetrics | null;
  isProcessing: boolean;
}

const initialState: AnalysisState = {
  step: 0,
  runs: [],
  settings: DEFAULT_SETTINGS,
  alignments: [],
  matchedGroups: [],
  growthResults: [],
  exceptions: [],
  unmatchedByRun: {},
  qualityMetrics: null,
  isProcessing: false,
};

type Action =
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_RUNS'; runs: RunData[] }
  | { type: 'SET_SETTINGS'; settings: Settings }
  | { type: 'SET_ALIGNMENTS'; alignments: AlignmentResult[]; runs: RunData[] }
  | { type: 'SET_MATCH_RESULTS'; matchedGroups: MatchedGroup[]; unmatchedByRun: Record<string, RawFeature[]> }
  | { type: 'SET_GROWTH_RESULTS'; growthResults: GrowthResult[]; exceptions: PipelineException[]; metrics: QualityMetrics }
  | { type: 'SET_PROCESSING'; isProcessing: boolean }
  | { type: 'RESET' };

function reducer(state: AnalysisState, action: Action): AnalysisState {
  switch (action.type) {
    case 'SET_STEP': return { ...state, step: action.step };
    case 'SET_RUNS': return { ...state, runs: action.runs };
    case 'SET_SETTINGS': return { ...state, settings: action.settings };
    case 'SET_ALIGNMENTS': return { ...state, alignments: action.alignments, runs: action.runs };
    case 'SET_MATCH_RESULTS': return { ...state, matchedGroups: action.matchedGroups, unmatchedByRun: action.unmatchedByRun };
    case 'SET_GROWTH_RESULTS': return { ...state, growthResults: action.growthResults, exceptions: action.exceptions, qualityMetrics: action.metrics };
    case 'SET_PROCESSING': return { ...state, isProcessing: action.isProcessing };
    case 'RESET': return initialState;
    default: return state;
  }
}

interface AnalysisContextType {
  state: AnalysisState;
  dispatch: React.Dispatch<Action>;
  runAlignment: () => void;
  runMatching: () => void;
  runGrowthAnalysis: () => void;
}

const AnalysisContext = createContext<AnalysisContextType | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const runAlignment = useCallback(() => {
    const s = stateRef.current;
    dispatch({ type: 'SET_PROCESSING', isProcessing: true });

    setTimeout(() => {
      const runs = s.runs.map(r => ({ ...r }));
      if (runs.length < 2) return;

      const alignments: AlignmentResult[] = [];
      const baseRun = runs[0];
      // Set baseline corrected_distance
      runs[0] = { ...runs[0], features: runs[0].features.map(f => ({ ...f, corrected_distance: f.distance })) };

      for (let i = 1; i < runs.length; i++) {
        const result = alignRuns(baseRun, runs[i], s.settings);
        alignments.push(result);
        runs[i] = { ...runs[i], features: applyCorrection(runs[i].features, result.driftPoints) };
      }

      dispatch({ type: 'SET_ALIGNMENTS', alignments, runs });
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
      dispatch({ type: 'SET_STEP', step: 1 });
    }, 50);
  }, []);

  const runMatching = useCallback(() => {
    const s = stateRef.current;
    dispatch({ type: 'SET_PROCESSING', isProcessing: true });

    setTimeout(() => {
      const runs = s.runs;
      if (runs.length < 2) return;

      const anomaliesA = getAnomalies(runs[0]);
      const anomaliesB = getAnomalies(runs[1]);
      const { matched, unmatchedA, unmatchedB } = matchAnomalies(anomaliesA, anomaliesB, runs[0].id, runs[1].id, s.settings);

      let finalGroups = matched;
      const unmatchedByRun: Record<string, RawFeature[]> = { [runs[0].id]: unmatchedA, [runs[1].id]: unmatchedB };

      if (runs.length > 2) {
        const anomaliesC = getAnomalies(runs[2]);
        const { groups, unmatchedC } = extendMatchesToThreeRuns(
          matched, unmatchedA, unmatchedB, anomaliesC,
          runs[0].id, runs[1].id, runs[2].id, s.settings
        );
        finalGroups = groups;
        unmatchedByRun[runs[2].id] = unmatchedC;
      }

      dispatch({ type: 'SET_MATCH_RESULTS', matchedGroups: finalGroups, unmatchedByRun });
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
      dispatch({ type: 'SET_STEP', step: 2 });
    }, 50);
  }, []);

  const runGrowthAnalysis = useCallback(() => {
    const s = stateRef.current;
    dispatch({ type: 'SET_PROCESSING', isProcessing: true });

    setTimeout(() => {
      const { growthResults, exceptions: growthExceptions } = calculateGrowth(s.matchedGroups, s.runs, s.settings);
      const allExceptions = findExceptions(s.matchedGroups, s.unmatchedByRun, s.runs, growthExceptions);

      const metrics: QualityMetrics = {
        totalAnchors: s.alignments.reduce((sum, a) => sum + a.anchorMatches.length, 0),
        avgDriftError: s.alignments.length > 0 ? s.alignments.reduce((sum, a) => sum + a.quality.avgDriftError, 0) / s.alignments.length : 0,
        matchedHigh: s.matchedGroups.filter(g => g.confidence === 'HIGH').length,
        matchedMed: s.matchedGroups.filter(g => g.confidence === 'MED').length,
        matchedLow: s.matchedGroups.filter(g => g.confidence === 'LOW').length,
        uncertain: s.matchedGroups.filter(g => g.confidence === 'UNCERTAIN').length,
        newAnomalies: allExceptions.filter(e => e.type === 'NEW').length,
        missingAnomalies: allExceptions.filter(e => e.type === 'MISSING').length,
        rapidGrowth: allExceptions.filter(e => e.type === 'RAPID_GROWTH').length,
        totalAnomalies: s.matchedGroups.length,
      };

      dispatch({ type: 'SET_GROWTH_RESULTS', growthResults, exceptions: allExceptions, metrics });
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
      dispatch({ type: 'SET_STEP', step: 3 });
    }, 50);
  }, []);

  return (
    <AnalysisContext.Provider value={{ state, dispatch, runAlignment, runMatching, runGrowthAnalysis }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const context = useContext(AnalysisContext);
  if (!context) throw new Error('useAnalysis must be used within AnalysisProvider');
  return context;
}
