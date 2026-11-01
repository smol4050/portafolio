
import type { Locale, Project, ProjectDetails } from '../types/project'

export const projects: Project[] = [
  {
    number: '01',
    name: 'GameOn',
    category: {
      es: 'APLICACIÓN MÓVIL · DESARROLLO Y QA',
      en: 'MOBILE APP · DEVELOPMENT & QA',
    },
    description: {
      es: 'Aplicación móvil desarrollada con Flutter, con trabajo en funcionalidades y validación del comportamiento de la aplicación.',
      en: 'Mobile application developed with Flutter, including feature development and validation of application behavior.',
    },
    technologies: ['Flutter', 'QA manual'],
    status: 'TERMINADO',
    type: 'APP',
  },
  {
    number: '02',
    name: 'Deadlock',
    category: {
      es: 'VIDEOJUEGOS',
      en: 'VIDEO GAMES',
    },
    description: {
      es: 'Proyecto de videojuego terminado. Más detalles se añadirán cuando se documente su desarrollo.',
      en: 'Completed video game project. More details will be added as its development is documented.',
    },
    technologies: [],
    status: 'TERMINADO',
    type: 'GAME',
  },
  {
    number: '03',
    name: 'TopItOff',
    category: {
      es: 'VIDEOJUEGOS',
      en: 'VIDEO GAMES',
    },
    description: {
      es: 'Proyecto de videojuego terminado. Más detalles se añadirán cuando se documente su desarrollo.',
      en: 'Completed video game project. More details will be added as its development is documented.',
    },
    technologies: [],
    status: 'TERMINADO',
    type: 'GAME',
  },
  {
    number: '04',
    name: 'Zenflow',
    category: {
      es: 'PROYECTO WEB',
      en: 'WEB PROJECT',
    },
    description: {
      es: 'Proyecto web disponible para explorar.',
      en: 'Web project available to explore.',
    },
    technologies: [],
    status: 'TERMINADO',
    type: 'WEB',
    url: 'https://yy5jm8.csb.app',
  },
  {
    number: '05',
    name: 'Mateo 7:15',
    category: {
      es: 'GAME JAM · HORROR · SUPERVIVENCIA',
      en: 'GAME JAM · HORROR · SURVIVAL',
    },
    description: {
      es: 'Un lobo se esconde entre las ovejas. Observa sus comportamientos, cumple tus tareas y descubre en quién puedes confiar.',
      en: 'A wolf hides among the sheep. Observe their behavior, complete your tasks, and discover who you can trust.',
    },
    technologies: ['Unity', 'C#', 'Gameplay'],
    status: 'GAME JAM 2026',
    type: 'GAME',
    url: 'https://smol4050.itch.io/mateo-715',
  },
  {
    number: '06',
    name: 'Elevator',
    category: {
      es: 'GAME JAM · NARRATIVA · 3D',
      en: 'GAME JAM · NARRATIVE · 3D',
    },
    description: {
      es: 'Un viaje en ascensor se convierte en un recorrido impredecible por pisos extraños, situaciones surrealistas y encuentros inesperados.',
      en: 'An elevator ride becomes an unpredictable journey through strange floors, surreal situations, and unexpected encounters.',
    },
    technologies: ['Unity', 'C#', 'Gameplay'],
    status: 'GAME JAM 2026',
    type: 'GAME',
    url: 'https://camilius13.itch.io/elevator',
  },
  {
    number: '10',
    name: 'El Hueco',
    category: {
      es: 'VIDEOJUEGO · GAME JAM · AVENTURA 3D',
      en: 'VIDEO GAME · GAME JAM · 3D ADVENTURE',
    },
    description: {
      es: 'Un astronauta varado en un planeta misterioso debe reunir minipiezas para reconstruir su nave mientras los nativos del lugar intentan robarle los materiales.',
      en: 'Stranded on a mysterious planet, an astronaut must collect small parts to rebuild their ship while the locals try to steal the materials.',
    },
    // TODO: confirmar motor.
    technologies: ['Gameplay'],
    status: 'TERMINADO',
    type: 'GAME',
    url: 'https://juanca-art.itch.io/el-hueco',
  },
  {
    number: '07',
    name: 'Koi',
    category: {
      es: 'PRODUCTO DIGITAL · EXPERIENCIA PARA PAREJAS',
      en: 'DIGITAL PRODUCT · COUPLES EXPERIENCE',
    },
    description: {
      es: 'Una aplicación para parejas que transforma la conexión cotidiana en experiencias compartidas mediante herramientas digitales.',
      en: 'An app for couples that turns everyday connection into shared experiences through digital tools.',
    },
    technologies: ['Flutter', 'Firebase', 'UI/UX'],
    status: 'EN DESARROLLO',
    type: 'APP',
  },
  {
    number: '08',
    name: 'Coffee Clans',
    category: {
      es: 'VIDEOJUEGOS · DISEÑO INTERACTIVO',
      en: 'VIDEO GAMES · INTERACTIVE DESIGN',
    },
    description: {
      es: 'Videojuego en desarrollo. Próximamente se documentarán sus mecánicas y su dirección creativa.',
      en: 'Video game in development. Its mechanics and creative direction will be documented as the project evolves.',
    },
    technologies: [],
    status: 'EN DESARROLLO',
    type: 'GAME',
  },
  {
    number: '09',
    name: 'Embolatados',
    category: {
      es: 'VIDEOJUEGOS · DEV BLOG',
      en: 'VIDEO GAMES · DEV BLOG',
    },
    description: {
      es: 'Proyecto de videojuego en desarrollo, con un diario de desarrollo disponible en línea.',
      en: 'Video game in development, with an online development blog.',
    },
    technologies: [],
    status: 'EN DESARROLLO',
    type: 'GAME',
    url: 'https://juanca25-10.github.io/SitioWebVideojuegos_Embolatados_DevBlog/',
  },
  {
    number: '11',
    name: 'Carlos Duty',
    category: {
      es: 'VIDEOJUEGO · SHOOTER',
      en: 'VIDEO GAME · SHOOTER',
    },
    description: {
      es: 'Shooter multijugador con pantalla dividida, desarrollado en Unity.',
      en: 'A split-screen multiplayer shooter developed in Unity.',
    },
    technologies: ['Unity', 'C#'],
    status: 'EN DESARROLLO',
    type: 'GAME',
  },
]

export const projectDetails: Record<string, ProjectDetails> = {
  '01': {
    overview: {
      es: 'Aplicación móvil desarrollada con Flutter. Esta página se ampliará con las funcionalidades verificadas y el proceso real de desarrollo.',
      en: 'Mobile application developed with Flutter. This page will be expanded with verified features and the actual development process.',
    },
    role: {
      es: 'Desarrollo móvil y validación manual',
      en: 'Mobile development and manual validation',
    },
    highlights: {
      es: [
        'Desarrollo con Flutter',
        'Validación del comportamiento de la aplicación',
      ],
      en: [
        'Flutter development',
        'Application behavior validation',
      ],
    },
  },
  '02': {
    overview: {
      es: 'Videojuego terminado. Aquí documentaremos su concepto, mecánicas y proceso cuando completemos la información del proyecto.',
      en: 'Completed video game. Its concept, mechanics, and development process will be documented here once the project information is complete.',
    },
    role: {
      es: 'Por documentar',
      en: 'To be documented',
    },
    highlights: {
      es: [],
      en: [],
    },
  },
  '03': {
    overview: {
      es: 'Videojuego terminado. Aquí documentaremos su concepto, mecánicas y proceso cuando completemos la información del proyecto.',
      en: 'Completed video game. Its concept, mechanics, and development process will be documented here once the project information is complete.',
    },
    role: {
      es: 'Por documentar',
      en: 'To be documented',
    },
    highlights: {
      es: [],
      en: [],
    },
  },
  '04': {
    overview: {
      es: 'Proyecto web disponible en línea. Su ficha podrá incluir decisiones de diseño, implementación y capturas propias.',
      en: 'Web project available online. Its page may include design decisions, implementation details, and original screenshots.',
    },
    role: {
      es: 'Por documentar',
      en: 'To be documented',
    },
    highlights: {
      es: [],
      en: [],
    },
  },
  '05': {
    overview: {
      es: 'Un lobo se esconde entre las ovejas. Observa sus comportamientos, cumple tus tareas y descubre en quién puedes confiar.',
      en: 'A wolf hides among the sheep. Observe their behavior, complete your tasks, and discover who you can trust.',
    },
    role: {
      es: 'Proyecto de videojuego para Game Jam 2026',
      en: 'Video game project for Game Jam 2026',
    },
    highlights: {
      es: ['Unity', 'C#', 'Gameplay'],
      en: ['Unity', 'C#', 'Gameplay'],
    },
  },
  '06': {
    overview: {
      es: 'Un viaje en ascensor conduce a pisos extraños, situaciones surrealistas y encuentros inesperados.',
      en: 'An elevator ride leads to strange floors, surreal situations, and unexpected encounters.',
    },
    role: {
      es: 'Proyecto de videojuego para Game Jam 2026',
      en: 'Video game project for Game Jam 2026',
    },
    highlights: {
      es: ['Unity', 'C#', 'Gameplay'],
      en: ['Unity', 'C#', 'Gameplay'],
    },
  },
  '10': {
    overview: {
      es: 'Un astronauta varado en un planeta misterioso debe reunir minipiezas para reconstruir su nave mientras los nativos del lugar intentan robarle los materiales.',
      en: 'Stranded on a mysterious planet, an astronaut must collect small parts to rebuild their ship while the locals try to steal the materials.',
    },
    role: {
      es: 'Gameplay Programming & Logic en un equipo de cuatro personas. Equipo: Camilius13 (Gameplay Programming & Logic); Smol (Luis Stiven Méndez; Gameplay Programming & Logic); WaenVFX (3D Art, UI, Visual Effects & Post-Processing); Juanca Art (3D Art & Environment Design).',
      en: 'Gameplay Programming & Logic on a four-person team. Team: Camilius13 (Gameplay Programming & Logic); Smol (Luis Stiven Méndez; Gameplay Programming & Logic); WaenVFX (3D Art, UI, Visual Effects & Post-Processing); Juanca Art (3D Art & Environment Design).',
    },
    highlights: {
      es: [
        'Programación de movimiento, salto, interacción y lanzamiento de objetos, con un menú de recetas.',
        'El equipo creó la música y los efectos de sonido; algunos efectos se grabaron con sus propias voces.',
        'Hay una versión descargable para PC, recomendada por su rendimiento.',
      ],
      en: [
        'Movement, jumping, interaction, and object-throwing controls, along with a recipe menu.',
        'The team created the music and sound effects, including some effects recorded with their own voices.',
        'A downloadable PC version is available and recommended for performance.',
      ],
    },
  },
  '07': {
    overview: {
      es: 'Aplicación para parejas en desarrollo, enfocada en convertir la conexión cotidiana en experiencias compartidas mediante herramientas digitales.',
      en: 'App for couples in development, focused on turning everyday connection into shared experiences through digital tools.',
    },
    role: {
      es: 'Desarrollo de producto en curso',
      en: 'Product development in progress',
    },
    highlights: {
      es: ['Flutter', 'Firebase', 'UI/UX'],
      en: ['Flutter', 'Firebase', 'UI/UX'],
    },
  },
  '08': {
    overview: {
      es: 'Videojuego en desarrollo. Esta ficha será el espacio para explorar su concepto, identidad visual y evolución.',
      en: 'Video game in development. This page will explore its concept, visual identity, and evolution.',
    },
    role: {
      es: 'En desarrollo',
      en: 'In development',
    },
    highlights: {
      es: [],
      en: [],
    },
  },
  '09': {
    overview: {
      es: 'Proyecto de videojuego en desarrollo con un diario de desarrollo disponible en línea.',
      en: 'Video game in development with an online development blog.',
    },
    role: {
      es: 'Desarrollo de videojuego',
      en: 'Game development',
    },
    highlights: {
      es: [],
      en: [],
    },
  },
  '11': {
    overview: {
      es: 'Shooter multijugador con pantalla dividida, desarrollado en Unity.',
      en: 'A split-screen multiplayer shooter developed in Unity.',
    },
    role: {
      es: 'Desarrollo individual (en solitario). Aún no está disponible públicamente.',
      en: 'Individually developed (solo). Not yet publicly available.',
    },
    highlights: {
      es: [],
      en: [],
    },
  },
}

export function getProjectText(
  project: Project,
  locale: Locale,
) {
  return {
    category: project.category[locale],
    description: project.description[locale],
  }
}
