import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { copy } from '../data/translations';
import type { ExperienceMode, ExperienceTier } from './profiles';

interface Props {
  variant: 'desktop' | 'mobile';
  mode: ExperienceMode;
  tier: ExperienceTier;
  setMode: (mode: ExperienceMode) => void;
  labels: typeof copy['es'];
  automaticallyReduced: boolean;
}

const MODES: ExperienceMode[] = ['auto', 'extreme', 'cinematic', 'minimal'];

export default function ExperienceSelector({ variant, mode, tier, setMode, labels, automaticallyReduced }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    }
  };
  const label = (key: string) => labels[key as keyof typeof labels] as string;
  const currentMode = label(`experienceMode_${mode}`);
  const currentTier = label(`experienceTier_${tier}`);

  return (
    <div className={`experience-selector experience-selector-${variant}`} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        className="experience-selector-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {label('experienceLabel')} · {currentMode}{mode === 'auto' ? ` (${currentTier})` : ''}
        {automaticallyReduced && mode === 'auto' && <span className="experience-auto-mark" aria-hidden="true">↓</span>}
      </button>
      <div id={id} className="experience-selector-options" role="group" aria-label={label('experienceOptionsLabel')} hidden={!open}>
          {MODES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => { setMode(option); setOpen(false); buttonRef.current?.focus(); }}
            >
              <span className="experience-option-name">{label(`experienceMode_${option}`)}</span>
              <span className="experience-option-description">{label(`experienceDescription_${option}`)}</span>
            </button>
          ))}
      </div>
    </div>
  );
}
