import { useEffect, useState, type ElementType, type MouseEvent, type SyntheticEvent } from 'react';
import {
  Aperture, ArrowLeft, BookOpen, Camera, Compass, Download, Eye, Maximize2,
  Pause, Play, RotateCcw, Sliders, Sparkles, Volume2, VolumeX, X
} from 'lucide-react';
import { QUALITY, QUALITY_ORDER, type CameraPresetKey, type QualityKey, type SimulationSettings } from './config';

interface SimulationControlsProps {
  sim: SimulationSettings;
  quality: QualityKey;
  qualityCeiling: QualityKey;
  paused: boolean;
  audioPlaying: boolean;
  activePreset: CameraPresetKey;
  fps: number;
  timeDilation: string;
  onClose?: () => void;
  onPause: () => void;
  onAudioToggle: () => void;
  onCapture: () => void;
  onReset: () => void;
  onUpdate: (key: keyof SimulationSettings, value: number) => void;
  onQualityChange: (quality: QualityKey) => void;
  onPresetChange: (preset: CameraPresetKey) => void;
}

const stop = (event: SyntheticEvent) => event.stopPropagation();
const ISOLATE = {
  onPointerDown: stop, onPointerUp: stop, onPointerMove: stop, onPointerCancel: stop,
  onMouseDown: stop, onMouseUp: stop, onTouchStart: stop, onTouchEnd: stop,
  onWheel: stop, onDoubleClick: stop, onClick: stop
};
const isolate = (callback?: () => void) => ({
  ...ISOLATE,
  onClick: (event: MouseEvent) => { event.stopPropagation(); callback?.(); }
});

interface SliderProps {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (value: number) => void; format?: (value: number) => string;
}

function Slider({ label, value, min, max, step, onChange, format }: SliderProps) {
  return (
    <div className="gargantua-slider-item">
      <div className="gargantua-slider-header">
        <span>{label}</span>
        <span className="gargantua-slider-val">{format ? format(value) : value.toFixed(2) + 'x'}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(event) => { event.stopPropagation(); onChange(parseFloat(event.target.value)); }}
        className="gargantua-range-input"
        {...ISOLATE}
      />
    </div>
  );
}

export default function SimulationControls({
  sim, quality, qualityCeiling, paused, audioPlaying, activePreset, fps, timeDilation,
  onClose, onPause, onAudioToggle, onCapture, onReset, onUpdate, onQualityChange, onPresetChange
}: SimulationControlsProps) {
  const [activeTab, setActiveTab] = useState<'physics' | 'optics' | 'presets'>('physics');
  const [infoModalOpen, setInfoModalOpen] = useState(false);

  useEffect(() => {
    if (!infoModalOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setInfoModalOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [infoModalOpen]);

  const presetBtn = (key: CameraPresetKey, Icon: ElementType, title: string, subtitle: string) => (
    <button
      key={key}
      type="button"
      {...isolate(() => onPresetChange(key))}
      className={`gargantua-preset-card ${activePreset === key ? 'active' : ''}`}
    >
      <Icon style={{ width: '1rem', height: '1rem', color: 'var(--color-violet-400)' }} />
      <span style={{ fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: '0.65rem', color: 'var(--color-violet-350)' }}>{subtitle}</span>
    </button>
  );

  const tabBtn = (key: 'physics' | 'optics' | 'presets', Icon: ElementType, label: string) => (
    <button
      type="button"
      {...isolate(() => setActiveTab(key))}
      className={`gargantua-tab-btn ${activeTab === key ? 'active' : ''}`}
    >
      <Icon style={{ width: '0.85rem', height: '0.85rem' }} /> {label}
    </button>
  );

  const update = (key: keyof SimulationSettings) => (value: number) => onUpdate(key, value);

  return (
    <>
      <header className="gargantua-sim-header" {...ISOLATE}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {onClose && (
            <button type="button" {...isolate(onClose)} className="gargantua-sim-btn">
              <ArrowLeft style={{ width: '1rem', height: '1rem' }} />
              <span>Volver</span>
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles style={{ width: '1.25rem', height: '1.25rem', color: 'var(--color-violet-400)' }} />
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>SINGULARIDAD 3D</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button type="button" {...isolate(onPause)} className="gargantua-sim-btn" title={paused ? 'Reanudar' : 'Pausar'}>
            {paused ? <Play style={{ width: '1rem', height: '1rem' }} /> : <Pause style={{ width: '1rem', height: '1rem' }} />}
          </button>
          <button type="button" {...isolate(onCapture)} className="gargantua-sim-btn" title="Guardar Captura">
            <Download style={{ width: '1rem', height: '1rem' }} />
          </button>
          <button type="button" {...isolate(onAudioToggle)} className={`gargantua-sim-btn ${audioPlaying ? 'active' : ''}`}>
            {audioPlaying ? <Volume2 style={{ width: '1rem', height: '1rem' }} /> : <VolumeX style={{ width: '1rem', height: '1rem' }} />}
            <span>{audioPlaying ? 'Audio Activo' : 'Audio Drone'}</span>
          </button>
          <button type="button" {...isolate(() => setInfoModalOpen(true))} className="gargantua-sim-btn" title="Información">
            <BookOpen style={{ width: '1rem', height: '1rem' }} />
          </button>
        </div>
      </header>

      <div className="gargantua-sim-panel" {...ISOLATE}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem' }}>
          <div className="gargantua-tab-group">
            {tabBtn('physics', Sliders, 'Física')}
            {tabBtn('optics', Aperture, 'Óptica')}
            {tabBtn('presets', Camera, 'Cámara')}
          </div>
          <button type="button" {...isolate(onReset)} className="gargantua-sim-btn" title="Restablecer">
            <RotateCcw style={{ width: '0.85rem', height: '0.85rem' }} />
          </button>
        </div>

        {activeTab === 'physics' && (
          <div>
            <Slider label="Masa de la Singularidad (M0)" value={sim.mass} min={0.5} max={2.0} step={0.05} onChange={update('mass')} />
            <Slider label="Momento Angular a/M (ISCO)" value={sim.spin} min={0} max={0.99} step={0.01} onChange={update('spin')} format={(v) => v.toFixed(2)} />
            <Slider label="Temperatura Térmica" value={sim.temperature} min={3500} max={12000} step={100} onChange={update('temperature')} format={(v) => `${Math.round(v)} K`} />
            <Slider label="Brillo de Acreción" value={sim.brightness} min={0.2} max={3.0} step={0.1} onChange={update('brightness')} />
            <Slider label="Velocidad Rotación" value={sim.spinSpeed} min={0} max={2.5} step={0.1} onChange={update('spinSpeed')} />
            <Slider label="Grosor de Toroides" value={sim.thickness} min={0.4} max={2.5} step={0.05} onChange={update('thickness')} />
            <Slider label="Lente Gravitacional" value={sim.lensing} min={0.1} max={2.0} step={0.05} onChange={update('lensing')} />
            <Slider label="Corrimiento Doppler" value={sim.doppler} min={0} max={1.6} step={0.05} onChange={update('doppler')} />
          </div>
        )}

        {activeTab === 'optics' && (
          <div>
            <Slider label="Exposición Óptica" value={sim.exposure} min={0.3} max={2.5} step={0.05} onChange={update('exposure')} />
            <Slider label="Resplandor (Bloom)" value={sim.bloom} min={0} max={2.0} step={0.05} onChange={update('bloom')} />
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border-violet)' }}>
              <div style={{ fontSize: '0.75rem', marginBottom: '0.4rem', color: 'var(--color-violet-soft)' }}>Calidad de Renderizado ({fps} FPS)</div>
              <div className="gargantua-quality-grid">
                {Object.entries(QUALITY).filter(([key]) => QUALITY_ORDER.indexOf(key as QualityKey) <= QUALITY_ORDER.indexOf(qualityCeiling)).map(([key, q]) => (
                  <button
                    key={key}
                    type="button"
                    {...isolate(() => onQualityChange(key as QualityKey))}
                    className={`gargantua-quality-btn ${quality === key ? 'active' : ''}`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'presets' && (
          <div className="gargantua-presets-grid">
            {presetBtn('orbit', Compass, 'Órbita', 'Deriva Síncrona')}
            {presetBtn('front', Eye, 'Ecuatorial', 'Lente Gravitacional')}
            {presetBtn('edge', Maximize2, 'Horizontal', 'Perfil de Disco')}
            {presetBtn('miller', Eye, 'Proximidad', 'Baja Órbita')}
          </div>
        )}
      </div>

      {infoModalOpen && (
        <div
          className="gargantua-modal-overlay"
          {...ISOLATE}
          onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) setInfoModalOpen(false); }}
        >
          <div className="gargantua-modal-card" role="dialog" aria-modal="true">
            <button
              type="button"
              aria-label="Cerrar"
              {...isolate(() => setInfoModalOpen(false))}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--color-violet-400)', cursor: 'pointer' }}
            >
              <X style={{ width: '1.25rem', height: '1.25rem' }} />
            </button>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-violet-pale)' }}>Simulación por Ray-Tracing Relativista</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-violet-350)', marginBottom: '1.25rem' }}>Efectos ópticos integrados directamente en GPU WebGL</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.8rem', color: 'var(--color-violet-soft)' }}>
              <div style={{ padding: '0.85rem', background: 'var(--color-panel-overlay)', borderRadius: '0.75rem', border: '1px solid var(--color-border-violet)' }}>
                <strong style={{ color: 'var(--color-violet-400)' }}>Dilatación Temporal:</strong> En el límite interno, 1 hora de simulación equivale a <strong>{timeDilation} horas</strong> para un observador distante.
              </div>
              <div style={{ padding: '0.85rem', background: 'var(--color-panel-overlay)', borderRadius: '0.75rem', border: '1px solid var(--color-border-violet)' }}>
                <strong style={{ color: 'var(--color-violet-400)' }}>Efecto Beaming Doppler:</strong> La materia que se desplaza hacia el observador incrementa exponencialmente su brillo e intensidad por distorsión Doppler.
              </div>
              <div style={{ padding: '0.85rem', background: 'var(--color-panel-overlay)', borderRadius: '0.75rem', border: '1px solid var(--color-border-violet)' }}>
                <strong style={{ color: 'var(--color-violet-400)' }}>Anillo de Fotones:</strong> Los rayos que rozan la esfera de fotones (1.5 r<sub>s</sub>) orbitan el agujero negro antes de escapar y dibujan el borde luminoso de la sombra.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
