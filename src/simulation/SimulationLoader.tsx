import { lazy, Suspense } from 'react';
import type { AbsorbPhase } from './config';

const GargantuaSimulation = lazy(() => import('../components/GargantuaSimulation'));

export function HeroSimulation({ phase }: { phase: AbsorbPhase }) {
  return (
    <Suspense fallback={<div aria-hidden="true" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />}>
      <GargantuaSimulation embedded absorbPhase={phase} />
    </Suspense>
  );
}

export function FullscreenSimulation({ onClose, onReady }: { onClose: () => void; onReady: () => void }) {
  return (
    <Suspense
      fallback={(
        <div className="gargantua-full-fullscreen" aria-hidden="true">
          <div className="gargantua-canvas-layer" />
        </div>
      )}
    >
      <GargantuaSimulation onClose={onClose} onReady={onReady} />
    </Suspense>
  );
}
