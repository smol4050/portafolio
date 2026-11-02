import type { ExperienceTier } from './profiles';

export interface ExperienceSignals {
  webgl: boolean;
  reducedMotion: boolean;
  viewportWidth: number;
  devicePixelRatio: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
}

/**
 * Tabla de decisión, evaluada en este orden:
 * - WebGL ausente → minimal.
 * - movimiento reducido → minimal.
 * - viewport ≤ 680 px, ≤ 4 hilos o ≤ 4 GB (si están disponibles) → cinematic.
 * - en cualquier otro caso → extreme.
 * La función es pura: solo evalúa señales y nunca lee/escribe el DOM.
 */
export function resolveTier(signals: ExperienceSignals): ExperienceTier {
  if (!signals.webgl || signals.reducedMotion) return 'minimal';
  if (
    signals.viewportWidth <= 680 ||
    (signals.hardwareConcurrency !== undefined && signals.hardwareConcurrency <= 4) ||
    (signals.deviceMemory !== undefined && signals.deviceMemory <= 4) ||
    signals.devicePixelRatio >= 2.5
  ) return 'cinematic';
  return 'extreme';
}

export function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const extension = context?.getExtension('WEBGL_lose_context');
    extension?.loseContext();
    return Boolean(context);
  } catch {
    return false;
  }
}

export function readExperienceSignals(webgl = detectWebGL()): ExperienceSignals {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    webgl,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    viewportWidth: window.innerWidth,
    devicePixelRatio: window.devicePixelRatio || 1,
    hardwareConcurrency: nav.hardwareConcurrency || undefined,
    deviceMemory: nav.deviceMemory,
  };
}

