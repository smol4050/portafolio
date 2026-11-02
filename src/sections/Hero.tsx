import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { AbsorbPhase } from '../simulation/config';
import { HeroSimulation } from '../simulation/SimulationLoader';
import type { copy } from '../data/translations';

interface HeroProps {
  t: typeof copy['es'];
  phase?: AbsorbPhase;
  onEnterSimulation?: () => void;
}

// Radio aparente de la sombra (≈ 2.6 rs) respecto a la mitad del alto del canvas,
// con la cámara de órbita por defecto (radio 16.5, fov 36°).
const SHADOW_RADIUS_RATIO = 0.45;

// Escribe una custom property solo si cambió (evita recálculos de estilo inútiles)
const setVar = (el: HTMLElement, name: string, value: string) => {
  if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
};

export default function Hero({ t, phase = 'idle', onEnterSimulation }: HeroProps) {
  const heroRef = useRef<HTMLElement>(null);
  const bhRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const phaseRef = useRef<AbsorbPhase>(phase);
  const rafRef = useRef(0);

  useLayoutEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const gravityWord = t.heroNameLast.split('');
  const isAbsorbing = phase !== 'idle';

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
      className={`hero ${isAbsorbing ? 'is-collapsing' : ''}`}
      id="inicio"
    >
      {/* 1. Fondo atmosférico */}
      <div className="hero-backdrop" />

      {/* 2. Canvas WebGL 3D en segundo plano (su centro = centro del agujero negro) */}
      <div ref={bhRef} className={canvasClass}>
        {/* Embebido: cámara fija en órbita, sin zoom por rueda (no secuestra el scroll de la página) */}
        <HeroSimulation phase={phase} />
      </div>

      {/* 3. Superposiciones ópticas */}
      <div className="hero-horizon" style={{ pointerEvents: 'none' }} />
      <div className="hero-grid" style={{ pointerEvents: 'none' }} />
      <div className="hero-vignette" style={{ pointerEvents: 'none' }} />

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
        <div className="hero-intro" data-absorb>
          <span className="hero-indicator" />
          <span>{t.heroIntro}</span>
        </div>

        <h1 className="hero-title" ref={titleRef}>
          <span className="title-word" data-absorb>{t.heroNameFirst}</span>{' '}
          <span className="gravity-text">
            {gravityWord.map((char, index) => (
              <span key={index} className="gravity-char" data-absorb>
                {char}
              </span>
            ))}
          </span>
        </h1>

        <p className="hero-description" data-absorb>
          {t.heroVisualDescription}
        </p>

        <div className="hero-actions">
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
