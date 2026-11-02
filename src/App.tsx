import { useCallback, useEffect, useRef, useState } from 'react';
import type { Locale } from './types/project';
import { copy } from './data/translations';

import BrandMark from './components/BrandMark';
import Hero from './sections/Hero';
import ProjectsSection from './sections/ProjectsSection';
import AboutSection from './sections/AboutSection';
import SkillsSection from './sections/SkillsSection';
import ApproachSection from './sections/ApproachSection';
import ContactSection from './sections/ContactSection';
import { FullscreenSimulation } from './simulation/SimulationLoader';
import type { AbsorbPhase } from './simulation/config';

import './styles/base.css';
import './styles/effects.css';
import './styles/animations.css';
import './styles/black-hole.css';
import './styles/gravity.css';
import './styles/gargantua.css';
import './App.css';

/* =========================================================
   LÍNEA DE TIEMPO DE LA ABSORCIÓN (ms desde el clic)
   Fase 1: 0     → 1000  Espiralización / espaguetización de la UI
   Fase 2: 1000  → 1300  Hiperaceleración de uniforms del shader
   Fase 3: 1300  → 1600  Implosión + destello + apertura limpia
   ========================================================= */
const T_SPIRAL_END = 1000;
const T_OVERLOAD_END = 1300;
const T_SWAP_SIM = 1480; // el destello ya cubre la pantalla
const T_END = 1600;          // el destello NO se disipa antes de este instante...
const T_READY_TIMEOUT = 2200; // ...ni después de esto, aunque el shader tarde en compilar

interface Point { x: number; y: number }

// Centro REAL del agujero negro en pantalla (centro del contenedor del canvas)
function getBlackHoleCenter(): Point {
  const el = document.querySelector<HTMLElement>('.hero-background-canvas');
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Vórtice gravitacional: cada elemento [data-absorb] describe una espiral
 * logarítmica hacia el centro exacto del agujero negro, con aceleración creciente,
 * espaguetización radial (estiramiento a lo largo del radio), desenfoque y
 * sobreexposición. Los elementos más cercanos son succionados antes.
 * Devuelve una función de cancelación.
 */
function runVortex(center: Point, duration: number): () => void {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-absorb]'));

  const items = nodes
    .map((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return null;
      const ex = r.left + r.width / 2;
      const ey = r.top + r.height / 2;
      const dx = ex - center.x;
      const dy = ey - center.y;
      el.style.transition = 'none';
      el.style.transformOrigin = '50% 50%';
      el.style.willChange = 'transform, filter, opacity';
      el.style.pointerEvents = 'none';
      return { el, ex, ey, r0: Math.hypot(dx, dy), a0: Math.atan2(dy, dx) };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const maxR = Math.max(1, ...items.map((i) => i.r0));
  const t0 = performance.now();
  let raf = 0;

  const frame = (now: number) => {
    const elapsed = now - t0;

    for (const it of items) {
      const nd = it.r0 / maxR;
      const delay = nd * 0.22 * duration; // lo cercano cae primero
      const p = clamp01((elapsed - delay) / (duration - delay));
      if (p <= 0) continue;

      const turns = 1.1 + (1 - nd) * 1.4;
      const radius = it.r0 * (1 - Math.pow(p, 2.2));
      const theta = it.a0 + turns * Math.PI * 2 * Math.pow(p, 1.7);

      const px = center.x + radius * Math.cos(theta);
      const py = center.y + radius * Math.sin(theta);
      const tx = px - it.ex;
      const ty = py - it.ey;

      const thetaDeg = (theta * 180) / Math.PI;
      const spin = ((theta - it.a0) * 180) / Math.PI * 0.35;

      const shrink = 1 - 0.97 * Math.pow(p, 2.6);
      const stretch = (1 + 4.5 * Math.pow(p, 1.4)) * shrink;      // a lo largo del radio
      const squash = (1 - 0.55 * Math.pow(p, 1.2)) * shrink;      // perpendicular
      const fade = p < 0.65 ? 1 : 1 - (p - 0.65) / 0.35;

      it.el.style.transform =
        `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) rotate(${spin.toFixed(2)}deg) ` +
        `rotate(${thetaDeg.toFixed(2)}deg) scale(${stretch.toFixed(4)}, ${squash.toFixed(4)}) rotate(${(-thetaDeg).toFixed(2)}deg)`;
      it.el.style.filter = `blur(${(Math.pow(p, 1.6) * 9).toFixed(1)}px) brightness(${(1 + p * 2.2).toFixed(2)})`;
      it.el.style.opacity = String(Math.max(0, fade));
    }

    if (elapsed < duration) raf = requestAnimationFrame(frame);
  };

  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

export default function App() {
  const [locale, setLocale] = useState<Locale>('es');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobileMenu, setIsMobileMenu] = useState(
    () => window.matchMedia('(max-width: 680px)').matches,
  );
  const menuToggleRef = useRef<HTMLButtonElement>(null);

  const [phase, setPhase] = useState<AbsorbPhase>('idle');
  const [showFlash, setShowFlash] = useState(false);
  const [simulationActive, setSimulationActive] = useState(false);

  const timersRef = useRef<number[]>([]);
  const stopVortexRef = useRef<(() => void) | null>(null);

  // El destello se mantiene hasta que (a) pasó el tiempo mínimo y (b) el simulador pintó
  // su primer frame. Así nunca se ve un fondo vacío mientras compila el shader.
  const sequenceActiveRef = useRef(false);
  const minTimeDoneRef = useRef(false);
  const simReadyRef = useRef(false);

  const t = copy[locale];
  const isAbsorbing = phase !== 'idle';

  useEffect(() => {
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.lang = locale;
    document.title = t.metaTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.metaDescription);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', t.metaTitle);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', t.metaDescription);
    document.querySelector('meta[property="og:locale"]')?.setAttribute('content', locale === 'es' ? 'es_CO' : 'en_US');
  }, [locale, t]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 680px)');
    const updateMobileMenu = (event: MediaQueryListEvent) => {
      setIsMobileMenu(event.matches);
      if (!event.matches) setMenuOpen(false);
    };
    mediaQuery.addEventListener('change', updateMobileMenu);
    return () => mediaQuery.removeEventListener('change', updateMobileMenu);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuToggleRef.current?.focus();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  const lockScroll = (lock: boolean) => {
    document.documentElement.style.overflow = lock ? 'hidden' : '';
  };

  const clearSequence = () => {
    sequenceActiveRef.current = false;
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    stopVortexRef.current?.();
    stopVortexRef.current = null;
  };

  const schedule = (ms: number, fn: () => void) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => {
    return () => {
      clearSequence();
      lockScroll(false);
    };
  }, []);

  const closeMenu = () => setMenuOpen(false);

  const finishSequence = () => {
    if (!sequenceActiveRef.current) return;
    if (!(minTimeDoneRef.current && simReadyRef.current)) return;
    sequenceActiveRef.current = false;
    setShowFlash(false);
    lockScroll(false);
  };

  const handleSimReady = useCallback(() => {
    simReadyRef.current = true;
    finishSequence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartAbsorption = () => {
    if (phase !== 'idle') return;
    closeMenu();

    // Fijar el hero en pantalla: las coordenadas del vórtice se miden una sola vez
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    lockScroll(true);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSimulationActive(true);
      lockScroll(false);
      return;
    }

    const center = getBlackHoleCenter();
    sequenceActiveRef.current = true;
    minTimeDoneRef.current = false;
    simReadyRef.current = false;

    // Fase 1 (0 – 1000 ms): espiralización de toda la UI hacia el centro exacto
    setPhase('spiral');
    stopVortexRef.current = runVortex(center, T_SPIRAL_END);

    // Fase 2 (1000 – 1300 ms): sobrecarga de radiación en el shader
    schedule(T_SPIRAL_END, () => setPhase('overload'));

    // Fase 3 (1300 – 1600 ms): implosión + destello estelar
    schedule(T_OVERLOAD_END, () => {
      setPhase('implode');
      setShowFlash(true);
    });

    // Con el destello cubriendo todo, se monta el entorno 3D a pantalla completa
    schedule(T_SWAP_SIM, () => setSimulationActive(true));

    // El destello se disipa cuando la simulación ya está lista (o por tiempo máximo)
    schedule(T_END, () => {
      minTimeDoneRef.current = true;
      finishSequence();
    });
    schedule(T_SWAP_SIM + T_READY_TIMEOUT, () => {
      minTimeDoneRef.current = true;
      simReadyRef.current = true;
      finishSequence();
    });
  };

  const handleExitSimulation = () => {
    clearSequence();
    setSimulationActive(false);
    setShowFlash(false);
    setPhase('idle');
    lockScroll(false);
  };

  return (
    <main className={`portfolio locale-${locale} theme-dark ${isAbsorbing ? 'is-absorbing' : ''}`}>
      <div className={`singularity-flash ${showFlash ? 'active' : ''}`} />

      {simulationActive ? (
        <FullscreenSimulation onClose={handleExitSimulation} onReady={handleSimReady} />
      ) : (
        <>
          <nav
            className={`navbar ${isAbsorbing ? 'is-absorbing-shell' : ''}`}
            aria-label={t.navMainLabel}
          >
            <a className="brand-lockup" href="#inicio" onClick={closeMenu} data-absorb>
              <BrandMark />
              <span className="brand-name">
                {t.brandName.slice(0, -4)}<span>{t.brandName.slice(-4)}</span>
              </span>
            </a>

            <button
              className="mobile-menu-toggle"
              ref={menuToggleRef}
              type="button"
              aria-label={menuOpen ? t.closeMenu : t.openMenu}
              aria-expanded={menuOpen}
              aria-controls="primary-navigation-links"
              onClick={() => setMenuOpen((open) => !open)}
              data-absorb
            >
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </button>

            <div
              id="primary-navigation-links"
              className={`nav-links ${menuOpen ? 'nav-links-open' : ''}`}
              inert={isMobileMenu && !menuOpen}
            >
              <a href="#sobre-mi" onClick={closeMenu} data-absorb>{t.navAbout}</a>
              <a href="#projects" onClick={closeMenu} data-absorb>{t.navProjects}</a>
              <a href="#skills" onClick={closeMenu} data-absorb>{t.navSkills}</a>
              <a href="#contact" onClick={closeMenu} data-absorb>{t.navContact}</a>
            </div>

            <div className="navbar-controls">
              <div className="language-toggle" role="group" aria-label={t.languageLabel} data-absorb>
                <button
                  type="button"
                  lang="es"
                  aria-label={t.spanishOption}
                  aria-pressed={locale === 'es'}
                  onClick={() => setLocale('es')}
                >
                  <span className={locale === 'es' ? 'language-active' : ''}>ES</span>
                </button>
                <span className="language-divider" aria-hidden="true">/</span>
                <button
                  type="button"
                  lang="en"
                  aria-label={t.englishOption}
                  aria-pressed={locale === 'en'}
                  onClick={() => setLocale('en')}
                >
                  <span className={locale === 'en' ? 'language-active' : ''}>EN</span>
                </button>
              </div>
            </div>
          </nav>

          <Hero
            t={t}
            phase={phase}
            onEnterSimulation={handleStartAbsorption}
          />

          <ProjectsSection locale={locale} t={t} />
          <AboutSection t={t} />
          <SkillsSection t={t} />
          <ApproachSection t={t} />
          <ContactSection t={t} />
        </>
      )}
    </main>
  );
}
