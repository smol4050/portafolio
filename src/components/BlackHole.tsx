
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

type BlackHoleProps = {
  className?: string
}

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Disco de acreción: materia caliente, irregular y en rotación.
const diskFragmentShader = `
  uniform float uTime;
  varying vec2 vUv;

  #define PI 3.14159265359

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float angle = atan(p.y, p.x);

    float innerEdge = 0.32;
    float outerEdge = 0.94;

    float innerMask = smoothstep(innerEdge, innerEdge + 0.10, r);
    float outerMask = 1.0 - smoothstep(outerEdge - 0.14, outerEdge, r);

    float spiral1 = sin(angle * 3.0 - r * 17.0 + uTime * 0.65);
    float spiral2 = sin(angle * 7.0 - r * 29.0 - uTime * 0.38);
    float turbulence = sin(angle * 13.0 + r * 43.0 + uTime * 0.2);

    float matter = 0.64
      + spiral1 * 0.16
      + spiral2 * 0.10
      + turbulence * 0.055;

    // La parte inferior del disco parece más cercana y caliente.
    float hotSide = smoothstep(-0.65, 0.72, -p.y);
    matter *= 0.76 + hotSide * 0.48;

    vec3 deepRed = vec3(0.36, 0.025, 0.16);
    vec3 orange = vec3(1.0, 0.20, 0.055);
    vec3 gold = vec3(1.0, 0.70, 0.30);
    vec3 whiteHot = vec3(1.0, 0.91, 0.78);

    float heat = clamp(matter + hotSide * 0.14, 0.0, 1.0);
    vec3 color = mix(deepRed, orange, smoothstep(0.05, 0.7, heat));
    color = mix(color, gold, smoothstep(0.48, 0.9, heat));
    color = mix(color, whiteHot, smoothstep(0.88, 1.0, heat));

    float clumps = 0.76 + 0.24 * sin(angle * 11.0 - r * 35.0 + uTime);
    float alpha = innerMask * outerMask * clumps * 0.88;

    gl_FragColor = vec4(color * (0.65 + matter * 0.7), alpha);
  }
`

// Anillo de lente gravitacional visto de frente.
// La asimetría evita que parezca un aro geométrico perfecto.
const lensFragmentShader = `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float angle = atan(p.y, p.x);

    float ringRadius = 0.285;
    ringRadius += 0.009 * sin(angle * 2.0 + 0.4);
    ringRadius += 0.004 * sin(angle * 5.0 - 0.7);

    float width = 0.014 + 0.004 * sin(angle * 3.0 + uTime * 0.08);
    float distanceToRing = abs(r - ringRadius);

    float ring = 1.0 - smoothstep(width * 0.35, width * 1.7, distanceToRing);
    float halo = exp(-distanceToRing * 38.0) * 0.40;
    float broadGlow = exp(-distanceToRing * 13.0) * 0.13;

    float brightArc = 0.68
      + 0.25 * cos(angle - 0.8)
      + 0.10 * sin(angle * 3.0 + 0.5);

    brightArc = clamp(brightArc, 0.24, 1.0);

    float innerShadow = 1.0 - smoothstep(0.285, 0.34, r);
    vec3 violet = vec3(0.40, 0.24, 1.0);
    vec3 blue = vec3(0.30, 0.58, 1.0);
    vec3 white = vec3(0.94, 0.91, 1.0);

    float colorShift = smoothstep(-0.9, 0.8, sin(angle + 0.4));
    vec3 color = mix(violet, blue, colorShift * 0.55);
    color = mix(color, white, ring * brightArc * 0.72);

    float alpha = (ring * 0.96 + halo + broadGlow) * brightArc;
    alpha *= 1.0 - innerShadow * 0.90;

    gl_FragColor = vec4(color * (0.75 + ring * 1.4), alpha);
  }
`

// Resplandor suave alrededor del horizonte.
const glowFragmentShader = `
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);

    float glow = exp(-abs(r - 0.30) * 9.0);
    float innerDark = smoothstep(0.18, 0.265, r);
    float alpha = glow * innerDark * 0.18;

    vec3 color = vec3(0.25, 0.13, 0.82);
    gl_FragColor = vec4(color, alpha);
  }
`

const particleVertexShader = `
  uniform float uTime;
  uniform float uPixelRatio;

  attribute float aSize;
  attribute float aAngle;
  attribute float aRadius;
  attribute float aDepth;
  attribute float aSpeed;
  attribute float aPhase;

  varying float vAlpha;
  varying float vPhase;

  void main() {
    float angle = aAngle + uTime * aSpeed;
    float radius = aRadius
      + sin(uTime * 0.28 + aPhase * 6.28318) * 0.025;

    vec3 p = vec3(
      cos(angle) * radius,
      sin(angle) * radius * 0.36,
      aDepth + sin(angle * 2.0 + aPhase * 6.28318) * 0.06
    );

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float perspective = 1.0 / max(1.0, -mvPosition.z);
    gl_PointSize = aSize * uPixelRatio * perspective * 18.0;

    vAlpha = (0.22 + 0.5 * (1.0 - aRadius / 2.0));
    vPhase = aPhase;
  }
`

const particleFragmentShader = `
  varying float vAlpha;
  varying float vPhase;

  void main() {
    float r = length(gl_PointCoord - 0.5);
    float alpha = 1.0 - smoothstep(0.08, 0.5, r);

    vec3 violet = vec3(0.43, 0.34, 1.0);
    vec3 blue = vec3(0.25, 0.55, 1.0);
    vec3 color = mix(violet, blue, vPhase);

    gl_FragColor = vec4(color, alpha * vAlpha);
  }
`

function createParticles(count: number) {
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const angles = new Float32Array(count)
  const radii = new Float32Array(count)
  const depths = new Float32Array(count)
  const speeds = new Float32Array(count)
  const phases = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const layer = Math.random()
    const radius = 0.78 + Math.random() * 1.15

    positions[i * 3] = 0
    positions[i * 3 + 1] = 0
    positions[i * 3 + 2] = 0

    sizes[i] = 0.35 + Math.random() * 1.1
    angles[i] = Math.random() * Math.PI * 2
    radii[i] = radius
    depths[i] = (layer - 0.5) * (0.2 + Math.random() * 0.8)
    speeds[i] = (0.025 + Math.random() * 0.07)
      * (Math.random() > 0.5 ? 1 : -1)
    phases[i] = Math.random()
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1))
  geometry.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1))
  geometry.setAttribute('aDepth', new THREE.BufferAttribute(depths, 1))
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))

  return geometry
}

function createStars(count: number) {
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const radius = 2.6 + Math.random() * 4.8

    positions[i * 3] = Math.cos(angle) * radius
    positions[i * 3 + 1] = Math.sin(angle) * radius
    positions[i * 3 + 2] = (Math.random() - 0.5) * 4.0
    sizes[i] = 0.35 + Math.random() * 0.8
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

  return geometry
}

const starVertexShader = `
  uniform float uPixelRatio;
  attribute float aSize;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uPixelRatio * (14.0 / max(1.0, -mvPosition.z));
  }
`

const starFragmentShader = `
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float alpha = 1.0 - smoothstep(0.05, 0.5, r);
    gl_FragColor = vec4(0.72, 0.76, 1.0, alpha * 0.48);
  }
`

export default function BlackHole({ className = '' }: BlackHoleProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer: THREE.WebGLRenderer

    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      })
    } catch {
      host.classList.add('black-hole-unavailable')
      return
    }

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)

    renderer.setPixelRatio(pixelRatio)
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.className = 'black-hole-canvas'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
    camera.position.set(0, 0, 8.5)

    const root = new THREE.Group()
    scene.add(root)

    // El disco queda detrás del horizonte y ligeramente inclinado.
    const diskGroup = new THREE.Group()
    diskGroup.rotation.set(-0.88, -0.10, -0.10)
    root.add(diskGroup)

    const diskMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader,
      fragmentShader: diskFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })

    const disk = new THREE.Mesh(
      new THREE.PlaneGeometry(3.9, 3.9),
      diskMaterial,
    )
    disk.scale.set(1, 0.53, 1)
    disk.position.z = -0.12
    diskGroup.add(disk)

    // Un plano frontal dibuja la lente gravitacional como luz deformada.
    const lensMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader,
      fragmentShader: lensFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })

    const lens = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 3.0),
      lensMaterial,
    )
    lens.position.z = 0.28
    root.add(lens)

    const glowMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: glowFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      glowMaterial,
    )
    glow.position.z = 0.18
    root.add(glow)

    // Horizonte de sucesos: el centro debe permanecer completamente negro.
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0x010006,
      depthWrite: true,
    })

    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.405, 128),
      coreMaterial,
    )
    core.position.z = 0.22
    root.add(core)

    // Un disco negro frontal mantiene limpia la silueta del horizonte.
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      depthTest: false,
      depthWrite: false,
    })

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.39, 128),
      shadowMaterial,
    )
    shadow.position.z = 0.31
    root.add(shadow)

    const particleGeometry = createParticles(
      window.innerWidth < 680 ? 450 : 900,
    )

    const particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: pixelRatio },
      },
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    const particles = new THREE.Points(particleGeometry, particleMaterial)
    particles.frustumCulled = false
    root.add(particles)

    const starGeometry = createStars(
      window.innerWidth < 680 ? 75 : 150,
    )

    const starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: pixelRatio },
      },
      vertexShader: starVertexShader,
      fragmentShader: starFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    const stars = new THREE.Points(starGeometry, starMaterial)
    stars.frustumCulled = false
    scene.add(stars)

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    )

    const pointer = { x: 0, y: 0 }
    const target = { x: 0, y: 0 }

    let frameId = 0
    let lastTime = 0
    let elapsed = 0
    let running = false
    let disposed = false

    const resize = () => {
      const rect = host.getBoundingClientRect()
      const width = Math.max(1, rect.width)
      const height = Math.max(1, rect.height)

      camera.aspect = width / height
      camera.position.z = width < 420 ? 9.7 : width < 680 ? 9.1 : 8.5
      camera.updateProjectionMatrix()

      renderer.setSize(width, height, false)
    }

    const renderFrame = (now: number) => {
      if (!running || disposed) return

      frameId = requestAnimationFrame(renderFrame)

      const delta = lastTime
        ? Math.min((now - lastTime) / 1000, 0.04)
        : 0

      lastTime = now
      elapsed += delta

      diskMaterial.uniforms.uTime.value = elapsed
      lensMaterial.uniforms.uTime.value = elapsed
      particleMaterial.uniforms.uTime.value = elapsed

      if (!reducedMotion.matches) {
        diskGroup.rotation.z += delta * 0.012
        particles.rotation.z += delta * 0.006

        pointer.x += (target.x - pointer.x) * 0.025
        pointer.y += (target.y - pointer.y) * 0.025

        root.rotation.y = pointer.x * 0.035
        root.rotation.x = pointer.y * 0.025
      }

      renderer.render(scene, camera)

      if (reducedMotion.matches) {
        running = false
        lastTime = 0
      }
    }

    const start = () => {
      if (running || disposed || reducedMotion.matches) return

      running = true
      lastTime = 0
      frameId = requestAnimationFrame(renderFrame)
    }

    const stop = () => {
      running = false
      cancelAnimationFrame(frameId)
      lastTime = 0
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      if (!rect.width || !rect.height) return

      target.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2
      target.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2
    }

    const onPointerLeave = () => {
      target.x = 0
      target.y = 0
    }

    const onMotionChange = () => {
      if (reducedMotion.matches) {
        stop()
        renderer.render(scene, camera)
      } else {
        start()
      }
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)
    resize()

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (reducedMotion.matches) {
          renderer.render(scene, camera)
        } else {
          start()
        }
      } else {
        stop()
      }
    })

    intersectionObserver.observe(host)

    host.addEventListener('pointermove', onPointerMove)
    host.addEventListener('pointerleave', onPointerLeave)
    reducedMotion.addEventListener('change', onMotionChange)

    if (reducedMotion.matches) {
      renderer.render(scene, camera)
    } else {
      start()
    }

    return () => {
      disposed = true
      stop()

      resizeObserver.disconnect()
      intersectionObserver.disconnect()

      host.removeEventListener('pointermove', onPointerMove)
      host.removeEventListener('pointerleave', onPointerLeave)
      reducedMotion.removeEventListener('change', onMotionChange)

      disk.geometry.dispose()
      diskMaterial.dispose()
      lens.geometry.dispose()
      lensMaterial.dispose()
      glow.geometry.dispose()
      glowMaterial.dispose()
      core.geometry.dispose()
      coreMaterial.dispose()
      shadow.geometry.dispose()
      shadowMaterial.dispose()
      particleGeometry.dispose()
      particleMaterial.dispose()
      starGeometry.dispose()
      starMaterial.dispose()

      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className={`black-hole ${className}`.trim()}
      aria-hidden="true"
    />
  )
}