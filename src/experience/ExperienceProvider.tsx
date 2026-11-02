import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ExperienceContext, type ExperienceContextValue } from './context';
import { readExperienceSignals, resolveTier, type ExperienceSignals } from './detect';
import {
  CINEMATIC_MIN_FPS, EXPERIENCE_PROFILES, EXPERIENCE_STORAGE_KEY, EXTREME_MIN_FPS,
  FPS_SAMPLE_DURATION_MS, FPS_SAMPLE_WARMUP_MS, isExperienceMode,
  type ExperienceMode, type ExperienceTier,
} from './profiles';

function readMode(): ExperienceMode {
  try {
    const saved = localStorage.getItem(EXPERIENCE_STORAGE_KEY);
    return isExperienceMode(saved) ? saved : 'auto';
  } catch {
    return 'auto';
  }
}

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ExperienceMode>(readMode);
  const [signals, setSignals] = useState<ExperienceSignals>(readExperienceSignals);
  const [runtimeCap, setRuntimeCap] = useState<ExperienceTier | null>(null);
  const [adjustment, setAdjustment] = useState<ExperienceTier | null>(null);
  const [monitorRequest, setMonitorRequest] = useState(0);
  const signalRef = useRef(signals);
  const modeRef = useRef(mode);
  const tierRef = useRef<ExperienceTier>(mode === 'auto' ? resolveTier(signals) : mode);
  const rendererReadyRef = useRef(false);
  const samplesRef = useRef<Array<{ at: number; fps: number }>>([]);
  const sampleStartRef = useRef<number | null>(null);
  const sampleTimerRef = useRef<number | null>(null);
  const downgradedStepsRef = useRef(new Set<string>());
  const restartSamplingRef = useRef<() => void>(() => {});
  const detectedTier = mode === 'auto' ? resolveTier(signals) : mode;
  const tier = useMemo(() => {
    if (mode !== 'auto' || !runtimeCap) return detectedTier;
    const rank: Record<ExperienceTier, number> = { minimal: 0, cinematic: 1, extreme: 2 };
    return rank[runtimeCap] < rank[detectedTier] ? runtimeCap : detectedTier;
  }, [detectedTier, mode, runtimeCap]);

  useLayoutEffect(() => {
    signalRef.current = signals;
    modeRef.current = mode;
    tierRef.current = tier;
    document.documentElement.dataset.experience = tier;
  }, [signals, mode, tier]);

  const setMode = useCallback((next: ExperienceMode) => {
    setModeState(next);
    setAdjustment(null);
    if (next === 'auto') {
      setRuntimeCap(null);
      setMonitorRequest((request) => request + 1);
    }
    try { localStorage.setItem(EXPERIENCE_STORAGE_KEY, next); } catch { /* almacenamiento opcional */ }
  }, []);

  useEffect(() => {
    const update = () => setSignals(readExperienceSignals(signalRef.current.webgl));
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    window.addEventListener('resize', update);
    motion.addEventListener('change', update);
    return () => {
      window.removeEventListener('resize', update);
      motion.removeEventListener('change', update);
      if (sampleTimerRef.current !== null) window.clearTimeout(sampleTimerRef.current);
    };
  }, []);

  const simulationReady = useCallback(() => {
    rendererReadyRef.current = true;
    if (modeRef.current !== 'auto') return;
    samplesRef.current = [];
    sampleStartRef.current = performance.now();
    if (sampleTimerRef.current !== null) window.clearTimeout(sampleTimerRef.current);
    sampleTimerRef.current = window.setTimeout(() => {
      const startedAt = sampleStartRef.current;
      if (startedAt === null || modeRef.current !== 'auto') return;
      const measured = samplesRef.current.filter((sample) => sample.at - startedAt >= FPS_SAMPLE_WARMUP_MS);
      if (!measured.length) return;
      const average = measured.reduce((sum, sample) => sum + sample.fps, 0) / measured.length;
      const currentTier = tierRef.current;
      let nextTier: ExperienceTier | null = null;
      if (currentTier === 'extreme' && average < EXTREME_MIN_FPS && !downgradedStepsRef.current.has('extreme')) {
        nextTier = 'cinematic';
      } else if (currentTier === 'cinematic' && average < CINEMATIC_MIN_FPS && !downgradedStepsRef.current.has('cinematic')) {
        nextTier = 'minimal';
      }
      if (!nextTier) return;
      downgradedStepsRef.current.add(currentTier);
      setRuntimeCap(nextTier);
      setAdjustment(nextTier);
      restartSamplingRef.current();
    }, FPS_SAMPLE_DURATION_MS);
  }, []);

  useLayoutEffect(() => {
    restartSamplingRef.current = simulationReady;
  }, [simulationReady]);

  useEffect(() => {
    if (mode === 'auto' && rendererReadyRef.current) simulationReady();
  }, [mode, monitorRequest, simulationReady]);

  const reportFps = useCallback((fps: number) => {
    if (modeRef.current !== 'auto' || sampleStartRef.current === null) return;
    samplesRef.current.push({ at: performance.now(), fps });
  }, []);

  const value = useMemo<ExperienceContextValue>(() => ({
    mode, tier, profile: EXPERIENCE_PROFILES[tier], webglAvailable: signals.webgl,
    tierWasReducedAutomatically: mode === 'auto' && tier !== 'extreme',
    adjustment, setMode, simulationReady, reportFps,
  }), [mode, tier, signals.webgl, adjustment, setMode, simulationReady, reportFps]);

  return <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>;
}

