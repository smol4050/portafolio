import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CameraApi } from '../simulation/useGargantuaRenderer';
import type { ExperienceTier } from './profiles';
import { createOriginSequenceMachine, reduceOriginSequence, type OriginSequenceAction } from './originSequenceMachine';

export type OriginSequenceStatus = 'idle' | 'playing' | 'done' | 'skipped';

export const ORIGIN_EXTREME_DURATION_MS = 5000;
export const ORIGIN_CINEMATIC_DURATION_MS = 3000;
export const ORIGIN_CAMERA_EASE_DURATION_MS = 2400;
export const ORIGIN_READY_TIMEOUT_MS = 8000;
export const ORIGIN_STORAGE_KEY = 'portafolio:origin-shown';
export const ORIGIN_STAGE_START = 0;
export const ORIGIN_STAGE_DOLLY_END = 0.64;
export const ORIGIN_STAGE_COMPLETE = 1;
export const ORIGIN_STAGES = { start: ORIGIN_STAGE_START, dollyEnd: ORIGIN_STAGE_DOLLY_END, complete: ORIGIN_STAGE_COMPLETE } as const;

const FINAL_CAMERA_STATE = { radius: 16.5, theta: Math.PI / 2, phi: 1.48, fov: 36 } as const;

function readInitialStatus(tier: ExperienceTier, reducedMotion: boolean, webglAvailable: boolean): OriginSequenceStatus {
  let alreadyShown = false;
  try { alreadyShown = sessionStorage.getItem(ORIGIN_STORAGE_KEY) === '1'; } catch { /* persistence is optional */ }
  return tier === 'minimal' || reducedMotion || !webglAvailable || alreadyShown ? 'done' : 'playing';
}

export function useOriginSequence({ tier, reducedMotion, webglAvailable, cameraApi }: {
  tier: ExperienceTier;
  reducedMotion: boolean;
  webglAvailable: boolean;
  cameraApi: CameraApi | null;
}) {
  const [initialStatus] = useState(() => readInitialStatus(tier, reducedMotion, webglAvailable));
  const [machine, setMachine] = useState(() => createOriginSequenceMachine(initialStatus));
  const machineRef = useRef(machine);
  const cameraApiRef = useRef(cameraApi);
  const [duration] = useState(() => tier === 'cinematic' ? ORIGIN_CINEMATIC_DURATION_MS : ORIGIN_EXTREME_DURATION_MS);
  const sequenceStartedAt = useRef<number | null>(null);
  const didStartCamera = useRef(false);
  const onReadyPending = useRef(false);

  const send = useCallback((action: OriginSequenceAction) => {
    const previous = machineRef.current;
    const next = reduceOriginSequence(previous, action);
    if (next !== previous) {
      machineRef.current = next;
      setMachine(next);
    }
    return next;
  }, []);

  useLayoutEffect(() => { cameraApiRef.current = cameraApi; }, [cameraApi]);

  const applyFinalCamera = useCallback((api: CameraApi) => {
    api.setCameraState(FINAL_CAMERA_STATE);
    send({ type: 'FINAL_CAMERA_APPLIED' });
  }, [send]);

  const onSimulationReady = useCallback(() => {
    const api = cameraApiRef.current;
    const current = machineRef.current;
    if (current.status !== 'playing') {
      const next = send({ type: 'CAMERA_READY' });
      if (api) applyFinalCamera(api);
      else if (next.pendingCameraFinal) onReadyPending.current = true;
      return;
    }
    if (didStartCamera.current || current.cameraPhase !== 'waiting') return;
    if (!api) {
      onReadyPending.current = true;
      return;
    }

    onReadyPending.current = false;
    didStartCamera.current = true;
    send({ type: 'CAMERA_READY' });
    void api.animateCameraTo(FINAL_CAMERA_STATE, { duration: ORIGIN_CAMERA_EASE_DURATION_MS }).then((result) => {
      send({ type: result === 'cancelled' ? 'USER_CANCEL' : 'CAMERA_SETTLED' });
    }, () => { send({ type: 'USER_CANCEL' }); });
  }, [applyFinalCamera, send]);

  useEffect(() => {
    if (!cameraApi) return;
    const current = machineRef.current;
    if (current.pendingCameraFinal) {
      applyFinalCamera(cameraApi);
      onReadyPending.current = false;
    } else if (onReadyPending.current) {
      onSimulationReady();
    }
  }, [applyFinalCamera, cameraApi, onSimulationReady, machine.pendingCameraFinal]);

  const skip = useCallback(() => {
    if (machineRef.current.status !== 'playing') return;
    const next = send({ type: 'SKIP' });
    const api = cameraApiRef.current;
    if (api) applyFinalCamera(api);
    else if (!next.pendingCameraFinal) onReadyPending.current = true;
  }, [applyFinalCamera, send]);

  useEffect(() => {
    if (machine.status !== 'playing') return;
    const startedAt = sequenceStartedAt.current ?? performance.now();
    sequenceStartedAt.current = startedAt;
    try { sessionStorage.setItem(ORIGIN_STORAGE_KEY, '1'); } catch { /* persistence is optional */ }
    const elapsed = performance.now() - startedAt;
    // These are wall-clock minima. If the page is hidden, the renderer pauses its tween;
    // status remains playing until its promise settles after the render loop resumes.
    const minimumTimer = window.setTimeout(() => send({ type: 'MINIMUM_ELAPSED' }), Math.max(0, duration - elapsed));
    const readyTimer = window.setTimeout(() => {
      const next = send({ type: 'READY_TIMEOUT' });
      const api = cameraApiRef.current;
      if (next.pendingCameraFinal && api) applyFinalCamera(api);
    }, Math.max(0, ORIGIN_READY_TIMEOUT_MS - elapsed));
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') skip(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(minimumTimer);
      window.clearTimeout(readyTimer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [applyFinalCamera, duration, machine.status, send, skip]);

  useEffect(() => {
    if (machine.status !== 'playing' || (tier !== 'minimal' && !reducedMotion && webglAvailable)) return;
    const next = send({ type: 'TIER_MINIMAL' });
    const api = cameraApiRef.current;
    if (next.pendingCameraFinal && api) applyFinalCamera(api);
  }, [applyFinalCamera, machine.status, reducedMotion, send, tier, webglAvailable]);

  const getProgress = useCallback(() => {
    if (machineRef.current.status !== 'playing' || sequenceStartedAt.current === null) {
      return machineRef.current.status === 'idle' ? 0 : 1;
    }
    return Math.min(1, (performance.now() - sequenceStartedAt.current) / duration);
  }, [duration]);

  return { status: machine.status, pendingCameraFinal: machine.pendingCameraFinal, skip, duration, getProgress, stages: ORIGIN_STAGES, onSimulationReady };
}
