import { useContext } from 'react';
import { ExperienceContext } from './context';

export function useExperience() {
  const value = useContext(ExperienceContext);
  if (!value) throw new Error('useExperience debe usarse dentro de ExperienceProvider');
  return value;
}
