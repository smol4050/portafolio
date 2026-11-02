import { createContext } from 'react';
import type { EXPERIENCE_PROFILES } from './profiles';
import type { ExperienceMode, ExperienceTier } from './profiles';

export interface ExperienceContextValue {
  mode: ExperienceMode;
  tier: ExperienceTier;
  profile: typeof EXPERIENCE_PROFILES[ExperienceTier];
  webglAvailable: boolean;
  tierWasReducedAutomatically: boolean;
  adjustment: ExperienceTier | null;
  setMode: (mode: ExperienceMode) => void;
  simulationReady: () => void;
  reportFps: (fps: number) => void;
}

export const ExperienceContext = createContext<ExperienceContextValue | null>(null);
