export type AbsorbPhase = 'idle' | 'spiral' | 'overload' | 'implode';

export const PHASE_BOOST: Record<AbsorbPhase, number> = {
  idle: 0,
  spiral: 0.2,
  overload: 1.0,
  implode: 1.45
};

export const iscoInM = (a: number) => {
  const c = Math.cbrt;
  const z1 = 1 + c(1 - a * a) * (c(1 + a) + c(1 - a));
  const z2 = Math.sqrt(3 * a * a + z1 * z1);
  return 3 + z2 - Math.sqrt((3 - z1) * (3 + z1 + 2 * z2));
};

export const deriveGeometry = (mass: number, spin: number) => {
  const rs = 0.95 * mass;
  const rIn = Math.max(iscoInM(spin) * 0.5 * rs, 1.25 * rs);
  const rOut = 7.5 * rs;
  return { rs, rIn, rOut };
};

export const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export const QUALITY = {
  low: { scale: 0.5, steps: 120, maxPixels: 0.9e6, label: 'Baja' },
  medium: { scale: 0.7, steps: 170, maxPixels: 1.8e6, label: 'Media' },
  high: { scale: 0.85, steps: 230, maxPixels: 3.0e6, label: 'Alta' },
  ultra: { scale: 1.0, steps: 300, maxPixels: 4.8e6, label: 'Ultra' }
};

export type QualityKey = keyof typeof QUALITY;
export const QUALITY_ORDER: QualityKey[] = ['low', 'medium', 'high', 'ultra'];

export const DEFAULTS = {
  mass: 1.0, spin: 0.75, temperature: 7600, brightness: 1.1, spinSpeed: 1.0,
  lensing: 1.0, doppler: 0.8, thickness: 1.0, exposure: 1.0, bloom: 0.6
};

export type SimulationSettings = typeof DEFAULTS;

export const CAMERA_PRESETS = {
  orbit: { radius: 16.5, theta: Math.PI / 2, phi: 1.48, fov: 36 },
  front: { radius: 14, theta: Math.PI / 2, phi: 0.14, fov: 38 },
  edge: { radius: 15, theta: 0.0, phi: 1.5608, fov: 36 },
  miller: { radius: 8.5, theta: Math.PI / 3, phi: 1.5, fov: 62 }
};

export type CameraPresetKey = keyof typeof CAMERA_PRESETS;

export interface RenderParameters extends SimulationSettings {
  quality: QualityKey;
  paused: boolean;
  activePreset: CameraPresetKey;
  absorbPhase: AbsorbPhase;
}
