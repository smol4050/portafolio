import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { compositeFS, quadVS, rayFS } from './shaders';
import { CAMERA_PRESETS, DEFAULTS, deriveGeometry, PHASE_BOOST, QUALITY, QUALITY_ORDER, wrapPi, type CameraPresetKey, type QualityKey, type RenderParameters } from './config';

interface RendererOptions {
  mountRef: RefObject<HTMLDivElement | null>;
  embedded: boolean;
  params: RenderParameters;
  onReady?: () => void;
  onFps?: (fps: number) => void;
  onQualityChange: (quality: QualityKey) => void;
  onContextStatus: (available: boolean) => void;
}

export function useGargantuaRenderer({ mountRef, embedded, params, onReady, onFps, onQualityChange, onContextStatus }: RendererOptions) {
  const isVisibleRef = useRef(true);
  const paramsRef = useRef(params);
  const onReadyRef = useRef(onReady);
  const syncLoopRef = useRef<() => void>(() => {});
  const camTargetRef = useRef({ ...CAMERA_PRESETS.orbit });
  const camCurRef = useRef({ ...CAMERA_PRESETS.orbit });
  const interactRef = useRef({ dragging: false, last: 0 });
  const shotRef = useRef(false);

  useLayoutEffect(() => {
    paramsRef.current = params;
    syncLoopRef.current();
  }, [params]);
  useLayoutEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  const applyPreset = useCallback((key: CameraPresetKey) => {
    const goal = { ...CAMERA_PRESETS[key] };
    goal.theta = camCurRef.current.theta + wrapPi(goal.theta - camCurRef.current.theta);
    camTargetRef.current = goal;
    interactRef.current.last = performance.now();
  }, []);
  const capture = useCallback(() => { shotRef.current = true; }, []);

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
    } catch {
      onContextStatus(false);
      return;
    }

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
        u_maxSteps: { value: QUALITY[paramsRef.current.quality].steps },
        u_outScale: { value: 1 }
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
    let currentQuality: QualityKey = paramsRef.current.quality;
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
    renderer.debug.onShaderError = () => {
      if (disposed) return;
      failed = true;
      onContextStatus(false);
      syncLoopRef.current();
    };

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
      const tgt = camTargetRef.current;
      tgt.theta -= dx * 0.005;
      tgt.phi = Math.max(0.05, Math.min(Math.PI - 0.05, tgt.phi - dy * 0.005));
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
      const tgt = camTargetRef.current;
      tgt.radius = Math.max(4, Math.min(45, tgt.radius * Math.exp(e.deltaY * 0.001)));
      interactRef.current.last = performance.now();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    // El zoom por rueda solo existe en pantalla completa: en el hero no secuestra el scroll de la página
    if (!embedded) canvas.addEventListener('wheel', onWheel, { passive: false });

    let contextLost = false;
    const onLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      onContextStatus(false);
      syncLoopRef.current();
    };
    const onRestored = () => {
      contextLost = false;
      failed = false;
      void compileShaders().then(() => {
        if (disposed || contextLost || failed) return;
        onContextStatus(true);
        syncLoop();
      }, () => {
        failed = true;
        onContextStatus(false);
        syncLoop();
      });
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

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

    const timer = new THREE.Timer();
    timer.connect(document);
    let simTime = 0;
    let raf = 0;
    let loopReady = false;
    let running = false;
    let fpsFrames = 0;
    let fpsLast = performance.now();
    let boost = 0; // intensidad suavizada de la secuencia de absorción
    const tmpPos = new THREE.Vector3();
    let readyFired = false;
    const captureTimers = new Set<number>();

    // Apertura de la simulación: la cámara parte algo más cerca y se aleja suavemente
    if (!embedded) {
      camCurRef.current.radius = CAMERA_PRESETS.orbit.radius * 0.7;
      camCurRef.current.fov = 46;
    }

    const canRun = () => !disposed && !failed && !contextLost && !paramsRef.current.paused && isVisibleRef.current && !document.hidden;
    const stopLoop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      running = false;
    };
    const syncLoop = () => {
      if (!loopReady || !canRun()) {
        stopLoop();
        return;
      }
      if (!running) {
        running = true;
        timer.reset();
        raf = requestAnimationFrame(animate);
      }
    };

    const animate = () => {
      raf = 0;
      if (!running || !canRun()) {
        stopLoop();
        return;
      }
      timer.update();
      const dt = Math.min(timer.getDelta(), 0.1);

      const P = paramsRef.current;
      simTime += dt;

      // Cambio de calidad en caliente (sin recrear el renderer)
      if (P.quality !== currentQuality || perfDirty) {
        currentQuality = P.quality as QualityKey;
        perfDirty = false;
        onResize();
      }

      // Boost suavizado según la fase de absorción
      const targetBoost = PHASE_BOOST[P.absorbPhase];
      boost += (targetBoost - boost) * (1 - Math.exp(-dt * 7));

      const geo = deriveGeometry(P.mass, P.spin);

      const tgt = camTargetRef.current;
      const cur = camCurRef.current;
      const inter = interactRef.current;
      const now = performance.now();

      const autoOrbit = P.activePreset === 'orbit' && now - inter.last > 2000;
      if (!inter.dragging && (boost > 0.05 || autoOrbit)) {
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

      camera.position.copy(tmpPos);
      camera.lookAt(0, 0, 0);
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
        onReadyRef.current?.();
      }

      if (shotRef.current) {
        shotRef.current = false;
        canvas.toBlob((blob) => {
          if (!blob || disposed) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'singularidad_3d.png';
          a.click();
          const timeout = window.setTimeout(() => {
            URL.revokeObjectURL(url);
            captureTimers.delete(timeout);
          }, 2000);
          captureTimers.add(timeout);
        }, 'image/png');
      }

      fpsFrames++;
      const t = performance.now();
      if (t - fpsLast >= 1000) {
        const measured = Math.round((fpsFrames * 1000) / (t - fpsLast));
        const stalled = t - fpsLast > 2000; // pestaña en segundo plano, etc.
        if (!embedded) onFps?.(measured);
        fpsFrames = 0;
        fpsLast = t;

        // Calidad adaptativa: si va lento, baja un nivel (nunca sube, sin oscilaciones)
        if (!stalled && !P.paused && measured < (P.quality === 'low' ? 15 : 22) && t - lastDowngrade > 2500) {
          const idx = QUALITY_ORDER.indexOf(P.quality as QualityKey);
          if (idx > 0) {
            lastDowngrade = t;
            onQualityChange(QUALITY_ORDER[idx - 1]);
          } else if (perfScale > 0.55) {
            // Ya en 'Baja': último recurso, reducir la resolución interna
            lastDowngrade = t;
            perfScale = Math.max(0.55, perfScale * 0.82);
            perfDirty = true;
          }
        }
      }
      if (running && canRun()) raf = requestAnimationFrame(animate);
    };

    const startLoop = () => {
      if (disposed || failed) return;
      loopReady = true;
      syncLoop();
    };

    syncLoopRef.current = syncLoop;
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      isVisibleRef.current = entry.isIntersecting;
      syncLoop();
    }, { threshold: 0.05 });
    visibilityObserver.observe(container);
    const onVisibilityChange = () => syncLoop();
    document.addEventListener('visibilitychange', onVisibilityChange);

    const asyncRenderer = renderer as unknown as {
      compileAsync?: (scene: THREE.Object3D, camera: THREE.Camera) => Promise<unknown>;
    };
    const compileShaders = async () => {
      quad.material = rayMat;
      if (typeof asyncRenderer.compileAsync === 'function') await asyncRenderer.compileAsync(postScene, postCam);
      else renderer.compile(postScene, postCam);
      quad.material = compMat;
      if (typeof asyncRenderer.compileAsync === 'function') await asyncRenderer.compileAsync(postScene, postCam);
      else renderer.compile(postScene, postCam);
    };
    // Compilación asíncrona (KHR_parallel_shader_compile): no bloquea el hilo principal
    void compileShaders().then(() => {
      if (!disposed) startLoop();
    }, () => {
      if (disposed) return;
      failed = true;
      onContextStatus(false);
      syncLoop();
    });

    return () => {
      disposed = true;
      loopReady = false;
      stopLoop();
      syncLoopRef.current = () => {};
      captureTimers.forEach((timer) => window.clearTimeout(timer));
      captureTimers.clear();
      visibilityObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
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
      timer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (container.contains(canvas)) container.removeChild(canvas);
    };
  }, [embedded, mountRef, onContextStatus, onFps, onQualityChange]);

  return { applyPreset, capture };
}
