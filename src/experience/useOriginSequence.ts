import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CameraApi } from '../simulation/useGargantuaRenderer';
import type { ExperienceTier } from './profiles';

export type OriginSequenceStatus = 'idle' | 'playing' | 'done' | 'skipped';

export const ORIGIN_EXTREME_DURATION_MS = 5000;
export const ORIGIN_CINEMATIC_DURATION_MS = 3000;
export const ORIGIN_CAMERA_EASE_DURATION_MS = 2400;
export const ORIGIN_STORAGE_KEY = 'portafolio:origin-shown';
export const ORIGIN_STAGE_START = 0;
export const ORIGIN_STAGE_DOLLY_END = 0.64;
export const ORIGIN_STAGE_COMPLETE = 1;
export const ORIGIN_STAGES = { start: ORIGIN_STAGE_START, dollyEnd: ORIGIN_STAGE_DOLLY_END, complete: ORIGIN_STAGE_COMPLETE } as const;
const ORIGIN_READY_TIMEOUT_MS = 5500;

export function useOriginSequence({ tier, reducedMotion, webglAvailable, cameraApi }: {
  tier: ExperienceTier;
  reducedMotion: boolean;
  webglAvailable: boolean;
  cameraApi: CameraApi | null;
}) {
  const [status, setStatus] = useState<OriginSequenceStatus>(() => {
    let alreadyShown = false;
    try { alreadyShown = sessionStorage.getItem(ORIGIN_STORAGE_KEY) === '1'; } catch { /* persistence is optional */ }
    return tier === 'minimal' || reducedMotion || !webglAvailable || alreadyShown ? 'done' : 'playing';
  });
  const statusRef = useRef(status);
  useLayoutEffect(() => { statusRef.current = status; }, [status]);
  const [duration] = useState(() => tier === 'cinematic' ? ORIGIN_CINEMATIC_DURATION_MS : ORIGIN_EXTREME_DURATION_MS);
  const didStartCamera = useRef(false);
  const sequenceStartedAt = useRef<number | null>(null);

  const skip = useCallback(() => {
    if (statusRef.current !== 'playing') return;
    cameraApi?.setCameraState({ radius: 16.5, theta: Math.PI / 2, phi: 1.48, fov: 36 });
    statusRef.current = 'skipped';
    setStatus('skipped');
  }, [cameraApi]);

  const onSimulationReady = useCallback(() => {
    if (statusRef.current !== 'playing' || didStartCamera.current || !cameraApi) return;
    didStartCamera.current = true;
    cameraApi.animateCameraTo({ radius: 16.5, theta: Math.PI / 2, phi: 1.48, fov: 36 }, { duration: ORIGIN_CAMERA_EASE_DURATION_MS });
  }, [cameraApi]);

  useEffect(() => {
    if (status === 'playing' && (tier === 'minimal' || reducedMotion || !webglAvailable)) {
      cameraApi?.setCameraState({ radius: 16.5, theta: Math.PI / 2, phi: 1.48, fov: 36 });
      const doneTask = window.setTimeout(() => {
        statusRef.current = 'done';
        setStatus('done');
      }, 0);
      return () => window.clearTimeout(doneTask);
    }
    if (status !== 'playing') return;
    if (sequenceStartedAt.current === null) sequenceStartedAt.current = performance.now();
    try { sessionStorage.setItem(ORIGIN_STORAGE_KEY, '1'); } catch { /* show the sequence without persisting */ }
    const elapsed = performance.now() - sequenceStartedAt.current;
    const doneTimer = window.setTimeout(() => {
      if (statusRef.current === 'playing') {
        statusRef.current = 'done';
        setStatus('done');
      }
    }, Math.max(0, duration - elapsed));
    const readyTimer = window.setTimeout(() => {
      if (!didStartCamera.current && statusRef.current === 'playing') {
        statusRef.current = 'done';
        setStatus('done');
      }
    }, ORIGIN_READY_TIMEOUT_MS);
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') skip(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(doneTimer);
      window.clearTimeout(readyTimer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [cameraApi, duration, reducedMotion, skip, status, tier, webglAvailable]);

  const getProgress = useCallback(() => {
    if (status !== 'playing' || sequenceStartedAt.current === null) return status === 'idle' ? 0 : 1;
    return Math.min(1, (performance.now() - sequenceStartedAt.current) / duration);
  }, [duration, status]);

  return { status, skip, duration, getProgress, stages: ORIGIN_STAGES, onSimulationReady };
}
