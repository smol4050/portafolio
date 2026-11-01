import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Sliders, Camera, RotateCcw,
  Sparkles, Maximize2, Eye, BookOpen, X, Compass, Aperture,
  ArrowLeft, Download, Orbit, Globe
} from 'lucide-react';
import * as THREE from 'three';

/* =========================================================
   FASES DE LA SECUENCIA DE ABSORCIÓN
   idle     → reposo
   spiral   → Fase 1: la UI se espiraliza hacia el agujero negro
   overload → Fase 2: hiperaceleración de uniforms (sobrecarga)
   implode  → Fase 3: implosión + destello + apertura del sim
   ========================================================= */
export type AbsorbPhase = 'idle' | 'spiral' | 'overload' | 'implode';

const PHASE_BOOST: Record<AbsorbPhase, number> = {
  idle: 0,
  spiral: 0.2,
  overload: 1.0,
  implode: 1.45
};

const quadVS = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const rayFS = /* glsl */ `
  uniform vec2  u_resolution;
  uniform float u_time;
  uniform vec3  u_camPos;
  uniform vec3  u_camRight;
  uniform vec3  u_camUp;
  uniform vec3  u_camFwd;
  uniform float u_tanHalfFov;

  uniform float u_rs;
  uniform float u_rIn;
  uniform float u_rOut;
  uniform float u_spin;
  uniform float u_tempMax;
  uniform float u_brightness;
  uniform float u_spinSpeed;
  uniform float u_lensing;
  uniform float u_doppler;
  uniform float u_thickness;
  uniform float u_maxSteps;
  uniform float u_outScale;

  uniform float u_planetOn;
  uniform float u_planetDist;
  uniform float u_planetPhase;
  uniform float u_planetIncl;
  uniform float u_planetR;
  uniform float u_planetRot;

  varying vec2 vUv;

  const int MAX_STEPS = 300;

  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }

  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z);
  }

  /* FBM de 3 octavas: filamentos gaseosos con coste de compilación contenido */
  float fbm3(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * vnoise(p);
      p = p * 2.03 + vec3(17.1, 3.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  /* Paleta: violeta profundo → lila → magenta → núcleo blanco cálido */
  vec3 emitterColor(float T) {
    float t = clamp((T - 3000.0) / 9000.0, 0.0, 1.0);
    vec3 c0 = vec3(0.34, 0.05, 0.78);
    vec3 c1 = vec3(0.70, 0.26, 1.00);
    vec3 c2 = vec3(1.00, 0.42, 0.86);
    vec3 c3 = vec3(1.00, 0.93, 0.82);
    if (t < 0.30) return mix(c0, c1, smoothstep(0.0, 0.30, t));
    if (t < 0.62) return mix(c1, c2, smoothstep(0.30, 0.62, t));
    return mix(c2, c3, smoothstep(0.62, 1.0, t));
  }

  /* Perfil de temperatura tipo Novikov-Thorne */
  float tempProfile(float x) {
    float f = pow(x, -0.75) * pow(max(1.0 - inversesqrt(x), 0.0), 0.25);
    return f / 0.488;
  }

  /* Perfil de grosor volumétrico: el toroide se ensancha con el radio (flare) */
  float diskHeight(float rho) {
    return 0.05 * u_thickness * rho * pow(max(rho / u_rIn, 1.0), 0.3);
  }

  /* Turbulencia: rotación diferencial + espiral logarítmica + warp de dominio */
  float turb(float rho, float y, float H, float om, float phi0, float t) {
    float ph = phi0 + om * t;
    float sp = ph + 1.35 * log(max(rho, 0.05));
    vec3 q = vec3(rho * 3.0 + y / H * 0.4 - 0.035 * t, cos(sp) * 2.3, sin(sp) * 2.3);
    q += 0.45 * vec3(sin(q.y * 1.9 + t * 0.07), sin(q.z * 1.7 - t * 0.05), sin(q.x * 1.3 + 1.7));
    return fbm3(q);
  }

  vec3 starLayer(vec3 d, float scale, float dens) {
    vec3 p = d * scale;
    vec3 id = floor(p);
    vec3 f = fract(p) - 0.5;
    if (hash13(id) > dens) return vec3(0.0);
    vec3 off = (vec3(hash13(id + 3.1), hash13(id + 7.7), hash13(id + 13.9)) - 0.5) * 0.5;
    float dd = length(f - off);
    float rad = mix(0.09, 0.17, hash13(id + 19.3));
    float s = 1.0 - smoothstep(0.0, rad, dd);
    s *= s;
    float mag = mix(0.4, 4.0, pow(hash13(id + 23.1), 6.0));
    vec3 tint = mix(vec3(0.85, 0.65, 1.0), vec3(0.55, 0.78, 1.0), hash13(id + 31.7));
    return tint * s * mag * 0.8;
  }

  /* Planeta oceánico tipo Miller (acoplamiento de marea: siempre muestra la misma cara).
     Iluminado por la radiación térmica del disco: la luz llega desde el núcleo (-pc),
     con color según la temperatura local del disco, caída ~1/r y corrimiento al rojo. */
  vec3 shadePlanet(vec3 n, vec3 d, vec3 pc) {
    float dC = length(pc);
    vec3 L = -pc / dC;
    vec3 V = -d;

    float cr = cos(u_planetRot);
    float sr = sin(u_planetRot);
    vec3 nb = vec3(cr * n.x - sr * n.z, n.y, sr * n.x + cr * n.z);

    float h = fbm3(nb * 2.4 + vec3(4.0, 1.0, 7.0));
    float landM = smoothstep(0.55, 0.61, h);
    float shallow = smoothstep(0.30, 0.55, h);
    float swell = vnoise(nb * vec3(46.0, 18.0, 46.0) + vec3(0.0, 0.0, u_time * 0.35));

    vec3 ocean = mix(vec3(0.012, 0.075, 0.150), vec3(0.060, 0.300, 0.380), shallow) * (0.8 + 0.4 * swell);
    vec3 rock = mix(vec3(0.170, 0.145, 0.130), vec3(0.420, 0.360, 0.310), smoothstep(0.55, 0.9, h));
    vec3 albedo = mix(ocean, rock, landM);

    float x = max(dC / u_rIn, 1.001);
    vec3 lightCol = mix(emitterColor(u_tempMax * tempProfile(x)), vec3(1.0, 0.92, 0.88), 0.35);
    float gG = sqrt(max(1.0 - u_rs / dC, 0.02));
    float irr = u_brightness * 7.0 * pow(u_rs / dC, 1.4) * gG;

    // Terminador direccional (el disco es extenso: borde ligeramente suavizado)
    float ndl = dot(n, L);
    float diff = mix(max(ndl, 0.0), smoothstep(-0.10, 0.9, ndl), 0.5);
    // Relleno tenue del resto del disco sobre la cara nocturna
    float fill = 0.07 * (0.5 + 0.5 * (1.0 - n.y * n.y));

    vec3 H = normalize(L + V);
    float sp = pow(max(dot(n, H), 0.0), mix(180.0, 40.0, swell));
    float spec = sp * (1.0 - landM) * smoothstep(0.0, 0.25, ndl);
    float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);

    vec3 c = albedo * lightCol * irr * (diff + fill);
    c += lightCol * irr * spec * 1.6;
    c += lightCol * irr * fres * 0.55 * smoothstep(-0.25, 0.6, ndl);
    return c;
  }

  /* Geodésicas nulas de Schwarzschild + término gravitomagnético (spin) */
  vec3 accel(vec3 p, vec3 v) {
    float r2 = dot(p, p);
    float r = sqrt(r2);
    vec3 L = cross(p, v);
    float h2 = dot(L, L);
    vec3 a = -1.5 * u_lensing * u_rs * h2 / (r2 * r2 * r) * p;

    vec3 n = p / r;
    vec3 J = vec3(0.0, u_spin * u_rs * u_rs * 0.25, 0.0);
    vec3 B = -2.0 * (3.0 * dot(J, n) * n - J) / (r2 * r);
    a += cross(v, B);
    return a;
  }

  void main() {
    vec2 st = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
    vec3 v = normalize(u_camFwd + 2.0 * u_tanHalfFov * (st.x * u_camRight + st.y * u_camUp));
    vec3 v0 = v;
    vec3 p = u_camPos;

    float rs = u_rs;
    // Radio de escape reducido: los rayos que salen disparados no se trazan más allá
    float escapeR = max(10.0 * rs, 9.0);

    // col se acumula PREMULTIPLICADO (radiancia * transmitancia)
    vec3 col = vec3(0.0);
    float trans = 1.0;
    float minR = 1e9;
    vec3 minP = p;
    bool hitHorizon = false;

    // Planeta: el radio de test incluye medio píxel para antialiasing de la silueta
    // Órbita 3D circular inclinada (misma fórmula que planetPosition() en JS).
    // La fase se integra en JS (no u_time * velocidad) para que mover el slider no teletransporte el planeta.
    float sPh = sin(u_planetPhase);
    vec3 pc = vec3(u_planetDist * cos(u_planetPhase),
                   -u_planetDist * sPh * sin(u_planetIncl),
                   u_planetDist * sPh * cos(u_planetIncl));
    bool planetLive = u_planetOn > 0.5;
    bool planetDone = false;
    float pixW = 2.0 * u_tanHalfFov * length(pc - u_camPos) / u_resolution.y;
    float Rt = u_planetR + 0.5 * pixW;

    vec3 a = accel(p, v);
    float jitter = hash13(vec3(gl_FragCoord.xy, floor(u_time * 60.0)));

    for (int i = 0; i < MAX_STEPS; i++) {
      if (float(i) >= u_maxSteps) break;

      float r = length(p);
      if (r < minR) { minR = r; minP = p; }

      // El horizonte solo TERMINA el rayo: lo ya acumulado (disco frontal) se conserva
      if (r < rs) { hitHorizon = true; break; }
      if (r > escapeR && dot(p, v) > 0.0) { break; }

      // Paso mínimo de seguridad: nunca cero ni negativo cerca del horizonte
      float ds = max(0.008, clamp(0.12 * (r - 0.8 * rs), 0.012, 2.0));
      float rho = length(p.xz);
      float H = diskHeight(rho);
      bool radial = rho > u_rIn * 0.96 && rho < u_rOut;
      float ay = abs(p.y);
      float layer = 3.4 * H;

      if (radial) {
        if (ay > layer) ds = min(ds, max(0.55 * (ay - layer), 0.025));
        else            ds = min(ds, max(0.5 * H + 0.012, 0.02));
      }
      if (planetLive && !planetDone) {
        float dPl = length(p - pc) - Rt;
        ds = min(ds, max(0.4 * dPl, 0.01));
      }
      if (i == 0) ds *= 0.5 + 0.5 * jitter;
      ds = max(ds, 0.008);

      if (radial && ay < layer) {
        float x = rho / u_rIn;
        float sig = 0.5 * H;
        float sigW = 1.4 * H;
        // núcleo denso + halo gaseoso difuso
        float vert = exp(-0.5 * (ay * ay) / (sig * sig))
                   + 0.16 * exp(-0.5 * (ay * ay) / (sigW * sigW));
        float rad = pow(1.0 / x, 1.2)
                  * (1.0 + 1.4 * exp(-6.0 * (x - 1.0)))
                  * smoothstep(1.0, 1.12, x)
                  * (1.0 - smoothstep(0.6 * u_rOut, u_rOut, rho));
        float base = rad * vert;

        if (base > 0.008) {
          float Rm = rho / (0.5 * rs);
          float om = u_spinSpeed * 6.0 / (pow(Rm, 1.5) + u_spin);
          float phi0 = atan(p.z, p.x);
          float cyc = u_time / 18.0;
          // Crossfade de dos fases con UN solo punto de llamada a turb()
          // (evita inlinear el ruido dos veces dentro del bucle de 300 pasos)
          float n = 0.0;
          for (int j = 0; j < 2; j++) {
            float fj = fract(cyc + 0.5 * float(j));
            float wj = 1.0 - abs(2.0 * fj - 1.0);
            n += wj * turb(rho, p.y, H, om, phi0, fj * 18.0);
          }
          float tn = smoothstep(0.25, 0.75, n);
          float dens = base * (0.15 + 1.7 * tn);

          if (dens > 0.004) {
            vec3 vel = normalize(vec3(p.z, 0.0, -p.x));
            float beta = clamp(sqrt(0.5 * rs / rho) * (1.0 + 0.45 * rs / rho), 0.0, 0.93);
            float gam = inversesqrt(1.0 - beta * beta);
            float cosT = dot(vel, -v);
            float D = 1.0 / (gam * (1.0 - beta * cosT));
            float gGrav = sqrt(max(1.0 - rs / r, 0.02));
            float g = pow(D, u_doppler) * gGrav;
            float tObs = u_tempMax * tempProfile(x) * g;
            float inten = min(pow(tObs / 6000.0, 4.0), 60.0);

            vec3 emit = emitterColor(tObs) * inten * u_brightness * (0.55 + 0.9 * tn);
            float aStep = 1.0 - exp(-dens * 3.2 * ds);

            col += trans * aStep * emit;
            trans *= 1.0 - aStep;
            if (trans < 0.01) break;
          }
        }
      }

      vec3 pn = p + v * ds + 0.5 * a * ds * ds;

      // El rayo ya viene curvado por la geodésica: la luz del planeta sufre lente gravitacional
      if (planetLive && !planetDone) {
        vec3 seg = pn - p;
        float sl = length(seg);
        vec3 d = seg / max(sl, 1e-5);
        vec3 w = p - pc;
        float b = dot(w, d);
        float disc = b * b - (dot(w, w) - Rt * Rt);
        if (disc > 0.0) {
          float sq = sqrt(disc);
          float tHit = max(-b - sq, 0.0);
          if (tHit < sl && (-b + sq) > 0.0) {
            vec3 ph = p + d * tHit;
            float imp = sqrt(max(dot(w, w) - b * b, 0.0));
            float cov = clamp((Rt - imp) / max(pixW, 1e-4), 0.0, 1.0);
            vec3 pcol = shadePlanet(normalize(ph - pc), d, pc);
            col += trans * cov * pcol;
            trans *= 1.0 - cov;
            planetDone = true;
            if (trans < 0.02) { trans = 0.0; break; }
          }
        }
      }
      vec3 a2 = accel(pn, v + a * ds);
      v = normalize(v + 0.5 * (a + a2) * ds);
      p = pn;
      a = a2;
    }

    float alphaOut = 1.0;
    // Huella de píxel en minR (fuera de ramas divergentes): ancla el ancho del anillo
    float fwMin = clamp(fwidth(minR), 0.0, 0.5 * rs);

    if (hitHorizon) {
      // Sombra opaca: se conserva "col" (disco frontal que cruza por delante)
      alphaOut = 1.0;
    } else {
      vec3 stars = starLayer(v, 90.0, 0.18);

      // Anillo de fotones: rayos que rozan la esfera de fotones (r = 1.5 rs) y escapan
      float ringW = max(0.16 * rs, 1.15 * fwMin);
      float dR = max(minR - 1.5 * rs, 0.0) / ringW;
      float ring = exp(-dR * dR) + 0.12 * exp(-0.08 * dR * dR);
      vec3 velR = normalize(vec3(minP.z, 0.0, -minP.x) + vec3(1e-4, 0.0, 0.0));
      float beam = clamp(0.62 + 0.55 * dot(velR, -v0), 0.15, 1.4);
      vec3 ringCol = mix(vec3(1.0, 0.78, 0.96), vec3(1.0, 0.95, 0.86), clamp(beam - 0.6, 0.0, 1.0));
      vec3 ringEmit = ringCol * ring * beam * u_brightness * 3.2;

      vec3 extra = trans * (stars + ringEmit);
      col += extra;
      alphaOut = clamp(max(1.0 - trans, dot(extra, vec3(0.33))), 0.0, 1.0);
    }

    gl_FragColor = vec4(col * u_outScale, alphaOut);
  }
`;

const compositeFS = /* glsl */ `
  uniform sampler2D tScene;
  uniform float u_exposure;
  uniform float u_bloom;
  uniform float u_inScale;
  uniform vec2 u_res;
  varying vec2 vUv;

  vec3 aces(vec3 x) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    float aspect = u_res.x / u_res.y;

    // Aberración cromática desactivada: una sola muestra, imagen limpia y cinematográfica
    vec4 sc = texture2D(tScene, vUv);
    vec3 s = sc.rgb * u_inScale;   // premultiplicado, HDR
    float alpha = sc.a;

    vec3 mapped = vec3(0.0);
    if (alpha > 0.001) {
      mapped = aces((s / alpha) * u_exposure);
      mapped = pow(mapped, vec3(1.0 / 2.2));
    }

    // Bloom: resplandor incandescente alrededor del disco y el anillo
    vec3 glow = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float ang = float(i) * 0.785398;
      vec2 d = vec2(cos(ang), sin(ang));
      float rad = mix(0.012, 0.03, mod(float(i), 2.0));
      glow += texture2D(tScene, vUv + d * vec2(rad / aspect, rad)).rgb;
    }
    glow = glow / 8.0 * u_inScale;
    vec3 gm = pow(aces(glow * u_exposure * 1.2), vec3(1.0 / 2.2));
    float ga = clamp(dot(gm, vec3(0.333)) * u_bloom, 0.0, 1.0);

    vec3 rgb = mapped * alpha + gm * u_bloom * 0.55;
    // Dither triangular de ±1 LSB: elimina el banding en degradados del bloom
    float dn = hash12(gl_FragCoord.xy) + hash12(gl_FragCoord.xy + 17.0) - 1.0;
    rgb += dn / 255.0 * step(0.002, alpha + ga);
    float outA = clamp(max(alpha, ga), 0.0, 1.0);

    gl_FragColor = vec4(rgb, outA);
  }
`;

const iscoInM = (a: number) => {
  const c = Math.cbrt;
  const z1 = 1 + c(1 - a * a) * (c(1 + a) + c(1 - a));
  const z2 = Math.sqrt(3 * a * a + z1 * z1);
  return 3 + z2 - Math.sqrt((3 - z1) * (3 + z1 + 2 * z2));
};

const deriveGeometry = (mass: number, spin: number) => {
  const rs = 0.95 * mass;
  const rIn = Math.max(iscoInM(spin) * 0.5 * rs, 1.25 * rs);
  const rOut = 7.5 * rs;
  return { rs, rIn, rOut };
};

/* =========================================================
   PLANETA EN ÓRBITA — 'Aethelgard' (oceánico, estilo Miller)
   Órbita circular kepleriana con GM = rs/2 (c = 1), inclinada unos 10° respecto
   al disco (ajustable) para que se lea como un lazo 3D y no como un vaivén lateral. Co-rota con el disco
   (la fase decrece, igual que la velocidad del disco en el shader) y siempre se
   mantiene fuera de la ISCO (rIn).
   ========================================================= */
const PLANET_VISUAL_RATE = 3.2; // acelera la órbita para que sea apreciable (~20 s de periodo)

const planetRadius = (rs: number) => 0.3 * rs;
const orbitRadius = (distRs: number, g: { rs: number; rIn: number }) =>
  Math.max(distRs * g.rs, g.rIn * 1.12);
const orbitalOmega = (R: number, rs: number) => PLANET_VISUAL_RATE * Math.sqrt((0.5 * rs) / (R * R * R));
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

const planetPosition = (phase: number, R: number, incl: number, out: THREE.Vector3) => {
  const x = R * Math.cos(phase);
  const z0 = R * Math.sin(phase);
  return out.set(x, -z0 * Math.sin(incl), z0 * Math.cos(incl));
};

/* Aísla los eventos de la UI: un clic o arrastre sobre un control NUNCA llega al canvas */
const stop = (e: React.SyntheticEvent) => e.stopPropagation();
const ISOLATE = {
  onPointerDown: stop, onPointerUp: stop, onPointerMove: stop, onPointerCancel: stop,
  onMouseDown: stop, onMouseUp: stop, onTouchStart: stop, onTouchEnd: stop,
  onWheel: stop, onDoubleClick: stop, onClick: stop
};
const isolate = (fn?: () => void) => ({
  ...ISOLATE,
  onClick: (e: React.MouseEvent) => { e.stopPropagation(); fn?.(); }
});

/* scale: fracción de la resolución física (CSS px × dpr) · maxPixels: tope de píxeles del
   render-target (protege la GPU en pantallas retina / 4K). */
const QUALITY = {
  low: { scale: 0.5, steps: 120, maxPixels: 0.9e6, label: 'Baja' },
  medium: { scale: 0.7, steps: 170, maxPixels: 1.8e6, label: 'Media' },
  high: { scale: 0.85, steps: 230, maxPixels: 3.0e6, label: 'Alta' },
  ultra: { scale: 1.0, steps: 300, maxPixels: 4.8e6, label: 'Ultra' }
};

type QualityKey = keyof typeof QUALITY;
const QUALITY_ORDER: QualityKey[] = ['low', 'medium', 'high', 'ultra'];

const DEFAULTS = {
  mass: 1.0, spin: 0.75, temperature: 7600, brightness: 1.1, spinSpeed: 1.0,
  lensing: 1.0, doppler: 0.8, thickness: 1.0, exposure: 1.0, bloom: 0.6,
  planetSpeed: 1.0, planetDist: 3.6, planetIncl: 0.5
};

const CAMERA_PRESETS = {
  orbit: { radius: 16.5, theta: Math.PI / 2, phi: 1.48, fov: 36 },
  front: { radius: 14, theta: Math.PI / 2, phi: 0.14, fov: 38 },
  edge: { radius: 15, theta: 0.0, phi: 1.5608, fov: 36 },
  miller: { radius: 8.5, theta: Math.PI / 3, phi: 1.5, fov: 62 },
  // Seguimiento del planeta: la cámara persigue su órbita (theta/radius se recalculan por frame)
  planet: { radius: 6.8, theta: 0, phi: 1.36, fov: 48 }
};

class SpaceSoundSynth {
  ctx: AudioContext | null = null;
  isPlaying = false;
  volume = 0.35;
  master: GainNode | null = null;
  droneFilter: BiquadFilterNode | null = null;
  osc1: OscillatorNode | null = null;
  osc2: OscillatorNode | null = null;

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(this.ctx.destination);
    this.droneFilter = this.ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 160;
    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = 'sine';
    this.osc1.frequency.value = 38;
    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = 'triangle';
    this.osc2.frequency.value = 57;
    this.osc1.connect(this.droneFilter);
    this.osc2.connect(this.droneFilter);
    this.droneFilter.connect(this.master);
    this.osc1.start();
    this.osc2.start();
  }

  toggle(volume = 0.35) {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    this.volume = volume;
    if (this.ctx && this.master) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      if (this.isPlaying) {
        this.master.gain.setTargetAtTime(0.0001, now, 0.2);
        this.isPlaying = false;
      } else {
        this.master.gain.setTargetAtTime(volume, now, 0.5);
        this.isPlaying = true;
      }
    }
    return this.isPlaying;
  }

  setVolume(vol: number) {
    this.volume = vol;
    if (this.master && this.isPlaying && this.ctx) {
      this.master.gain.setTargetAtTime(Math.max(0.0001, vol), this.ctx.currentTime, 0.08);
    }
  }

  dispose() {
    if (this.ctx) this.ctx.close();
    this.ctx = null;
  }
}

interface SliderProps {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string;
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
        onChange={(e) => { e.stopPropagation(); onChange(parseFloat(e.target.value)); }}
        className="gargantua-range-input"
        {...ISOLATE}
      />
    </div>
  );
}

interface GargantuaSimulationProps {
  embedded?: boolean;
  absorbPhase?: AbsorbPhase;
  onClose?: () => void;
  /** Se llama cuando ya se pintó el primer frame (shader compilado) */
  onReady?: () => void;
}

export default function GargantuaSimulation({ embedded = false, absorbPhase = 'idle', onClose, onReady }: GargantuaSimulationProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<SpaceSoundSynth | null>(null);

  const [sim, setSim] = useState(DEFAULTS);
  const [quality, setQuality] = useState<QualityKey>(embedded ? 'medium' : 'high');
  const [paused, setPaused] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [volume] = useState(0.35);
  const [activeTab, setActiveTab] = useState<'physics' | 'optics' | 'presets'>('physics');
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<keyof typeof CAMERA_PRESETS>('orbit');
  const [fps, setFps] = useState(60);
  const [planetOn, setPlanetOn] = useState(true);

  const isVisibleRef = useRef(true);

  const upd = useCallback((key: keyof typeof DEFAULTS) => (val: number) => setSim((s) => ({ ...s, [key]: val })), []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paramsRef = useRef<Record<string, any>>({});
  paramsRef.current = { ...sim, quality, paused, activePreset, absorbPhase, planetOn };
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const followOffRef = useRef({ theta: 0.8, phi: 1.36, zoom: 1 });
  const camTargetRef = useRef({ ...CAMERA_PRESETS.orbit });
  const camCurRef = useRef({ ...CAMERA_PRESETS.orbit });
  const interactRef = useRef({ dragging: false, last: 0 });
  const shotRef = useRef(false);

  const applyPreset = useCallback((key: keyof typeof CAMERA_PRESETS) => {
    setActivePreset(key);
    const goal = { ...CAMERA_PRESETS[key] };
    // Camino angular más corto: evita giros de varias vueltas al cambiar de preset
    goal.theta = camCurRef.current.theta + wrapPi(goal.theta - camCurRef.current.theta);
    camTargetRef.current = goal;
    followOffRef.current = { theta: 0.8, phi: 1.36, zoom: 1 };
    if (key === 'planet') setPlanetOn(true);
    interactRef.current.last = performance.now();
  }, []);

  useEffect(() => {
    if (!embedded) synthRef.current = new SpaceSoundSynth();
    return () => synthRef.current?.dispose();
  }, [embedded]);

  useEffect(() => {
    synthRef.current?.setVolume(volume);
  }, [volume]);

  const handleAudioToggle = () => {
    if (synthRef.current) setAudioPlaying(synthRef.current.toggle(volume));
  };

  // Visibilidad por ref: no recrea el renderer al entrar/salir del viewport
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      isVisibleRef.current = entry.isIntersecting;
    }, { threshold: 0.05 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance'
      });
    } catch (err) { return; }

    // Hasta 2.0x en pantalla completa (1.5x en el hero) para bordes hipernítidos
    const dpr = Math.min(window.devicePixelRatio || 1, embedded ? 1.5 : 2.0);
    renderer.setPixelRatio(dpr);
    renderer.setSize(container.clientWidth || 300, container.clientHeight || 300);
    renderer.setClearColor(0x000000, 0);

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    // En el hero se permite el scroll vertical táctil; en pantalla completa el canvas captura todo
    canvas.style.touchAction = embedded ? 'pan-y' : 'none';
    container.appendChild(canvas);

    const postScene = new THREE.Scene();
    const postCam = new THREE.Camera();
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    // Sin blending: escribimos (radiancia premultiplicada HDR, alfa) tal cual
    const rayMat = new THREE.ShaderMaterial({
      vertexShader: quadVS,
      fragmentShader: rayFS,
      depthTest: false,
      depthWrite: false,
      transparent: false,
      blending: THREE.NoBlending,
      uniforms: {
        u_resolution: { value: new THREE.Vector2(1, 1) },
        u_time: { value: 0 },
        u_camPos: { value: new THREE.Vector3() },
        u_camRight: { value: new THREE.Vector3() },
        u_camUp: { value: new THREE.Vector3() },
        u_camFwd: { value: new THREE.Vector3() },
        u_tanHalfFov: { value: Math.tan((36 * Math.PI) / 360) },
        u_rs: { value: 0.95 },
        u_rIn: { value: 1.6 },
        u_rOut: { value: 7.1 },
        u_spin: { value: 0.75 },
        u_tempMax: { value: DEFAULTS.temperature },
        u_brightness: { value: DEFAULTS.brightness },
        u_spinSpeed: { value: 1 },
        u_lensing: { value: 1 },
        u_doppler: { value: DEFAULTS.doppler },
        u_thickness: { value: 1 },
        u_maxSteps: { value: QUALITY[quality].steps },
        u_outScale: { value: 1 },
        u_planetOn: { value: 1 },
        u_planetDist: { value: 3.4 },
        u_planetPhase: { value: 0 },
        u_planetIncl: { value: 0.5 },
        u_planetR: { value: 0.285 },
        u_planetRot: { value: 0 }
      }
    });

    const compMat = new THREE.ShaderMaterial({
      vertexShader: quadVS,
      fragmentShader: compositeFS,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      premultipliedAlpha: true,
      blending: THREE.NormalBlending,
      uniforms: {
        tScene: { value: null },
        u_exposure: { value: DEFAULTS.exposure },
        u_bloom: { value: DEFAULTS.bloom },
        u_inScale: { value: 1 },
        u_res: { value: new THREE.Vector2(1, 1) }
      }
    });

    const quad = new THREE.Mesh(quadGeo, rayMat);
    postScene.add(quad);

    const pass = (mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
      quad.material = mat;
      renderer.setRenderTarget(target);
      renderer.render(postScene, postCam);
    };

    // Resolución del render-target = tamaño físico (CSS × dpr) × escala de calidad,
    // limitada por un presupuesto de píxeles. perfScale es el último recurso anti-cuelgue.
    let currentQuality: QualityKey = quality;
    let perfScale = 1;
    let perfDirty = false;
    const computeRT = () => {
      const cw = container.clientWidth || 300;
      const ch = container.clientHeight || 300;
      const q = QUALITY[currentQuality];
      const budget = q.maxPixels * (embedded ? 0.6 : 1);
      const sc = Math.min(q.scale * dpr * perfScale, Math.sqrt(budget / (cw * ch)));
      return { cw, ch, w: Math.max(1, Math.floor(cw * sc)), h: Math.max(1, Math.floor(ch * sc)) };
    };
    let { w, h } = computeRT();

    // Estado de seguridad del ciclo de vida
    let disposed = false;
    let failed = false;
    let lastDowngrade = 0;

    // Si el shader no compila, se detiene el bucle en vez de dejar la GPU colgada
    renderer.debug.onShaderError = () => { failed = true; };

    // HDR solo si el cliente puede renderizar a half-float; si no, se usa 8 bits
    // con la radiancia escalada (u_outScale / u_inScale) para no recortar el brillo.
    const isGL2 = (renderer.capabilities as unknown as { isWebGL2?: boolean }).isWebGL2 !== false;
    const hdrOk = isGL2 && (
      renderer.extensions.has('EXT_color_buffer_float') ||
      renderer.extensions.has('EXT_color_buffer_half_float')
    );
    rayMat.uniforms.u_outScale.value = hdrOk ? 1 : 0.2;
    compMat.uniforms.u_inScale.value = hdrOk ? 1 : 5;

    const rtScene = new THREE.WebGLRenderTarget(w, h, {
      type: hdrOk ? THREE.HalfFloatType : THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false
    });

    rayMat.uniforms.u_resolution.value.set(w, h);
    compMat.uniforms.u_res.value.set(container.clientWidth, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(36, (container.clientWidth || 1) / (container.clientHeight || 1), 0.1, 200);
    const pointers = new Map<number, { x: number; y: number }>();

    const onDown = (e: PointerEvent) => {
      // Solo el propio canvas inicia arrastre / captura de puntero
      const target = e.target as HTMLElement | null;
      if (e.target !== canvas && target?.tagName !== 'CANVAS') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* puntero ya liberado */ }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      interactRef.current.dragging = true;
      interactRef.current.last = performance.now();
    };

    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (paramsRef.current.activePreset === 'planet') {
        const fo = followOffRef.current;
        fo.theta -= dx * 0.005;
        fo.phi = Math.max(0.3, Math.min(Math.PI - 0.3, fo.phi - dy * 0.005));
      } else {
        const tgt = camTargetRef.current;
        tgt.theta -= dx * 0.005;
        tgt.phi = Math.max(0.05, Math.min(Math.PI - 0.05, tgt.phi - dy * 0.005));
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      interactRef.current.last = performance.now();
    };

    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) interactRef.current.dragging = false;
      interactRef.current.last = performance.now();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (paramsRef.current.activePreset === 'planet') {
        const fo = followOffRef.current;
        fo.zoom = Math.max(0.5, Math.min(4, fo.zoom * Math.exp(e.deltaY * 0.001)));
      } else {
        const tgt = camTargetRef.current;
        tgt.radius = Math.max(4, Math.min(45, tgt.radius * Math.exp(e.deltaY * 0.001)));
      }
      interactRef.current.last = performance.now();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    // El zoom por rueda solo existe en pantalla completa: en el hero no secuestra el scroll de la página
    if (!embedded) canvas.addEventListener('wheel', onWheel, { passive: false });

    const onLost = (e: Event) => {
      e.preventDefault();
      failed = true;
    };
    canvas.addEventListener('webglcontextlost', onLost);

    const onResize = () => {
      const r = computeRT();
      renderer.setSize(r.cw, r.ch);
      camera.aspect = r.cw / r.ch;
      w = r.w;
      h = r.h;
      rtScene.setSize(w, h);
      rayMat.uniforms.u_resolution.value.set(w, h);
      compMat.uniforms.u_res.value.set(r.cw, r.ch);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    const clock = new THREE.Clock();
    let simTime = 0;
    let raf = 0;
    let fpsFrames = 0;
    let fpsLast = performance.now();
    let boost = 0; // intensidad suavizada de la secuencia de absorción
    const tmpPos = new THREE.Vector3();
    const planetPos = new THREE.Vector3();
    const lookTmp = new THREE.Vector3();
    let planetPhase = 0.9;
    let lookBlend = 0;
    let readyFired = false;

    // Apertura de la simulación: la cámara parte algo más cerca y se aleja suavemente
    if (!embedded) {
      camCurRef.current.radius = CAMERA_PRESETS.orbit.radius * 0.7;
      camCurRef.current.fov = 46;
    }

    const animate = () => {
      if (disposed || failed) return;
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);
      if (!isVisibleRef.current) return;

      const P = paramsRef.current;
      if (!P.paused) simTime += dt;

      // Cambio de calidad en caliente (sin recrear el renderer)
      if (P.quality !== currentQuality || perfDirty) {
        currentQuality = P.quality as QualityKey;
        perfDirty = false;
        onResize();
      }

      // Boost suavizado según la fase de absorción
      const targetBoost = PHASE_BOOST[(P.absorbPhase as AbsorbPhase) || 'idle'];
      boost += (targetBoost - boost) * (1 - Math.exp(-dt * 7));

      // --- Planeta: fase orbital kepleriana ---
      const geo = deriveGeometry(P.mass, P.spin);
      const orbR = orbitRadius(P.planetDist, geo);
      if (!P.paused) planetPhase -= dt * orbitalOmega(orbR, geo.rs) * P.planetSpeed;
      planetPosition(planetPhase, orbR, P.planetIncl, planetPos);

      const tgt = camTargetRef.current;
      const cur = camCurRef.current;
      const inter = interactRef.current;
      const now = performance.now();

      const following = P.activePreset === 'planet' && P.planetOn;
      const autoOrbit = P.activePreset === 'orbit' && now - inter.last > 2000;
      if (following) {
        // Cámara de persecución: detrás del planeta en su órbita, mirando hacia él
        const fo = followOffRef.current;
        const az = Math.atan2(planetPos.z, planetPos.x);
        tgt.theta = cur.theta + wrapPi(az + fo.theta - cur.theta);
        tgt.phi = fo.phi;
        tgt.radius = (orbR + 3.4) * fo.zoom;
      } else if (!inter.dragging && (boost > 0.05 || autoOrbit)) {
        tgt.theta += dt * (0.1 + 1.7 * boost);
      }

      // La cámara se precipita hacia la singularidad durante la sobrecarga
      const radiusMul = 1 - 0.3 * boost;
      const k = 1 - Math.exp(-dt * 5);
      cur.radius += (tgt.radius * radiusMul - cur.radius) * k;
      cur.theta += (tgt.theta - cur.theta) * k;
      cur.phi += (tgt.phi - cur.phi) * k;
      cur.fov += (tgt.fov - cur.fov) * k;

      tmpPos.set(
        cur.radius * Math.sin(cur.phi) * Math.cos(cur.theta),
        cur.radius * Math.cos(cur.phi),
        cur.radius * Math.sin(cur.phi) * Math.sin(cur.theta)
      );

      lookBlend += ((following ? 1 : 0) - lookBlend) * k;
      lookTmp.copy(planetPos).multiplyScalar(0.55 * lookBlend); // 0 → mira a la singularidad
      camera.position.copy(tmpPos);
      camera.lookAt(lookTmp);
      camera.updateMatrixWorld();
      const te = camera.matrixWorld.elements;

      const U = rayMat.uniforms;
      U.u_time.value = simTime;
      U.u_camPos.value.copy(tmpPos);
      U.u_camRight.value.set(te[0], te[1], te[2]);
      U.u_camUp.value.set(te[4], te[5], te[6]);
      U.u_camFwd.value.set(-te[8], -te[9], -te[10]);
      U.u_tanHalfFov.value = Math.tan((cur.fov * Math.PI) / 360);
      U.u_rs.value = geo.rs;
      U.u_rIn.value = geo.rIn;
      U.u_rOut.value = geo.rOut;
      U.u_spin.value = P.spin;
      U.u_planetOn.value = P.planetOn ? 1 : 0;
      U.u_planetDist.value = orbR;
      U.u_planetPhase.value = planetPhase;
      U.u_planetIncl.value = P.planetIncl;
      U.u_planetR.value = planetRadius(geo.rs);
      U.u_planetRot.value = planetPhase; // acoplamiento de marea: la cara visible rota con la órbita

      // Hiperaceleración de uniforms (sobrecarga de radiación)
      U.u_tempMax.value = P.temperature * (1 + 0.5 * boost);
      U.u_brightness.value = P.brightness * (1 + 1.2 * boost);
      U.u_spinSpeed.value = P.spinSpeed * (1 + 1.8 * boost);
      U.u_lensing.value = P.lensing * (1 + 0.6 * boost);
      U.u_doppler.value = P.doppler;
      U.u_thickness.value = P.thickness;
      U.u_maxSteps.value = QUALITY[P.quality as QualityKey].steps;

      compMat.uniforms.u_exposure.value = P.exposure * (1 + 0.4 * boost);
      compMat.uniforms.u_bloom.value = P.bloom * (1 + 0.8 * boost);

      pass(rayMat, rtScene);
      compMat.uniforms.tScene.value = rtScene.texture;
      pass(compMat, null);

      if (!readyFired) {
        readyFired = true;
        requestAnimationFrame(() => onReadyRef.current?.());
      }

      if (shotRef.current) {
        shotRef.current = false;
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'singularidad_3d.png';
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        }, 'image/png');
      }

      fpsFrames++;
      const t = performance.now();
      if (t - fpsLast >= 1000) {
        const measured = Math.round((fpsFrames * 1000) / (t - fpsLast));
        const stalled = t - fpsLast > 2000; // pestaña en segundo plano, etc.
        if (!embedded) setFps(measured);
        fpsFrames = 0;
        fpsLast = t;

        // Calidad adaptativa: si va lento, baja un nivel (nunca sube, sin oscilaciones)
        if (!stalled && !P.paused && measured < (P.quality === 'low' ? 15 : 22) && t - lastDowngrade > 2500) {
          const idx = QUALITY_ORDER.indexOf(P.quality as QualityKey);
          if (idx > 0) {
            lastDowngrade = t;
            setQuality(QUALITY_ORDER[idx - 1]);
          } else if (perfScale > 0.55) {
            // Ya en 'Baja': último recurso, reducir la resolución interna
            lastDowngrade = t;
            perfScale = Math.max(0.55, perfScale * 0.82);
            perfDirty = true;
          }
        }
      }
    };

    const startLoop = () => {
      if (disposed || failed) return;
      clock.start();
      animate();
    };

    // Compilación asíncrona (KHR_parallel_shader_compile): no bloquea el hilo principal
    const asyncRenderer = renderer as unknown as {
      compileAsync?: (scene: THREE.Object3D, camera: THREE.Camera) => Promise<unknown>;
    };
    if (typeof asyncRenderer.compileAsync === 'function') {
      quad.material = rayMat;
      asyncRenderer.compileAsync(postScene, postCam)
        .then(() => {
          quad.material = compMat;
          return asyncRenderer.compileAsync!(postScene, postCam);
        })
        .then(startLoop, startLoop);
    } else {
      startLoop();
    }

    return () => {
      disposed = true;
      canvas.removeEventListener('webglcontextlost', onLost);
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);

      rtScene.dispose();
      quadGeo.dispose();
      rayMat.dispose();
      compMat.dispose();
      renderer.dispose();
      if (container.contains(canvas)) container.removeChild(canvas);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded]);

  const geo = useMemo(() => deriveGeometry(sim.mass, sim.spin), [sim.mass, sim.spin]);
  const timeDilation = useMemo(() => {
    const f = Math.sqrt(Math.max(0.001, 1 - geo.rs / geo.rIn));
    return (1 / f).toFixed(2);
  }, [geo]);

  const resetAll = () => {
    setSim(DEFAULTS);
    setPlanetOn(true);
    applyPreset('orbit');
  };

  // Escape cierra el modal informativo
  useEffect(() => {
    if (!infoModalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setInfoModalOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [infoModalOpen]);

  const presetBtn = (key: keyof typeof CAMERA_PRESETS, Icon: React.ElementType, title: string, subtitle: string) => (
    <button
      key={key}
      type="button"
      {...isolate(() => applyPreset(key))}
      className={`gargantua-preset-card ${activePreset === key ? 'active' : ''}`}
    >
      <Icon style={{ width: '1rem', height: '1rem', color: '#c084fc' }} />
      <span style={{ fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: '0.65rem', color: '#a78bfa' }}>{subtitle}</span>
    </button>
  );

  const tabBtn = (key: 'physics' | 'optics' | 'presets', Icon: React.ElementType, label: string) => (
    <button
      type="button"
      {...isolate(() => setActiveTab(key))}
      className={`gargantua-tab-btn ${activeTab === key ? 'active' : ''}`}
    >
      <Icon style={{ width: '0.85rem', height: '0.85rem' }} /> {label}
    </button>
  );

  if (embedded) {
    return (
      <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />
      </div>
    );
  }

  const minDistRs = geo.rIn * 1.12 / geo.rs;

  return (
    <div className="gargantua-full-fullscreen">
      <div ref={mountRef} className="gargantua-canvas-layer" style={{ cursor: 'grab' }} />
      <header className="gargantua-sim-header" {...ISOLATE}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {onClose && (
            <button type="button" {...isolate(onClose)} className="gargantua-sim-btn">
              <ArrowLeft style={{ width: '1rem', height: '1rem' }} />
              <span>Volver</span>
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles style={{ width: '1.25rem', height: '1.25rem', color: '#c084fc' }} />
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>SINGULARIDAD 3D</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button type="button" {...isolate(() => setPaused((pp) => !pp))} className="gargantua-sim-btn" title={paused ? 'Reanudar' : 'Pausar'}>
            {paused ? <Play style={{ width: '1rem', height: '1rem' }} /> : <Pause style={{ width: '1rem', height: '1rem' }} />}
          </button>
          <button type="button" {...isolate(() => { shotRef.current = true; })} className="gargantua-sim-btn" title="Guardar Captura">
            <Download style={{ width: '1rem', height: '1rem' }} />
          </button>
          <button type="button" {...isolate(handleAudioToggle)} className={`gargantua-sim-btn ${audioPlaying ? 'active' : ''}`}>
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
          <button type="button" {...isolate(resetAll)} className="gargantua-sim-btn" title="Restablecer">
            <RotateCcw style={{ width: '0.85rem', height: '0.85rem' }} />
          </button>
        </div>

        {activeTab === 'physics' && (
          <div>
            <Slider label="Masa de la Singularidad (M0)" value={sim.mass} min={0.5} max={2.0} step={0.05} onChange={upd('mass')} />
            <Slider label="Momento Angular a/M (ISCO)" value={sim.spin} min={0} max={0.99} step={0.01} onChange={upd('spin')} format={(v) => v.toFixed(2)} />
            <Slider label="Temperatura Térmica" value={sim.temperature} min={3500} max={12000} step={100} onChange={upd('temperature')} format={(v) => `${Math.round(v)} K`} />
            <Slider label="Brillo de Acreción" value={sim.brightness} min={0.2} max={3.0} step={0.1} onChange={upd('brightness')} />
            <Slider label="Velocidad Rotación" value={sim.spinSpeed} min={0} max={2.5} step={0.1} onChange={upd('spinSpeed')} />
            <Slider label="Grosor de Toroides" value={sim.thickness} min={0.4} max={2.5} step={0.05} onChange={upd('thickness')} />
            <Slider label="Lente Gravitacional" value={sim.lensing} min={0.1} max={2.0} step={0.05} onChange={upd('lensing')} />
            <Slider label="Corrimiento Doppler" value={sim.doppler} min={0} max={1.6} step={0.05} onChange={upd('doppler')} />

            <div className="gargantua-planet-block">
              <div className="gargantua-toggle-row">
                <span className="gargantua-toggle-label">
                  <Globe style={{ width: '0.95rem', height: '0.95rem', color: '#c084fc' }} />
                  Planeta 'Aethelgard'
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={planetOn}
                  aria-label="Mostrar u ocultar el planeta"
                  className={`gargantua-switch ${planetOn ? 'on' : ''}`}
                  {...isolate(() => setPlanetOn((v) => !v))}
                >
                  <span />
                </button>
              </div>
              {planetOn && (
                <>
                  <Slider label="Velocidad Orbital" value={sim.planetSpeed} min={0} max={4} step={0.1} onChange={upd('planetSpeed')} />
                  <Slider
                    label="Distancia Orbital (r_s)"
                    value={sim.planetDist}
                    min={1.6}
                    max={6.4}
                    step={0.1}
                    onChange={upd('planetDist')}
                    format={(v) => `${Math.max(v, minDistRs).toFixed(2)} rs`}
                  />
                  <Slider
                    label="Inclinación Orbital"
                    value={sim.planetIncl}
                    min={0}
                    max={1.2}
                    step={0.02}
                    onChange={upd('planetIncl')}
                    format={(v) => `${Math.round((v * 180) / Math.PI)}°`}
                  />
                  <div className="gargantua-hint">
                    Órbita mínima estable = {minDistRs.toFixed(2)} r<sub>s</sub> (ISCO). Con inclinación cercana a 0° el planeta cruza justo detrás de la sombra y forma el anillo de Einstein.
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'optics' && (
          <div>
            <Slider label="Exposición Óptica" value={sim.exposure} min={0.3} max={2.5} step={0.05} onChange={upd('exposure')} />
            <Slider label="Resplandor (Bloom)" value={sim.bloom} min={0} max={2.0} step={0.05} onChange={upd('bloom')} />
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(168,85,247,0.2)' }}>
              <div style={{ fontSize: '0.75rem', marginBottom: '0.4rem', color: '#ddd6fe' }}>Calidad de Renderizado ({fps} FPS)</div>
              <div className="gargantua-quality-grid">
                {Object.entries(QUALITY).map(([key, q]) => (
                  <button
                    key={key}
                    type="button"
                    {...isolate(() => setQuality(key as QualityKey))}
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
            {presetBtn('planet', Orbit, 'Planeta', 'Seguimiento Orbital')}
          </div>
        )}
      </div>

      {infoModalOpen && (
        <div
          className="gargantua-modal-overlay"
          {...ISOLATE}
          onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) setInfoModalOpen(false); }}
        >
          <div className="gargantua-modal-card" role="dialog" aria-modal="true">
            <button
              type="button"
              aria-label="Cerrar"
              {...isolate(() => setInfoModalOpen(false))}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#c084fc', cursor: 'pointer' }}
            >
              <X style={{ width: '1.25rem', height: '1.25rem' }} />
            </button>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f3e8ff' }}>Simulación por Ray-Tracing Relativista</h2>
            <p style={{ fontSize: '0.8rem', color: '#a78bfa', marginBottom: '1.25rem' }}>Efectos ópticos integrados directamente en GPU WebGL</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.8rem', color: '#ddd6fe' }}>
              <div style={{ padding: '0.85rem', background: 'rgba(25, 12, 48, 0.6)', borderRadius: '0.75rem', border: '1px solid rgba(168,85,247,0.2)' }}>
                <strong style={{ color: '#c084fc' }}>Dilatación Temporal:</strong> En el límite interno, 1 hora de simulación equivale a <strong>{timeDilation} horas</strong> para un observador distante.
              </div>
              <div style={{ padding: '0.85rem', background: 'rgba(25, 12, 48, 0.6)', borderRadius: '0.75rem', border: '1px solid rgba(168,85,247,0.2)' }}>
                <strong style={{ color: '#c084fc' }}>Efecto Beaming Doppler:</strong> La materia que se desplaza hacia el observador incrementa exponencialmente su brillo e intensidad por distorsión Doppler.
              </div>
              <div style={{ padding: '0.85rem', background: 'rgba(25, 12, 48, 0.6)', borderRadius: '0.75rem', border: '1px solid rgba(168,85,247,0.2)' }}>
                <strong style={{ color: '#c084fc' }}>Anillo de Fotones:</strong> Los rayos que rozan la esfera de fotones (1.5 r<sub>s</sub>) orbitan el agujero negro antes de escapar y dibujan el borde luminoso de la sombra.
              </div>
              <div style={{ padding: '0.85rem', background: 'rgba(25, 12, 48, 0.6)', borderRadius: '0.75rem', border: '1px solid rgba(168,85,247,0.2)' }}>
                <strong style={{ color: '#c084fc' }}>Planeta Aethelgard:</strong> Orbita fuera de la ISCO con acoplamiento de marea. Su luz sigue las mismas geodésicas que la del disco: al pasar tras la sombra se estira en arcos, y su cara iluminada siempre mira al núcleo, bañada por la radiación térmica del disco (con corrimiento al rojo gravitacional).
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}