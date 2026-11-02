import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULTS, deriveGeometry, type AbsorbPhase, type CameraPresetKey, type QualityKey, type RenderParameters } from '../simulation/config';
import { QUALITY_ORDER } from '../simulation/config';
import SimulationControls from '../simulation/SimulationControls';
import { SpaceSoundSynth } from '../simulation/SpaceSoundSynth';
import { useGargantuaRenderer } from '../simulation/useGargantuaRenderer';
import type { ExperienceProfile } from '../experience/profiles';
export type { AbsorbPhase } from '../simulation/config';

interface GargantuaSimulationProps {
  embedded?: boolean;
  absorbPhase?: AbsorbPhase;
  onClose?: () => void;
  /** Se llama cuando ya se pintó el primer frame (shader compilado) */
  onReady?: () => void;
  onFps?: (fps: number) => void;
  profile: ExperienceProfile;
}

export default function GargantuaSimulation({ embedded = false, absorbPhase = 'idle', onClose, onReady, onFps, profile }: GargantuaSimulationProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<SpaceSoundSynth | null>(null);

  const [sim, setSim] = useState(DEFAULTS);
  const [qualityOverride, setQualityOverride] = useState<{ profileKey: string; value: QualityKey } | null>(null);
  const profileKey = `${profile.heroQuality}:${profile.fullscreenQuality}:${profile.heroMaxDpr}:${profile.fullscreenMaxDpr}`;
  const defaultQuality = embedded ? profile.heroQuality : profile.fullscreenQuality;
  const quality = qualityOverride?.profileKey === profileKey ? qualityOverride.value : defaultQuality;
  const [paused, setPaused] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [activePreset, setActivePreset] = useState<CameraPresetKey>('orbit');
  const [fps, setFps] = useState(60);
  const [contextAvailable, setContextAvailable] = useState(true);
  const volume = 0.35;

  const params = useMemo<RenderParameters>(() => ({ ...sim, quality, paused, activePreset, absorbPhase }), [sim, quality, paused, activePreset, absorbPhase]);
  const handleFps = useCallback((value: number) => { setFps(value); onFps?.(value); }, [onFps]);
  const { applyPreset: applyRendererPreset, capture } = useGargantuaRenderer({
    mountRef,
    embedded,
    params,
    profile,
    onReady,
    onFps: handleFps,
    onContextStatus: setContextAvailable
  });

  const handleQualityChange = useCallback((next: QualityKey) => {
    const ceilingIndex = QUALITY_ORDER.indexOf(profile.qualityCeiling);
    const nextIndex = QUALITY_ORDER.indexOf(next);
    setQualityOverride({ profileKey, value: QUALITY_ORDER[Math.min(ceilingIndex, nextIndex)] });
  }, [profile.qualityCeiling, profileKey]);

  const update = useCallback((key: keyof typeof DEFAULTS, value: number) => {
    setSim((current) => ({ ...current, [key]: value }));
  }, []);
  const applyPreset = useCallback((key: CameraPresetKey) => {
    setActivePreset(key);
    applyRendererPreset(key);
  }, [applyRendererPreset]);
  const resetAll = useCallback(() => {
    setSim(DEFAULTS);
    applyPreset('orbit');
  }, [applyPreset]);

  useEffect(() => {
    if (!embedded) synthRef.current = new SpaceSoundSynth();
    return () => synthRef.current?.dispose();
  }, [embedded]);

  useEffect(() => {
    synthRef.current?.setVolume(volume);
  }, [volume]);

  const handleAudioToggle = useCallback(() => {
    if (synthRef.current) setAudioPlaying(synthRef.current.toggle(volume));
  }, [volume]);

  const geo = useMemo(() => deriveGeometry(sim.mass, sim.spin), [sim.mass, sim.spin]);
  const timeDilation = useMemo(() => {
    const f = Math.sqrt(Math.max(0.001, 1 - geo.rs / geo.rIn));
    return (1 / f).toFixed(2);
  }, [geo]);

  if (embedded) {
    return (
      <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />
        {!contextAvailable && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--color-surface-3)' }} />}
      </div>
    );
  }

  return (
    <div className="gargantua-full-fullscreen">
      <div ref={mountRef} className="gargantua-canvas-layer" style={{ cursor: 'grab' }} />
      {!contextAvailable && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'var(--color-surface-4)' }} />}
      <SimulationControls
        sim={sim}
        quality={quality}
        qualityCeiling={profile.qualityCeiling}
        paused={paused}
        audioPlaying={audioPlaying}
        activePreset={activePreset}
        fps={fps}
        timeDilation={timeDilation}
        onClose={onClose}
        onPause={() => setPaused((current) => !current)}
        onAudioToggle={handleAudioToggle}
        onCapture={capture}
        onReset={resetAll}
        onUpdate={update}
        onQualityChange={handleQualityChange}
        onPresetChange={applyPreset}
      />
    </div>
  );
}
