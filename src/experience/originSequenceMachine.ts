import type { OriginSequenceStatus } from './useOriginSequence';

export type OriginCameraPhase = 'idle' | 'waiting' | 'running' | 'settled' | 'unavailable';

export interface OriginSequenceMachine {
  status: OriginSequenceStatus;
  minimumElapsed: boolean;
  cameraPhase: OriginCameraPhase;
  pendingCameraFinal: boolean;
}

export type OriginSequenceAction =
  | { type: 'MINIMUM_ELAPSED' }
  | { type: 'CAMERA_READY' }
  | { type: 'CAMERA_SETTLED' }
  | { type: 'READY_TIMEOUT' }
  | { type: 'USER_CANCEL' }
  | { type: 'SKIP' }
  | { type: 'TIER_MINIMAL' }
  | { type: 'FINAL_CAMERA_APPLIED' };

export function createOriginSequenceMachine(status: OriginSequenceStatus): OriginSequenceMachine {
  return {
    status,
    minimumElapsed: status !== 'playing',
    cameraPhase: status === 'playing' ? 'waiting' : 'idle',
    pendingCameraFinal: false,
  };
}

function finishIfReady(state: OriginSequenceMachine): OriginSequenceMachine {
  if (
    state.status === 'playing' &&
    state.minimumElapsed &&
    (state.cameraPhase === 'settled' || state.cameraPhase === 'unavailable')
  ) return { ...state, status: 'done' };
  return state;
}

/** Pure transition rules; timing and camera side effects stay in useOriginSequence. */
export function reduceOriginSequence(state: OriginSequenceMachine, action: OriginSequenceAction): OriginSequenceMachine {
  switch (action.type) {
    case 'MINIMUM_ELAPSED':
      return finishIfReady({ ...state, minimumElapsed: true });
    case 'CAMERA_READY':
      if (state.status === 'playing' && state.cameraPhase === 'waiting') {
        return { ...state, cameraPhase: 'running' };
      }
      if (state.status === 'skipped' || state.status === 'done') {
        return { ...state, pendingCameraFinal: true };
      }
      return state;
    case 'CAMERA_SETTLED':
      if (state.status !== 'playing' || state.cameraPhase !== 'running') return state;
      return finishIfReady({ ...state, cameraPhase: 'settled' });
    case 'READY_TIMEOUT':
      if (state.status !== 'playing' || state.cameraPhase !== 'waiting') return state;
      return finishIfReady({ ...state, cameraPhase: 'unavailable', pendingCameraFinal: true });
    case 'USER_CANCEL':
      if (state.status !== 'playing') return state;
      return finishIfReady({ ...state, cameraPhase: 'settled' });
    case 'SKIP':
      if (state.status !== 'playing') return state;
      return { ...state, status: 'skipped', cameraPhase: 'settled', pendingCameraFinal: true };
    case 'TIER_MINIMAL':
      if (state.status !== 'playing') return state;
      return { ...state, status: 'done', cameraPhase: 'settled', pendingCameraFinal: true };
    case 'FINAL_CAMERA_APPLIED':
      return state.pendingCameraFinal ? { ...state, pendingCameraFinal: false } : state;
  }
}
