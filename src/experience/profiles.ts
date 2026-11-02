import type { QualityKey } from '../simulation/config';

export type ExperienceMode = 'auto' | 'extreme' | 'cinematic' | 'minimal';
export type ExperienceTier = Exclude<ExperienceMode, 'auto'>;

export interface ExperienceProfile {
  heroQuality: QualityKey;
  fullscreenQuality: QualityKey;
  qualityCeiling: QualityKey;
  heroMaxDpr: number;
  fullscreenMaxDpr: number;
  bloomScale: number;
  autoRotate: boolean;
}

/** EXTREME replica el nivel y los DPR que utilizaba cada instancia antes de Iteración 08. */
export const EXPERIENCE_PROFILES: Record<ExperienceTier, ExperienceProfile> = {
  extreme: {
    heroQuality: 'medium', fullscreenQuality: 'high', qualityCeiling: 'ultra',
    heroMaxDpr: 1.5, fullscreenMaxDpr: 2,
    bloomScale: 1, autoRotate: true,
  },
  cinematic: {
    // Menos píxeles y 170 pasos como máximo; DPR moderado y bloom reducido.
    // La rotación automática se desactiva para ahorrar trabajo decorativo continuo.
    heroQuality: 'low', fullscreenQuality: 'medium', qualityCeiling: 'medium',
    heroMaxDpr: 1, fullscreenMaxDpr: 1.25,
    bloomScale: 0.5, autoRotate: false,
  },
  minimal: {
    // El hero no monta WebGL. La entrada explícita a pantalla completa usa CINEMATIC.
    heroQuality: 'low', fullscreenQuality: 'medium', qualityCeiling: 'medium',
    heroMaxDpr: 1, fullscreenMaxDpr: 1.25,
    bloomScale: 0.5, autoRotate: false,
  },
};

export const EXPERIENCE_STORAGE_KEY = 'portafolio:experience';
export const FPS_SAMPLE_DURATION_MS = 4000;
export const FPS_SAMPLE_WARMUP_MS = 1000;
export const EXTREME_MIN_FPS = 40;
export const CINEMATIC_MIN_FPS = 30;

export const isExperienceMode = (value: unknown): value is ExperienceMode =>
  value === 'auto' || value === 'extreme' || value === 'cinematic' || value === 'minimal';

