import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageSquare, Mic, MicOff } from 'lucide-react';
import { useAnalysis } from '@/context/AnalysisContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const STEPS = ['Upload', 'Alignment', 'Matching', 'Growth', 'Export'];

type Message = {
  id: string;
  role: 'user' | 'agent';
  content: string;
  status?: 'pending' | 'error' | 'done';
  attempts?: number;
};

type MvpState = {
  hasFile?: boolean;
  runs?: string;
  loading?: boolean;
  result?: {
    status?: string;
    metrics?: {
      matched?: number;
      new_or_unmatched?: number;
      missing?: number;
      ambiguous?: number;
      match_rate?: number;
    };
    preview?: {
      summary_text?: string;
      matches_rows?: Record<string, unknown>[];
    };
    outputs?: {
      matches_csv?: string;
      summary_txt?: string;
    };
    error?: boolean;
    message?: string;
  };
  preview?: {
    matched_preview?: Record<string, unknown>[];
    exceptions_preview?: Record<string, unknown>[];
  } | null;
  projections?: {
    hasData?: boolean;
    jobId?: string;
    years?: number[];
    count2030?: number;
    count2040?: number;
    top2030?: {
      anomaly_id?: string;
      depth?: number;
      growth_rate?: number | null;
      flags?: string[];
    } | null;
    top2040?: {
      anomaly_id?: string;
      depth?: number;
      growth_rate?: number | null;
      flags?: string[];
    } | null;
  };
};

export function AgentDrawer() {
  const { state, dispatch, runAlignment, runMatching, runGrowthAnalysis } = useAnalysis();
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [mvpState, setMvpState] = useState<MvpState | null>(null);
  const lastIntentRef = useRef<'mvp-analyze' | null>(null);
  const lastMvpJobRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldSpeakRef = useRef(false);
  const modelCache = useRef<string[] | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'agent',
      content: 'Ask me about the data, this page, or the current step.',
    },
  ]);

  const summary = useMemo(() => {
    const step = STEPS[state.step] ?? 'Upload';
    const nextStep = STEPS[state.step + 1];
    const runNames = state.runs.map(r => r.name).filter(Boolean);
    return {
      step,
      nextStep,
      runCount: state.runs.length,
      runNames,
      alignments: state.alignments.length,
      matches: state.matchedGroups.length,
      growth: state.growthResults.length,
      exceptions: state.exceptions.length,
      hasMetrics: state.qualityMetrics != null,
      isProcessing: state.isProcessing,
    };
  }, [
    state.alignments.length,
    state.exceptions.length,
    state.growthResults.length,
    state.isProcessing,
    state.matchedGroups.length,
    state.qualityMetrics,
    state.runs,
    state.step,
  ]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<MvpState>).detail;
      setMvpState(detail);
    };
    window.addEventListener('mvp:state', handler as EventListener);
    return () => window.removeEventListener('mvp:state', handler as EventListener);
  }, []);

  useEffect(() => {
    if (!mvpState?.result || mvpState.result.error) return;
    if (mvpState.result.status !== 'ok') return;
    const jobKey = `${mvpState.result.metrics?.matched ?? 0}-${mvpState.result.metrics?.match_rate ?? 0}`;
    if (lastMvpJobRef.current === jobKey) return;
    lastMvpJobRef.current = jobKey;
  }, [mvpState]);

  const answerQuestion = (raw: string) => {
    const q = raw.trim().toLowerCase();
    const hasData = summary.runCount > 0;
    const onMvp = window.location.pathname.includes('/mvp');
    const onProjections = window.location.pathname.includes('/mvp/projections');
    const mvpMetrics = mvpState?.result?.metrics;
    const mvpMatchRate = mvpMetrics?.match_rate ?? 0;
    const mvpHasResults = Boolean(mvpState?.result && !mvpState?.result?.error && mvpState?.result?.status === 'ok');
    const projectionData = mvpState?.projections;
    const hasProjectionData = Boolean(projectionData?.hasData);
    const stepLine = `You're on step ${state.step + 1}/${STEPS.length}: ${summary.step}.`;
    const nextLine = summary.nextStep ? `Next step: ${summary.nextStep}.` : 'This is the final step.';

    if (q.includes('step') || q.includes('current')) {
      return `${stepLine} ${nextLine}`;
    }

    if (q.includes('next') || q.includes('do now') || q.includes('what should')) {
      if (summary.isProcessing) {
        return 'Processing is running. Wait for the current step to finish, then continue.';
      }
      if (!hasData) {
        return 'Upload ILI runs first. Use the Upload step to import your files.';
      }
      if (summary.alignments === 0) {
        return 'Run alignment to compute drift correction and anchor matches.';
      }
      if (summary.matches === 0) {
        return 'Run matching to connect anomalies across runs.';
      }
      if (summary.growth === 0) {
        return 'Run growth analysis to compute rates and exceptions.';
      }
      return 'Review results and export the report in the Export step.';
    }

    if (q.includes('data') || q.includes('run') || q.includes('dataset')) {
      if (onProjections) {
        if (!hasProjectionData) return 'Future projection data is not loaded yet on this page.';
        return `Future projections are loaded. Rows: ${projectionData?.count2030 ?? 0} for 2030 and ${projectionData?.count2040 ?? 0} for 2040.`;
      }
      if (onMvp) {
        if (!mvpHasResults) return 'No MVP results yet. Upload a file and run the MVP.';
        return `MVP results are ready. Match rate: ${mvpMatchRate}%. Matched: ${mvpMetrics?.matched ?? 0}, new/unmatched: ${mvpMetrics?.new_or_unmatched ?? 0}, missing: ${mvpMetrics?.missing ?? 0}, ambiguous: ${mvpMetrics?.ambiguous ?? 0}.`;
      }
      if (!hasData) return 'No runs loaded yet. Upload files or load the example dataset.';
      const names = summary.runNames.length > 0 ? `Runs: ${summary.runNames.join(', ')}.` : 'Runs are loaded.';
      return `Loaded ${summary.runCount} run(s). ${names}`;
    }

    if (onMvp && (q.includes('result') || q.includes('mvp') || q.includes('summary') || q.includes('download') || q.includes('explain'))) {
      if (!mvpHasResults) return 'MVP has not finished yet. Run the MVP to generate results.';
      const download = mvpState?.result?.outputs?.matches_csv ? 'Downloads are available in the Downloads section.' : 'Downloads not ready yet.';
      const summaryText = mvpState?.result?.preview?.summary_text ? 'Summary text is available below.' : 'Summary text not available.';
      return `MVP summary: match rate ${mvpMatchRate}%. Matched ${mvpMetrics?.matched ?? 0}, new/unmatched ${mvpMetrics?.new_or_unmatched ?? 0}, missing ${mvpMetrics?.missing ?? 0}, ambiguous ${mvpMetrics?.ambiguous ?? 0}. ${download} ${summaryText}`;
    }

    if (onProjections && (q.includes('future') || q.includes('projection') || q.includes('2030') || q.includes('2040') || q.includes('explain') || q.includes('result'))) {
      if (!hasProjectionData) return 'Future projections are not available yet. Open this page after MVP finishes and loads projection data.';
      const top2030 = projectionData?.top2030;
      const top2040 = projectionData?.top2040;
      const top2030Line = top2030
        ? `Top 2030 anomaly: ${top2030.anomaly_id ?? 'N/A'} at depth ${top2030.depth ?? 0}%.`
        : 'No top 2030 anomaly available.';
      const top2040Line = top2040
        ? `Top 2040 anomaly: ${top2040.anomaly_id ?? 'N/A'} at depth ${top2040.depth ?? 0}%.`
        : 'No top 2040 anomaly available.';
      return `This page shows future anomaly projections. Row counts: 2030 = ${projectionData?.count2030 ?? 0}, 2040 = ${projectionData?.count2040 ?? 0}. ${top2030Line} ${top2040Line}`;
    }

    if (q.includes('page') || q.includes('screen') || q.includes('view') || q.includes('where am')) {
      return 'This is the Analysis workspace. The left sidebar shows steps and run status; the main panel shows the active step output and actions.';
    }

    if (q.includes('alignment') || q.includes('align')) {
      if (summary.alignments === 0) {
        return 'No alignment results yet. Run alignment after at least two runs are loaded.';
      }
      return `Alignment results are available for ${summary.alignments} run pair(s).`;
    }

    if (q.includes('match')) {
      if (summary.matches === 0) return 'No match results yet. Run matching after alignment.';
      return `${summary.matches} matched anomaly groups are available.`;
    }

    if (q.includes('growth') || q.includes('exception')) {
      if (summary.growth === 0) return 'No growth results yet. Run growth analysis after matching.';
      return `Growth results: ${summary.growth} records, ${summary.exceptions} exception(s).`;
    }

    if (q.includes('stats') || q.includes('metrics') || q.includes('quality')) {
      if (!summary.hasMetrics) return 'Quality metrics will appear after growth analysis.';
      return 'Quality metrics are available in the sidebar stats panel.';
    }

    return 'I can answer questions about the data, this page, or the current step. Try asking about runs, alignment, matching, growth, or what to do next.';
  };

  const runCommand = (raw: string) => {
    const q = raw.trim().toLowerCase().replace(/^hey piper[,\s]+/i, '');
    const runAlign = /run\s+(the\s+)?alignment|start\s+(the\s+)?alignment|align\s+runs/;
    const runMatch = /run\s+(the\s+)?matching|start\s+(the\s+)?matching|match\s+anomalies/;
    const runGrowth = /run\s+(the\s+)?growth|start\s+(the\s+)?growth|growth\s+analysis/;
    const runAnalytics = /run\s+(the\s+)?analytics|run\s+analysis/;
    const runMvp = /run\s+(the\s+)?mvp/;
    const analyzeFile = /analyze(\s+(the|this|my))?\s+file|analyze\s+it/;
    const showFuture = /show\s+(me\s+)?(the\s+)?future\s+projections|open\s+(the\s+)?future\s+projections|future\s+projections/;
    if (runAlign.test(q)) {
      runAlignment();
      return 'Running alignment now.';
    }
    if (runMatch.test(q)) {
      runMatching();
      return 'Running matching now.';
    }
    if (runGrowth.test(q)) {
      runGrowthAnalysis();
      return 'Running growth analysis now.';
    }
    if (runMvp.test(q) || analyzeFile.test(q)) {
      window.dispatchEvent(new Event('mvp:run'));
      const close = document.querySelector<HTMLButtonElement>('[data-agent-close]');
      close?.click();
      lastIntentRef.current = 'mvp-analyze';
      return 'Analyzing the file now.';
    }
    if (showFuture.test(q)) {
      window.dispatchEvent(new Event('mvp:open-projections'));
      const close = document.querySelector<HTMLButtonElement>('[data-agent-close]');
      close?.click();
      return 'Opening future projections now.';
    }
    if (runAnalytics.test(q)) {
      if (state.runs.length < 2) return 'Upload at least two runs before running analytics.';
      if (state.alignments.length === 0) {
        runAlignment();
        return 'Running alignment now.';
      }
      if (state.matchedGroups.length === 0) {
        runMatching();
        return 'Running matching now.';
      }
      runGrowthAnalysis();
      return 'Running growth analysis now.';
    }
    if (q.includes('go to upload')) {
      dispatch({ type: 'SET_STEP', step: 0 });
      return 'Switched to Upload step.';
    }
    if (q.includes('go to alignment')) {
      dispatch({ type: 'SET_STEP', step: 1 });
      return 'Switched to Alignment step.';
    }
    if (q.includes('go to matching')) {
      dispatch({ type: 'SET_STEP', step: 2 });
      return 'Switched to Matching step.';
    }
    if (q.includes('go to growth')) {
      dispatch({ type: 'SET_STEP', step: 3 });
      return 'Switched to Growth step.';
    }
    if (q.includes('go to export')) {
      dispatch({ type: 'SET_STEP', step: 4 });
      return 'Switched to Export step.';
    }
    return null;
  };

  const apiUrl = (import.meta.env.VITE_AGENT_API_URL as string | undefined) || '';
  const featherlessKey = (import.meta.env.VITE_FEATHERLESS_API_KEY as string | undefined) || '';
  const featherlessModel =
    (import.meta.env.VITE_FEATHERLESS_MODEL as string | undefined) || 'TeichAI/Nemotron-Orchestrator-8B-DeepSeek-v3.2-Speciale-Distill';
  const elevenKey = (import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined) || '';
  const elevenVoiceId = (import.meta.env.VITE_ELEVENLABS_VOICE_ID as string | undefined) || '';
  const elevenModel = (import.meta.env.VITE_ELEVENLABS_MODEL as string | undefined) || 'eleven_multilingual_v2';

  const buildContext = () => ({
    page: window.location.pathname.includes('/mvp/projections')
      ? 'Future Projections'
      : window.location.pathname.includes('/mvp')
        ? 'MVP'
        : 'Analysis',
    stepIndex: state.step,
    stepLabel: summary.step,
    isProcessing: summary.isProcessing,
    runs: state.runs.map(r => ({
      id: r.id,
      name: r.name,
      date: r.date,
      fileName: r.fileName,
      units: r.units,
      featureCount: r.features.length,
      validationErrors: r.validationErrors.length,
      validationWarnings: r.validationWarnings.length,
    })),
    counts: {
      runs: summary.runCount,
      alignments: summary.alignments,
      matches: summary.matches,
      growth: summary.growth,
      exceptions: summary.exceptions,
    },
    qualityMetrics: state.qualityMetrics,
    settings: state.settings,
    mvp: mvpState,
  });

  const buildContextSummary = () => {
    const alignmentSummary = state.alignments.map(a => ({
      runAId: a.runAId,
      runBId: a.runBId,
      anchors: a.anchorMatches.length,
      avgDriftError: a.quality.avgDriftError,
      maxDrift: a.quality.maxDrift,
      coverage: a.quality.coverage,
      score: a.quality.score,
    }));

    const confidenceCounts = state.matchedGroups.reduce(
      (acc, g) => {
        acc[g.confidence] = (acc[g.confidence] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const exceptionCounts = state.exceptions.reduce(
      (acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const sampleMatches = state.matchedGroups.slice(0, 3).map(g => ({
      id: g.group_id,
      confidence: g.confidence,
      score: g.score,
      explanation: g.explanation,
    }));

    return [
      `STEP: ${summary.step} (${state.step + 1}/${STEPS.length})`,
      `RUNS: ${summary.runCount} (${summary.runNames.join(', ') || 'unnamed'})`,
      `ALIGNMENTS: ${summary.alignments}`,
      `MATCHES: ${summary.matches} (HIGH ${confidenceCounts.HIGH || 0}, MED ${confidenceCounts.MED || 0}, LOW ${confidenceCounts.LOW || 0}, UNCERTAIN ${confidenceCounts.UNCERTAIN || 0})`,
      `GROWTH RESULTS: ${summary.growth}`,
      `EXCEPTIONS: ${summary.exceptions} (${Object.entries(exceptionCounts).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'})`,
      alignmentSummary.length > 0
        ? `ALIGNMENT METRICS (first pair): anchors ${alignmentSummary[0].anchors}, avg drift ${alignmentSummary[0].avgDriftError.toFixed(2)} ft, max drift ${alignmentSummary[0].maxDrift.toFixed(2)} ft, coverage ${(alignmentSummary[0].coverage * 100).toFixed(0)}%, score ${alignmentSummary[0].score.toFixed(3)}`
        : 'ALIGNMENT METRICS: none',
      sampleMatches.length > 0
        ? `SAMPLE MATCHES: ${sampleMatches.map(m => `${m.id} ${m.confidence} ${m.score.toFixed(3)}`).join(' | ')}`
        : 'SAMPLE MATCHES: none',
      mvpState?.result?.metrics
        ? `MVP SUMMARY: match rate ${mvpState.result.metrics.match_rate ?? 0}%, matched ${mvpState.result.metrics.matched ?? 0}, new/unmatched ${mvpState.result.metrics.new_or_unmatched ?? 0}, missing ${mvpState.result.metrics.missing ?? 0}, ambiguous ${mvpState.result.metrics.ambiguous ?? 0}`
        : 'MVP SUMMARY: none',
      mvpState?.projections?.hasData
        ? `FUTURE PROJECTIONS: 2030 rows ${mvpState.projections.count2030 ?? 0}, 2040 rows ${mvpState.projections.count2040 ?? 0}`
        : 'FUTURE PROJECTIONS: none',
    ].join('\n');
  };

  const resolveModelId = async () => {
    if (modelCache.current) return modelCache.current;
    if (!featherlessKey) return null;
    try {
      const res = await fetch('https://api.featherless.ai/v1/models?available_on_current_plan=true', {
        headers: { Authorization: `Bearer ${featherlessKey}` },
      });
      if (!res.ok) throw new Error('Model list request failed');
      const data = await res.json();
      const ids = Array.isArray(data?.data) ? data.data.map((m: { id: string }) => m.id).filter(Boolean) : [];
      modelCache.current = ids;
      return ids;
    } catch {
      return null;
    }
  };

  const pickBestModelId = (ids: string[]) => {
    const preferred = [
      /qwen.*2\.5.*7b/i,
      /qwen.*7b/i,
      /teichai\/nemotron-orchestrator-8b-deepseek-v3\.2-speciale-distill/i,
      /teichai\/qwen3-8b-deepseek-v3\.2-speciale-distill/i,
      /deepseek.*v3\.2/i,
      /deepseek.*v3/i,
      /deepseek.*r1/i,
    ];
    for (const re of preferred) {
      const found = ids.find(id => re.test(id));
      if (found) return found;
    }
    return null;
  };

  const sendToAgent = async (text: string) => {
    if (!apiUrl && !featherlessKey) return null;
    const history = messages
      .filter(m => m.id !== 'welcome')
      .slice(-2)
      .map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.content }));
    const context = buildContext();
    const contextSummary = buildContextSummary();
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 12000);

      if (apiUrl) {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: text,
            context,
            history,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Agent request failed');
        const data = await res.json();
        window.clearTimeout(timeoutId);
        if (typeof data?.answer === 'string') return data.answer;
        return null;
      }

      const system = [
        'You are an expert assistant for a pipeline ILI alignment app.',
        'Answer questions about data, current page, steps, and what happened so far.',
        'Always include concrete numbers from context when available.',
        'If the question is about alignment, cite anchor count, drift error, coverage, and score if present.',
        'If the question is about matching, cite match count and confidence breakdown.',
        'If context lacks data, say exactly what is missing.',
        `Context Summary:\n${contextSummary}`,
      ].join('\n');

      const modelIds = await resolveModelId();
      const selectedModel = modelIds && !modelIds.includes(featherlessModel)
        ? pickBestModelId(modelIds) || featherlessModel
        : featherlessModel;

      const res = await fetch('https://api.featherless.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${featherlessKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: system },
            ...history,
            { role: 'user', content: text },
          ],
          temperature: 0.2,
          top_p: 0.8,
          max_tokens: 128,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Agent request failed (${res.status}) ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      window.clearTimeout(timeoutId);
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) return content;
      return null;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setLastError('Agent request timed out');
        return null;
      }
      const message = err instanceof Error ? err.message : 'Agent request failed';
      setLastError(message);
      return null;
    }
  };

  const cleanTranscript = (text: string) => (
    text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<\/?think>/gi, '')
      .replace(/^\s*think[:\s-]*/i, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/[`_~]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );

  const speakText = async (text: string) => {
    if (!elevenKey || !elevenVoiceId) {
      setLastError('ElevenLabs key or voice ID missing');
      return;
    }
    const cleaned = cleanTranscript(text);
    if (!cleaned) return;
    try {
      setIsSpeaking(true);
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenVoiceId}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': elevenKey,
        },
        body: JSON.stringify({
          text: cleaned,
          model_id: elevenModel,
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.65,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`ElevenLabs TTS failed (${res.status}) ${body.slice(0, 200)}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setIsSpeaking(false);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setIsSpeaking(false);
      };
      await audio.play();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ElevenLabs TTS failed';
      setLastError(message);
      setIsSpeaking(false);
    }
  };

  const startListening = () => {
    const SpeechRecognitionImpl = (window as typeof window & {
      webkitSpeechRecognition?: typeof SpeechRecognition;
      SpeechRecognition?: typeof SpeechRecognition;
    }).SpeechRecognition || (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognitionImpl) {
      setLastError('SpeechRecognition not supported in this browser');
      return;
    }
    setLastError(null);
    const recognition = new SpeechRecognitionImpl();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        void submit(transcript, { speak: true });
      }
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const submit = async (text?: string, options?: { speak?: boolean }) => {
    const value = (text ?? '').trim();
    if (!value) return;
    const idBase = String(Date.now());
    setMessages(prev => [
      ...prev,
      { id: `${idBase}-u`, role: 'user', content: value, status: 'done' },
      { id: `${idBase}-a`, role: 'agent', content: '…', status: 'pending', attempts: 0 },
    ]);
    setIsThinking(true);
    setLastError(null);
    shouldSpeakRef.current = Boolean(options?.speak);

    const commandResponse = runCommand(value);
    if (commandResponse) {
      const response = cleanTranscript(commandResponse);
      const agentId = `${idBase}-a`;
      setMessages(prev => prev.map(m => (m.id === agentId ? { ...m, content: response, status: 'done' } : m)));
      setIsThinking(false);
      if (shouldSpeakRef.current) {
        void speakText(response);
        shouldSpeakRef.current = false;
      }
      return;
    }

    const agentId = `${idBase}-a`;

    let remote = await sendToAgent(value);
    if (!remote) {
      setMessages(prev => prev.map(m => (
        m.id === agentId ? { ...m, content: 'Retrying…', status: 'pending', attempts: (m.attempts ?? 0) + 1 } : m
      )));
      remote = await sendToAgent(value);
    }

    let response = cleanTranscript(remote ?? answerQuestion(value));
    if (!response) {
      response = cleanTranscript(answerQuestion(value));
    }
    setMessages(prev => prev.map(m => (m.id === agentId ? { ...m, content: response, status: 'done' } : m)));
    setIsThinking(false);
    if (shouldSpeakRef.current) {
      void speakText(response);
      shouldSpeakRef.current = false;
    }
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      conversationEndRef.current?.scrollIntoView({ block: 'end' });
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, [messages, isThinking, isSpeaking]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="accent"
          size="sm"
          className="w-full h-[30vh] min-h-[180px] max-h-[260px] rounded-xl border-2 border-white/35 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--accent)/0.88),hsl(var(--accent))_38%,hsl(214_72%_7%)_100%)] px-4 text-[12px] font-mono uppercase tracking-[0.24em] shadow-[0_16px_36px_hsl(var(--accent)/0.38),inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_-22px_44px_rgba(255,255,255,0.06)] hover:brightness-110"
        >
          <div className="flex h-full w-full flex-col items-start justify-between py-3">
            <div className="flex items-center gap-2">
              <div className="rounded-md border border-white/35 bg-white/15 p-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
                <Bot className="h-5 w-5" />
              </div>
              <span className="text-[13px] font-semibold tracking-[0.28em] text-white">Piper</span>
            </div>
            <div className="space-y-1 text-left">
              <p className="text-[12px] font-semibold tracking-[0.2em] text-white">Agent</p>
              <p className="text-[10px] text-white/90 tracking-[0.14em]">Voice Assistant</p>
              <p className="text-[10px] text-white/80 tracking-[0.14em]">Tap to Open</p>
            </div>
          </div>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[1300px] overflow-hidden border-r border-accent/20 bg-gradient-to-b from-background via-background to-accent/5">
        <SheetHeader className="border-b border-accent/15 pb-4">
          <SheetTitle className="text-sm font-mono uppercase tracking-[0.28em] text-foreground">Piper</SheetTitle>
          <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Voice Assistant</p>
        </SheetHeader>
        <SheetClose className="sr-only" data-agent-close>Close</SheetClose>

        <div className="mt-4 space-y-4 h-full flex flex-col pb-14">
          <form
            className="border border-accent/20 bg-card/80 backdrop-blur-sm p-3 sticky top-0 z-10 rounded-md"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 text-2xs font-mono uppercase tracking-wider w-full"
                  onClick={() => (isListening ? stopListening() : startListening())}
                >
                  {isListening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                  {isListening ? 'Listening' : 'Speak'}
                </Button>
                <div
                  className={cn(
                    'h-8 w-8 rounded-full border border-accent/40 bg-accent/10 flex items-center justify-center overflow-hidden',
                    isSpeaking && 'bg-accent/30 shadow-[0_0_14px_hsl(var(--accent)/0.45)] animate-[pulse_0.9s_ease-in-out_infinite]',
                  )}
                  aria-label="Speaking indicator"
                >
                  <span
                    className={cn(
                      'h-0.5 w-4 bg-accent/60 transition-all',
                      isSpeaking && 'animate-[pulse_0.7s_ease-in-out_infinite] bg-accent',
                    )}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 text-2xs font-mono uppercase tracking-wider w-full"
                  onClick={() => {
                    stopListening();
                    if (audioRef.current) {
                      audioRef.current.pause();
                      audioRef.current.currentTime = 0;
                    }
                    setIsSpeaking(false);
                  }}
                >
                  Stop
                </Button>
              </div>
            </div>
            {lastError && <p className="text-2xs text-destructive mt-2">Error: {lastError}</p>}
          </form>

          <div className="flex-1 border border-accent/20 bg-card/90 overflow-auto mb-6 rounded-md shadow-[0_10px_30px_rgba(2,6,23,0.08)]">
            <div className="border-b border-accent/15 px-3 py-2 bg-muted/20 flex items-center gap-2">
              <MessageSquare className="h-3 w-3 text-accent" />
              <span className="text-2xs font-mono uppercase tracking-[0.18em] text-muted-foreground">Conversation</span>
            </div>
            <div ref={scrollRef} className="p-3 space-y-3 max-h-[48vh] overflow-auto">
              {messages.map((msg, idx) => {
                const isAgent = msg.role === 'agent';
                const prev = messages[idx - 1];
                const retryTarget = isAgent && msg.status === 'error' ? prev : null;

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'rounded-md px-3 py-2 text-2xs leading-relaxed',
                      isAgent ? 'bg-muted/40 text-foreground' : 'bg-accent/10 text-foreground',
                    )}
                  >
                    <p className="font-mono uppercase tracking-wider text-[10px] text-muted-foreground mb-1">
                      {isAgent ? 'Agent' : 'You'}
                    </p>
                    <p>{msg.content}</p>
                    {isAgent && msg.status === 'error' && retryTarget?.role === 'user' && (
                      <div className="mt-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-2xs font-mono uppercase tracking-wider"
                          onClick={() => void submit(retryTarget.content, { speak: true })}
                        >
                          Retry
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              {isThinking && (
                <div className="rounded-md px-3 py-2 text-2xs leading-relaxed bg-muted/40 text-foreground">
                  <p className="font-mono uppercase tracking-wider text-[10px] text-muted-foreground mb-1">Agent</p>
                  <p>Thinking...</p>
                </div>
              )}
              <div ref={conversationEndRef} />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
