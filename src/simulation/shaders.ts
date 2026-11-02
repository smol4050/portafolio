export const quadVS = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const rayFS = /* glsl */ `
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

export const compositeFS = /* glsl */ `
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
