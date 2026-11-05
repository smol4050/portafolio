import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { AbsorbPhase } from '../simulation/config';
import { HeroSimulation } from '../simulation/SimulationLoader';
import type { copy } from '../data/translations';
import type { ExperienceProfile } from '../experience/profiles';
import type { ExperienceTier } from '../experience/profiles';
import type { CameraApi } from '../simulation/useGargantuaRenderer';
import { useOriginSequence } from '../experience/useOriginSequence';

interface HeroProps {
  t: typeof copy['es'];
  phase?: AbsorbPhase;
  onEnterSimulation?: () => void;
  showSimulation: boolean;
  profile: ExperienceProfile;
  onSimulationReady: () => void;
  onFps: (fps: number) => void;
  tier: ExperienceTier;
  webglAvailable: boolean;
}

// Radio aparente de la sombra (≈ 2.6 rs) respecto a la mitad del alto del canvas,
// con la cámara de órbita por defecto (radio 16.5, fov 36°).
const SHADOW_RADIUS_RATIO = 0.45;
const ORIGIN_VISUAL_TIMING = {
  irisStage: 0.64,
  nameStart: 0.06,
  nameDuration: 0.13,
  nameStagger: 0.035,
  refractionDelay: 0.24,
  descriptionStart: 0.23,
  descriptionDuration: 0.25,
  descriptionStagger: 0.045,
  accessStart: 0.9,
  accessDuration: 0.07,
} as const;

// Escribe una custom property solo si cambió (evita recálculos de estilo inútiles)
const setVar = (el: HTMLElement, name: string, value: string) => {
  if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
};

export default function Hero({ t, phase = 'idle', onEnterSimulation, showSimulation, profile, onSimulationReady, onFps, tier, webglAvailable }: HeroProps) {
  const heroRef = useRef<HTMLElement>(null);
  const bhRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const phaseRef = useRef<AbsorbPhase>(phase);
  const rafRef = useRef(0);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const pointerDraggedRef = useRef(false);
  const [cameraApi, setCameraApi] = useState<CameraApi | null>(null);
  const [simulationReady, setSimulationReady] = useState(false);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sequence = useOriginSequence({ tier, reducedMotion: prefersReducedMotion, webglAvailable, cameraApi });
  const startCameraDolly = sequence.onSimulationReady;
  const handleReady = useCallback(() => {
    onSimulationReady();
    setSimulationReady(true);
    startCameraDolly();
  }, [onSimulationReady, startCameraDolly]);
  const handleBackgroundClick = (event: React.MouseEvent<HTMLElement>) => {
    if (pointerDraggedRef.current) {
      pointerDraggedRef.current = false;
      pointerStartRef.current = null;
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest('a, button, input, select, textarea, .experience-selector')) {
      pointerStartRef.current = null;
      return;
    }
    sequence.skip();
  };

  useLayoutEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const gravityWord = t.heroNameLast.split('');
  const isAbsorbing = phase !== 'idle';
  const isOriginPlaying = sequence.status === 'playing';
  const originStyle: CSSProperties = {
    '--origin-total-duration': `${sequence.duration}ms`,
    '--origin-iris-duration': `${sequence.duration * ORIGIN_VISUAL_TIMING.irisStage}ms`,
    '--origin-name-delay': `${sequence.duration * ORIGIN_VISUAL_TIMING.nameStart}ms`,
    '--origin-name-duration': `${sequence.duration * ORIGIN_VISUAL_TIMING.nameDuration}ms`,
    '--origin-name-stagger': `${sequence.duration * ORIGIN_VISUAL_TIMING.nameStagger}ms`,
    '--origin-refraction-delay': `${sequence.duration * ORIGIN_VISUAL_TIMING.refractionDelay}ms`,
    '--origin-description-delay': `${sequence.duration * ORIGIN_VISUAL_TIMING.descriptionStart}ms`,
    '--origin-description-duration': `${sequence.duration * ORIGIN_VISUAL_TIMING.descriptionDuration}ms`,
    '--origin-description-stagger': `${sequence.duration * ORIGIN_VISUAL_TIMING.descriptionStagger}ms`,
    '--origin-access-delay': `${sequence.duration * ORIGIN_VISUAL_TIMING.accessStart}ms`,
    '--origin-access-duration': `${sequence.duration * ORIGIN_VISUAL_TIMING.accessDuration}ms`,
  } as CSSProperties;

  useEffect(() => {
    const root = document.documentElement;
    if (!isOriginPlaying) return;
    root.dataset.originActive = tier;
    root.style.setProperty('--origin-access-delay', `${sequence.duration * ORIGIN_VISUAL_TIMING.accessStart}ms`);
    root.style.setProperty('--origin-access-duration', `${sequence.duration * ORIGIN_VISUAL_TIMING.accessDuration}ms`);
    root.style.setProperty('--origin-total-duration', `${sequence.duration}ms`);
    return () => {
      delete root.dataset.originActive;
      root.style.removeProperty('--origin-access-delay');
      root.style.removeProperty('--origin-access-duration');
      root.style.removeProperty('--origin-total-duration');
    };
  }, [isOriginPlaying, sequence.duration, tier]);

  const cameraDistanceRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!cameraApi || !cameraDistanceRef.current) return;
    const writeDistance = (radius: number) => {
      if (cameraDistanceRef.current) cameraDistanceRef.current.textContent = `R ${radius.toFixed(1)}`;
    };
    writeDistance(cameraApi.getCameraState().radius);
    if (sequence.status !== 'playing' && !sequence.pendingCameraFinal) return;
    return cameraApi.subscribeCameraDistance(writeDistance);
  }, [cameraApi, sequence.pendingCameraFinal, sequence.status]);

  /**
   * Gravedad dinámica por letra. SIN setState: escribe --pull / --dirx / --diry / --ang
   * directamente en el DOM. Mide la posición de layout (offset*) y no el rect
   * transformado, así la distorsión no realimenta la medición.
   */
  const updateGravity = useCallback(() => {
    const hero = heroRef.current;
    const bh = bhRef.current;
    const title = titleRef.current;
    if (!hero || !bh || !title) return;
    if (phaseRef.current !== 'idle') return; // congelado durante la absorción

    const heroRect = hero.getBoundingClientRect();
    const bhRect = bh.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    if (bhRect.width < 1 || bhRect.height < 1) return;

    const isMobile = window.innerWidth <= 1000;
    const bhX = bhRect.left + bhRect.width / 2;
    const bhY = bhRect.top + bhRect.height / 2;
    const horizonR = (bhRect.height / 2) * SHADOW_RADIUS_RATIO;

    const reach = Math.max(heroRect.width, heroRect.height) * (isMobile ? 0.55 : 0.85);
    const strength = isMobile ? 0.6 : 1;

    const chars = title.querySelectorAll<HTMLElement>('.gravity-char');
    for (let i = 0; i < chars.length; i++) {
      const el = chars[i];
      const cx = titleRect.left + el.offsetLeft + el.offsetWidth / 2;
      const cy = titleRect.top + el.offsetTop + el.offsetHeight / 2;

      const dx = bhX - cx;
      const dy = bhY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const surface = Math.max(0, dist - horizonR);

      const norm = Math.max(0, Math.min(1, 1 - surface / reach));
      const pull = Math.pow(norm, 2.2) * strength;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

      setVar(el, '--pull', pull.toFixed(4));
      setVar(el, '--dirx', (dx / dist).toFixed(4));
      setVar(el, '--diry', (dy / dist).toFixed(4));
      setVar(el, '--ang', `${angle.toFixed(2)}deg`);
    }
  }, []);

  // Coalesce cualquier ráfaga de eventos (resize, observers) en UN cálculo por frame
  const scheduleGravity = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      updateGravity();
    });
  }, [updateGravity]);

  useLayoutEffect(() => {
    updateGravity();

    // Solo se observan contenedores cuyo tamaño NO depende de las transformaciones
    // de las letras, por lo que no puede formarse un ciclo de medición.
    const ro = new ResizeObserver(scheduleGravity);
    if (heroRef.current) ro.observe(heroRef.current);
    if (bhRef.current) ro.observe(bhRef.current);

    window.addEventListener('resize', scheduleGravity);
    window.addEventListener('orientationchange', scheduleGravity);
    if (document.fonts?.ready) document.fonts.ready.then(scheduleGravity);

    // El contenido de entrada parte desplazado 28px: se recalcula al terminar
    const settle = window.setTimeout(scheduleGravity, 900);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', scheduleGravity);
      window.removeEventListener('orientationchange', scheduleGravity);
      window.clearTimeout(settle);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [updateGravity, scheduleGravity]);

  // Al volver a 'idle' tras una secuencia cancelada, se reajusta
  useEffect(() => {
    if (phase === 'idle') scheduleGravity();
  }, [phase, scheduleGravity]);

  const canvasClass = [
    'hero-background-canvas',
    phase === 'overload' || phase === 'implode' ? 'is-expanding' : '',
    phase === 'implode' ? 'is-imploding' : ''
  ].filter(Boolean).join(' ');

  return (
    <section
      ref={heroRef}
      className={`hero ${isAbsorbing ? 'is-collapsing' : ''} ${isOriginPlaying ? `origin-playing origin-${tier}` : ''} ${isOriginPlaying && simulationReady ? 'origin-canvas-ready' : ''}`}
      style={originStyle}
      id="inicio"
      onClick={handleBackgroundClick}
      onPointerDown={(event) => { pointerStartRef.current = { x: event.clientX, y: event.clientY }; pointerDraggedRef.current = false; }}
      onPointerMove={(event) => {
        const start = pointerStartRef.current;
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) pointerDraggedRef.current = true;
      }}
    >
      {/* 1. Fondo atmosférico */}
      <div className="hero-backdrop" />

      {/* 2. Canvas WebGL 3D en segundo plano (su centro = centro del agujero negro) */}
      <div ref={bhRef} className={canvasClass}>
        {/* Embebido: cámara fija en órbita, sin zoom por rueda (no secuestra el scroll de la página) */}
        {showSimulation && <HeroSimulation phase={phase} profile={profile} onReady={handleReady} onFps={onFps} onCameraApi={setCameraApi} introStart={sequence.status === 'playing'} />}
      </div>

      {sequence.status === 'playing' && <button className="origin-skip" type="button" onClick={sequence.skip}>{t.heroSkip}</button>}

      {/* 3. Superposiciones ópticas */}
      <div className="hero-horizon" style={{ pointerEvents: 'none' }} aria-hidden="true" />
      <div className="hero-grid" style={{ pointerEvents: 'none' }} aria-hidden="true" />
      {tier !== 'minimal' && <div className="hero-vignette" style={{ pointerEvents: 'none' }} aria-hidden="true" />}
      {tier !== 'minimal' && <div className="hero-origin-grain" aria-hidden="true" />}

      <div className="hero-origin-hud" aria-label={`${t.heroOrigin} ${t[`experienceTier_${tier}`]}`}>
        <span>00 / {t.heroOrigin}</span>
        <span>{t[`experienceTier_${tier}`]}</span>
        <span ref={cameraDistanceRef} className="hero-origin-distance" />
      </div>

      {/* UI Superior */}
      <div className="hero-topline" style={{ pointerEvents: 'none' }}>
        <span data-absorb>{t.heroLocation}</span>
        <span data-absorb>{t.heroDiscipline}</span>
      </div>

      {/* Contenido Principal */}
      <div
        className="hero-content"
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) scheduleGravity();
        }}
      >
        <div className="hero-intro origin-descriptor" data-absorb>
          <span className="hero-indicator" />
          <span>{t.heroIntro}</span>
        </div>

        <h1 className="hero-title" ref={titleRef}>
          <span className="hero-name-mask" data-absorb><span className="hero-name-line title-word">{t.heroNameFirst}</span></span>
          <span className="hero-name-mask" data-absorb><span className="hero-name-line gravity-text" aria-label={t.heroNameLast}>
            {gravityWord.map((char, index) => (
              <span key={`${char}-${index}`} className="gravity-char" aria-hidden="true">{char}</span>
            ))}
          </span></span>
        </h1>

        <p className="hero-description origin-descriptor" data-absorb>
          {t.heroVisualDescription}
        </p>

        <div className="hero-actions origin-access">
          <button
            type="button"
            className="button button-primary"
            onClick={(e) => {
              e.stopPropagation();
              if (!isAbsorbing) onEnterSimulation?.();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={isAbsorbing}
            data-absorb
          >
            <span>{t.heroSimulationCta}</span>
            <span>→</span>
          </button>

          <a href="#projects" className="button button-secondary" data-absorb>
            {t.heroProjectsCta}
          </a>
        </div>
      </div>

      {/* UI Inferior */}
      <div className="hero-bottomline">
        <a href="#projects" data-absorb>
          <span aria-hidden="true">↓</span> {t.heroScrollPrompt}
        </a>
        <span data-absorb>{t.heroSignature}</span>
      </div>

      <div className="hero-side-label" style={{ pointerEvents: 'none' }} data-absorb>
        {t.heroSideLabel}
      </div>
    </section>
  );
}
