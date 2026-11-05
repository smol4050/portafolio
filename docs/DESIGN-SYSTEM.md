# Sistema de diseño

Este documento registra la base visual existente del portafolio y los tokens iniciales. Los valores de color, medidas y efectos proceden de CSS o estilos inline que ya estaban en uso; los tokens organizan esos valores sin definir una paleta visual nueva.

## Importación y reglas

- `src/styles/tokens.css` es la única hoja de tokens y se importa una vez desde `src/main.tsx`, antes de cargar `App.tsx` y sus hojas CSS.
- Los tokens nombran valores existentes. Al sustituir una declaración, el valor calculado debe seguir siendo el mismo.
- No introducir colores ni duraciones fuera de los tokens sin revisar primero el sistema.
- No fusionar valores próximos por apariencia. Las propuestas al final quedan pendientes de decisión.
- Los atributos de color actuales como `--card-accent-rgb` permanecen separados porque son canales RGB dinámicos por tarjeta.

## Color

| Token | Valor actual | Propósito |
|---|---|---|
| `--color-background` | `#09070e` | Fondo base de la página. |
| `--color-surface-1` / `--color-surface-2` | `#100b19` / `#151020` | Superficies base del tema y panel. |
| `--color-surface-3` / `--color-surface-4` / `--color-surface-5` | `#100719` / `#05030a` / `#0d0b14` | Fondo del hero, simulación y tarjetas. |
| `--color-surface-gradient-deep` / `--color-surface-gradient-card` / `--color-surface-gradient-mid` / `--color-surface-gradient-end` | `#260b37` / `#21152d` / `#1c0d2c` / `#100817` | Paradas de los gradientes de superficie existentes. |
| `--color-text-primary` / `--color-text-secondary` | `#f5f0ff` / `#a49aaf` | Texto principal y texto secundario del tema. |
| `--color-white-cold` / `--color-black` | `#fff` / `#000` | Blanco frío y negro ya usados en fondos, recortes y detalles. |
| `--color-violet-500`, `--color-violet-400`, `--color-violet-350`, `--color-violet-300`, `--color-violet-200` | `#a855f7`, `#c084fc`, `#a78bfa`, `#d7a8ff`, `#e9d5ff` | Violetas de interacción y superficies tipográficas. Los nombres identifican tonos existentes; no prometen una escala matemática. |
| `--color-violet-pale`, `--color-violet-soft`, `--color-violet-mid`, `--color-violet-muted`, `--color-violet-light`, `--color-violet-bright`, `--color-violet-gradient-pink` | `#f3e8ff`, `#ddd6fe`, `#bd73f4`, `#c68cff`, `#c58bff`, `#e4c4ff`, `#ef9bda` | Detalles, texto y paradas exactas de gradientes preexistentes. |
| `--color-blue-soft` | `#90a6ff` | Acento azul presente en tarjetas. |
| `--color-state-error` / `--color-state-success` / `--color-state-warning` | `#f17cbb` / `#80e1ca` / `#f4b778` | Colores existentes que cubren los acentos rosa, teal y cálido usados por tarjetas/estados. |
| `--color-border-soft` / `--color-border-violet` / `--color-border-violet-strong` | `rgba(235, 219, 255, .12)` / `rgba(168, 85, 247, .2)` / `rgba(168, 85, 247, .35)` | Líneas de separación y bordes de paneles. |
| `--color-grid-line` / `--color-grid-fine` / `--color-violet-grain` | `rgba(210, 152, 255, .16)` / `rgba(239, 219, 255, .065)` / `rgba(230, 199, 255, .022)` | Retículas y textura del fondo. |
| `--color-navigation-overlay`, `--color-navigation-edge`, `--color-panel-overlay`, `--color-overlay-*` | Opacidades oscuras ya presentes | Capas translúcidas de navegación, paneles y degradados. |
| `--color-white-muted`, `--color-white-dots`, `--color-white-border`, `--color-violet-*` de borde/brillo, `--color-slider-glow`, `--color-black-shadow` | Valores `rgba()` existentes | Opacidades específicas para detalles, brillos y controles. |

`#fff` y `#ffffff` representan el mismo blanco usado en el repositorio y ahora comparten `--color-white-cold`. Los gradientes mantienen sus paradas y opacidades originales.

## Tipografía

| Rol | Token | Familia y uso |
|---|---|---|
| Display | `--font-display` | Barlow Condensed, con las cargas existentes 500, 600, 700, 800 y 900; títulos y encabezados. |
| Cuerpo | `--font-body` | DM Sans, con 400, 500, 600 y 700; párrafos y controles. |
| Técnica | `--font-mono` | IBM Plex Mono con 400 y 500, fallback `monospace`. Se aplica a `.gargantua-slider-val`, a la etiqueta del hero y al HUD ORIGIN. |

Google Fonts se declara una sola vez en `tokens.css` con `display=swap`. No se añadieron paquetes npm. La escala de tamaño con sustituciones actuales incluye `--font-size-micro` (0.55rem), `--font-size-caption` (0.65rem), `--font-size-small` (0.72rem), `--font-size-reading` (0.85rem) y `--font-size-body` (1rem). Los pesos y métricas recurrentes se expresan como `--font-weight-*`, `--line-height-*` y `--tracking-*`.

## Espaciado, radios, elevación y capas

- `--space-2` a `--space-6` nombran los gaps repetidos de 8, 10, 12, 14 y 20 px.
- `--radius-circle`, `--radius-pill`, `--radius-small` y `--radius-card` conservan 50%, 9999 px, 2 px y 4 px.
- `--shadow-card-outline`, `--glow-card` y `--glow-card-soft` nombran efectos idénticos repetidos. `--z-behind`, `--z-background`, `--z-content`, `--z-overlay-content`, `--z-floating`, `--z-sticky`, `--z-fullscreen`, `--z-simulation-controls`, `--z-navigation` y `--z-modal` nombran los niveles de capa existentes.

## Movimiento

- Curvas genéricas: `--ease-in`, `--ease-out` y `--ease-inout`.
- Curvas específicas ya repetidas: `--ease-enter`, `--ease-implode` y `--ease-overload`.
- Duraciones base: `--duration-fast` (180 ms), `--duration-base` (200 ms), `--duration-moderate` (300 ms) y `--duration-slow` (600 ms).
- Con `prefers-reduced-motion: reduce`, esas duraciones pasan a `--duration-reduced` (0.01 ms), el valor mínimo que ya utiliza el sitio. Las reglas actuales que desactivan animaciones se conservan.
- La entrada general del hero usa `--duration-slow` (600 ms). ORIGIN escala revelado, escaneo, iris y acceso respecto a los 5000 ms de EXTREME o 3000 ms de CINEMATIC; la máscara del canvas usa `clip-path: circle()` para que el recorte pueda componerse como capa durante la apertura. Su contenido WebGL ya es una superficie GPU y el recorte evita recalcular el shader.
- La refracción ORIGIN usa los tokens de error rosa y azul existentes (`--color-state-error` y `--color-blue-soft`), con una convergencia de 600 ms (`--duration-slow`). No añade colores a la paleta.
- En viewports de hasta 1000 px, la gravedad tipográfica del apellido se atenúa y usa el blanco existente para que la identidad se mantenga legible delante del disco. En escritorio conserva la fuerza y el gradiente previos.

Otros tiempos existentes —por ejemplo 150, 160, 220, 250, 260, 450, 850, 900, 1000, 1100, 1200 ms y la animación de 32 s— no se han redondeado ni fusionado.

## Breakpoints

Las variables CSS no se pueden usar como valores de media queries. Valores actuales: `max-width: 680px` (móvil), `max-width: 1000px` y `min-width: 1001px` (cambio de composición), `max-width: 390px` (móvil estrecho) y `min-width: 1500px` (pantalla amplia). Se conservan en las reglas CSS y se documentan aquí y en el comentario de `tokens.css`.

## Inventario resumido y casi duplicados

La auditoría se realizó sobre CSS y valores de `style` inline en TSX. Frecuencias previas a la tokenización; se agrupan las declaraciones exactas, no se fusionan las casi iguales.

- Colores repetidos destacados: `#fff` (13), `#c084fc` (10), `#f3e8ff` (7), `#ffffff` (7), `#100719` (5), `#000` (4), `#05030a` (4), `#a78bfa` (4), `#a855f7` (4), `#ddd6fe` (3). `rgba(var(--card-accent-rgb), …)` se repite 29 veces.
- Tamaños repetidos: 0.65rem y 0.72rem (4 usos cada uno); 0.55rem, 0.7rem, 0.78rem, 0.83rem, 0.85rem, 0.56rem y 1rem (3 cada uno). Pesos 700 (16) y 600 (8).
- Gaps repetidos: 20px (5); 7, 10 y 12px (4 cada uno); 8 y 14px (3 cada uno); 0.35rem, 0.4rem, 9, 13, 15, 17, 25, 28 y 45px (2 cada uno). `padding-top: 88px` aparece 3 veces, `padding-top: 90px` 3 y `margin-top: 18px` 3.
- Radios: 50% (10), 0 (2), 0.75rem (2), 2px (2), 4px (2), 9999px (2); también hay valores únicos entre 0.5rem y 1.5rem.
- Efectos: los tres anillos de sombra de tarjeta se repetían 2 veces idénticos y ahora usan un token común; los brillos de tarjeta de 28px y 45px aparecen 2 veces cada uno. Sombras locales de panel, slider y CTA se mantienen separadas cuando difieren.
- Tiempos y curvas: `color 180ms ease` (4), `all 200ms ease` (3), y algunas transiciones/animaciones idénticas entre CSS de App y efectos. `cubic-bezier(0.16, 1, 0.3, 1)` aparece 5 veces y `cubic-bezier(0.7, 0, 0.84, 0)` 4.
- Capas: z-index 1 (9), 0 (5), -1/2/3 (4 cada uno), 10/100/9999 (3 cada uno).

Casi duplicados que permanecen para decidir en otra iteración:

| Grupo | Valores y frecuencia | Archivos representativos | Decisión pendiente |
|---|---|---|---|
| Violetas claros | `#c084fc` (10), `#c68cff` (2), `#c58bff` (2), `#c38aff` (1) | `src/styles/gargantua.css`, `src/App.css`, `src/simulation/SimulationControls.tsx` | Mantener como tonos y usos separados; escoger una escala solo con aprobación visual. |
| Violetas pálidos | `#e9d5ff` (4), `#e4c4ff` (2), `#d7a8ff` (2) | `src/styles/gargantua.css`, `src/App.css` | No armonizar hasta revisar contraste y gradientes. |
| Superficies oscuras | `#100719` (5), `#100817` (2), `#0d0b14` (2); además overlays `rgba(9,7,14,.88)` (3) y `rgba(10,5,16,.96)` (2) | `src/App.css`, `src/styles/effects.css`, `src/styles/gargantua.css` | Conservar cada valor, especialmente las alphas. |
| Microtipografía | `0.65rem` (4), `0.69rem` (3), `0.7rem` (3), `0.72rem` (4) | `src/App.css`, `src/styles/base.css`, `src/styles/black-hole.css`, `src/styles/gravity.css` | No normalizar mientras no exista una revisión tipográfica visual. |
| Espaciado compacto | `gap: 7px` (4), `8px` (3), `9px` (2), `10px` (4), `12px` (4), `13px` (2), `14px` (3) | `src/App.css`, `src/styles/black-hole.css`, `src/styles/gravity.css` | Diferencias de 1–2 px quedan expresamente sin fusionar. |
| Duraciones | 150/160/180/200/220/250/260 ms, con frecuencias de 1–4 | `src/App.css`, `src/styles/gargantua.css`, `src/styles/animations.css` | Los tokens base solo cubren valores exactos frecuentes; el resto permanece literal. |

