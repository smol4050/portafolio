# Portafolio

Portafolio bilingüe de Luis Stiven Méndez, desarrollado como aplicación de página única. Presenta proyectos, perfil, habilidades, contacto y una simulación 3D interactiva.

## Stack

- React 19 y TypeScript 6
- Vite 8
- Three.js
- CSS propio

## Comandos

```bash
npm run dev      # servidor de desarrollo
npm run build    # comprobación TypeScript y build de producción
npm run lint     # ESLint
npm run preview  # previsualizar el build local
```

## Estructura

```text
public/                 favicon, iconos e imágenes de proyectos
src/
  components/           componentes compartidos y simulación 3D
  data/                 contenido de proyectos y traducciones
  sections/             secciones de la página
  styles/               hojas CSS por base, efectos y simulación
  types/                tipos compartidos
  App.tsx               composición y estado de la aplicación
  main.tsx              punto de entrada React
```

## Estado

El sitio incluye contenido en español e inglés y una simulación 3D con Three.js. `npm run build` completa correctamente. `npm run lint` informa 12 errores en `Hero.tsx` y `GargantuaSimulation.tsx`.
