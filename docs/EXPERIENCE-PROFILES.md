# Perfiles de experiencia

## Resolución automática

`resolveTier(signals)` es una función pura y no accede al DOM. En modo automático aplica la primera regla coincidente:

| Señal | Tier resultante |
|---|---|
| WebGL no está disponible | MINIMAL |
| `prefers-reduced-motion: reduce` | MINIMAL |
| viewport ≤ 680 px | CINEMATIC |
| `hardwareConcurrency` ≤ 4, cuando está disponible | CINEMATIC |
| `deviceMemory` ≤ 4 GB, cuando está disponible | CINEMATIC |
| DPR ≥ 2.5 | CINEMATIC |
| Resto de casos | EXTREME |

La detección de WebGL prueba un contexto pequeño y solicita su liberación; no monta la escena Three.js. `deviceMemory` y `hardwareConcurrency` son pistas opcionales. La preferencia del modo se almacena solo en el `localStorage` del navegador bajo `portafolio:experience`; se ignora cualquier valor no reconocido y se toleran fallos de lectura/escritura. No se usan cookies ni analítica.

## Parámetros por tier

Los pasos/escala/presupuesto provienen de `QUALITY` en `src/simulation/config.ts`. `maxPixels` en el hero se multiplica por 0.6. El tope DPR es específico para cada tamaño de escena.

| Tier | Hero | Pantalla completa | DPR máximo hero/full | Bloom | Auto-rotación |
|---|---|---|---|---|---|
| EXTREME | `medium`: scale 0.7, 170 pasos, 1.8 Mpx (1.08 Mpx efectivo en hero) | `high`: scale 0.85, 230 pasos, 3 Mpx | 1.5× / 2× | 1× (original) | Sí (original) |
| CINEMATIC | `low`: scale 0.5, 120 pasos, 0.9 Mpx (0.54 Mpx efectivo) | `medium`: scale 0.7, 170 pasos, 1.8 Mpx | 1× / 1.25× | 0.5× | No |
| MINIMAL | No monta simulación WebGL en hero | Al activar explícitamente, usa CINEMATIC | — / 1.25× | 0.5× | No |

EXTREME conserva la configuración previa: el hero arrancaba en `medium` y la escena completa en `high`, con DPR de 1.5× y 2×. CINEMATIC reduce resolución interna, DPR y pasos frente a esos valores; atenúa bloom y detiene la órbita decorativa sostenida. El shader y el audio no cambian. El selector de calidad de la escena completa respeta el techo del perfil.

La atenuación de bloom cambia su contribución visual, pero no evita sus ocho lecturas de textura: el shader actual calcula esas muestras siempre. Sin modificar el shader, el ahorro dominante viene de procesar menos píxeles y menos pasos de raymarching; por eso no se atribuye una reducción de cómputo al factor de bloom.

Los pasos efectivos del shader se escriben en `u_maxSteps`; el presupuesto por píxeles limita el render target. El renderer sigue siendo el mismo al cambiar perfil: actualiza DPR, render target, escala/pasos y bloom en caliente. No requiere recreación ni recursos adicionales. Al cerrar/desmontar la escena se conserva la liberación existente de render target, materiales, geometría y renderer.

### Adaptación por FPS

Solo en modo AUTO, tras el primer frame listo se observa un intervalo de 4 s y se descarta el primer segundo. Si el promedio restante cae por debajo de 40 FPS en EXTREME, se fija CINEMATIC; por debajo de 30 FPS en CINEMATIC, se fija MINIMAL. Se permiten como máximo una bajada por cada escalón durante la sesión; nunca se sube automáticamente. La reducción se anuncia con `role="status"` y permite seleccionar manualmente el tier recomendado.

El tier resuelto se refleja en `data-experience` sobre `<html>`. MINIMAL usa las duraciones reducidas ya existentes en los tokens para animaciones decorativas de interfaz. La preferencia del selector es funcional y se conserva solo en este navegador.
