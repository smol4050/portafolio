import { lazy, Suspense } from 'react';
import type { AbsorbPhase } from './config';
import type { ExperienceProfile } from '../experience/profiles';

const GargantuaSimulation = lazy(() => import('../components/GargantuaSimulation'));

export function HeroSimulation({ phase, profile, onReady, onFps }: {
  phase: AbsorbPhase;
  profile: ExperienceProfile;
  onReady: () => void;
  onFps: (fps: number) => void;
}) {
  return (
    <Suspense fallback={<div aria-hidden="true" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />}>
      <GargantuaSimulation embedded absorbPhase={phase} profile={profile} onReady={onReady} onFps={onFps} />
    </Suspense>
  );
}

export function FullscreenSimulation({ onClose, onReady, profile, onFps }: {
  onClose: () => void;
  onReady: () => void;
  profile: ExperienceProfile;
  onFps: (fps: number) => void;
}) {
  return (
    <Suspense
      fallback={(
        <div className="gargantua-full-fullscreen" aria-hidden="true">
          <div className="gargantua-canvas-layer" />
        </div>
      )}
    >
      <GargantuaSimulation onClose={onClose} onReady={onReady} onFps={onFps} profile={profile} />
    </Suspense>
  );
}
