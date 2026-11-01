
export type Locale = 'es' | 'en'

export type Theme = 'dark' | 'light'

export type ProjectType = 'APP' | 'GAME' | 'WEB'

export type ProjectStatus =
  | 'TERMINADO'
  | 'GAME JAM 2026'
  | 'EN DESARROLLO'

export interface Project {
  number: string
  name: string
  category: Record<Locale, string>
  description: Record<Locale, string>
  technologies: string[]
  status: ProjectStatus
  type: ProjectType
  url?: string
}

export interface ProjectDetails {
  overview: Record<Locale, string>
  role: Record<Locale, string>
  highlights: Record<Locale, string[]>
}