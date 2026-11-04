"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { CHAPTERS } from "./stories";

// ---------------------------------------------------------------------------
// A WebGL tree. The trunk is a tapered tube through the chapters of my life,
// every hobby is a limb, and the crown is a few thousand instanced leaves that
// sway in a vertex shader. Stage markers are HTML dots projected from 3D.
// ---------------------------------------------------------------------------

type Anchor = {
  id: string;
  kind: "chapter" | "story";
  chapterId: string;
  position: THREE.Vector3;
};

const LEAF_COLORS = ["#bbf7d0", "#86efac", "#4ade80", "#34d399", "#22c55e", "#a3e635", "#65a30d"];

function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tapered tube around a curve, so the trunk narrows towards the crown. */
function taperedTube(
  curve: THREE.Curve<THREE.Vector3>,
  radiusStart: number,
  radiusEnd: number,
  segments = 28,
  radial = 9,
  /** 0 = smooth, ~0.08 = visibly fluted bark */
  wrinkle = 0,
  /** 0 = straight taper, ~0.6 = flared foot like a real trunk */
  flare = 0,
) {
  const positions: number[] = [];
  const indices: number[] = [];
  const frames = curve.computeFrenetFrames(segments, false);

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const point = curve.getPointAt(t);
    const normal = frames.normals[Math.min(i, frames.normals.length - 1)];
    const binormal = frames.binormals[Math.min(i, frames.binormals.length - 1)];
    const baseRadius = radiusStart + (radiusEnd - radiusStart) * t;

    for (let j = 0; j < radial; j += 1) {
      const angle = (j / radial) * Math.PI * 2;
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);

      // Fluting runs up the trunk; small high-frequency wobble breaks it up so
      // the surface never reads as a smooth extrusion.
      const flutes = Math.cos(angle * 6 + t * 2.2) * 0.62 + Math.sin(angle * 11 - t * 5) * 0.38;
      const wobble = Math.sin(t * 34 + angle * 2.4) * 0.5 + Math.cos(t * 61 - angle * 3.1) * 0.5;
      const radius =
        baseRadius *
        (1 + wrinkle * (flutes * 0.7 + wobble * 0.5)) *
        (1 + flare * Math.exp(-t * 15));

      positions.push(
        point.x + (normal.x * nx + binormal.x * ny) * radius,
        point.y + (normal.y * nx + binormal.y * ny) * radius,
        point.z + (normal.z * nx + binormal.z * ny) * radius,
      );
    }
  }

  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A single leaf: a folded diamond, double sided, scaled per instance. */
function leafGeometry() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array([0, 0, 0, 0.52, 0.09, 0.3, 1, 0, 0, 0.52, 0.09, -0.3]);
  const indices = [0, 1, 2, 0, 2, 3];
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function radialTexture(inner: string, outer: string, size = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(1, outer);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export default function GreetingPage() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const markerRefs = useRef(new Map<string, HTMLButtonElement>());
  const selectionRef = useRef<{ chapterId: string | null; storyId: string | null }>({
    chapterId: null,
    storyId: null,
  });
  const viewRef = useRef({ azimuth: 0.12, polar: 1.2, distance: 40, target: new THREE.Vector3(0, 9.4, 0) });
  const desiredRef = useRef({ azimuth: 0.12, polar: 1.2, distance: 27, target: new THREE.Vector3(0, 9.4, 0) });

  const [chapterId, setChapterId] = useState<string | null>(null);
  const [storyId, setStoryId] = useState<string | null>(null);

  const activeChapter = useMemo(
    () => (chapterId ? CHAPTERS.find((chapter) => chapter.id === chapterId) ?? null : null),
    [chapterId],
  );
  const activeStory = useMemo(() => {
    if (!activeChapter || !storyId) return null;
    return activeChapter.stories.find((story) => story.id === storyId) ?? null;
  }, [activeChapter, storyId]);

  const reset = useCallback(() => {
    setChapterId(null);
    setStoryId(null);
  }, []);

  // The render loop reads the latest selection without re-building the scene.
  useEffect(() => {
    selectionRef.current = { chapterId, storyId };
  }, [chapterId, storyId]);

  // Camera goal follows the selection.
  useEffect(() => {
    if (activeChapter) {
      desiredRef.current.target.set(0, activeChapter.height + 1.2, 0);
      desiredRef.current.distance = 10.5;
      desiredRef.current.azimuth = 0.06;
      desiredRef.current.polar = 1.42;
    } else {
      desiredRef.current.target.set(0, 9.4, 0);
      desiredRef.current.distance = 30;
      desiredRef.current.azimuth = 0.12;
      desiredRef.current.polar = 1.2;
    }
  }, [activeChapter]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor("#04120b", 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2("#04120b", 0.014);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
    camera.position.set(0, 12, 46);

    scene.add(new THREE.HemisphereLight(0x8fd6a4, 0x04120b, 0.85));
    scene.add(new THREE.AmbientLight(0x1b4b32, 0.55));

    const key = new THREE.DirectionalLight(0xffe6bd, 2.7);
    key.position.set(9, 22, 12);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x34d399, 1.45);
    rim.position.set(-12, 10, -10);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0xa3e635, 0.5);
    fill.position.set(4, 4, -14);
    scene.add(fill);

    // --- trunk ---------------------------------------------------------------
    const trunkPoints: THREE.Vector3[] = [new THREE.Vector3(0, 0.2, 0)];
    CHAPTERS.forEach((chapter, index) => {
      trunkPoints.push(new THREE.Vector3(Math.sin(index * 1.1) * 0.18, chapter.height, Math.cos(index * 0.9) * 0.12));
    });
    trunkPoints.push(new THREE.Vector3(0, 16.6, 0));

    const trunkCurve = new THREE.CatmullRomCurve3(trunkPoints, false, "catmullrom", 0.5);
    const barkMaterial = new THREE.MeshStandardMaterial({ color: 0x6a5637, roughness: 0.95, metalness: 0 });
    const trunkMesh = new THREE.Mesh(taperedTube(trunkCurve, 0.66, 0.2, 56, 16, 0.075, 0.5), barkMaterial);
    scene.add(trunkMesh);

    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2 + 0.7;
      const rootCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.45, 0),
        new THREE.Vector3(Math.cos(angle) * 1.5, 0.1, Math.sin(angle) * 1.5),
        new THREE.Vector3(Math.cos(angle) * 2.7, -0.06, Math.sin(angle) * 2.7),
      ]);
      scene.add(new THREE.Mesh(taperedTube(rootCurve, 0.3, 0.02, 20, 8, 0.1, 0.3), barkMaterial));
    }

    const shadowTexture = radialTexture("rgba(0,0,0,0.75)", "rgba(0,0,0,0)");
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(8.5, 48),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.02;
    scene.add(ground);

    // --- branches + leaves ---------------------------------------------------
    const random = makeRandom(20261023);
    const anchors: Anchor[] = [];
    type Placement = { matrix: THREE.Matrix4; color: THREE.Color };
    const leafPlacements: Placement[] = [];
    const leafPalette = LEAF_COLORS.map((hex) => new THREE.Color(hex));

    CHAPTERS.forEach((chapter) => {
      anchors.push({
        id: chapter.id,
        kind: "chapter",
        chapterId: chapter.id,
        position: new THREE.Vector3(0, chapter.height, 0),
      });

      // Lower chapters carry noticeably less foliage than the crown.
      const density = 0.4 + 0.6 * (chapter.height / 14.7);

      chapter.stories.forEach((story) => {
        const azimuth = THREE.MathUtils.degToRad(story.azimuth);
        const tilt = THREE.MathUtils.degToRad(story.tilt);
        const direction = new THREE.Vector3(
          Math.sin(tilt) * Math.sin(azimuth),
          Math.cos(tilt),
          Math.sin(tilt) * Math.cos(azimuth),
        );

        const start = new THREE.Vector3(0, chapter.height, 0);
        const tip = start.clone().add(direction.clone().multiplyScalar(story.length * 1.32));
        const mid = start
          .clone()
          .lerp(tip, 0.55)
          .add(direction.clone().multiplyScalar(0.3))
          .add(new THREE.Vector3(0, 0.32, 0));

        const curve = new THREE.CatmullRomCurve3([start, mid, tip], false, "catmullrom", 0.5);
        const limbRadius = 0.085 + 0.075 * (chapter.height / 14.7);
        scene.add(new THREE.Mesh(taperedTube(curve, limbRadius, 0.018, 26, 8, 0.16), barkMaterial));

        anchors.push({
          id: `${chapter.id}:${story.id}`,
          kind: "story",
          chapterId: chapter.id,
          position: tip.clone(),
        });

        [0.28, 0.46, 0.64, 0.82, 0.98].forEach((t, clumpIndex) => {
          const centre = curve.getPointAt(Math.min(0.995, t));
          const radius = 1.5 - clumpIndex * 0.1;
          const count = Math.round((clumpIndex === 0 ? 40 : clumpIndex === 4 ? 62 : 78) * density);

          for (let i = 0; i < count; i += 1) {
            const theta = random() * Math.PI * 2;
            const phi = Math.acos(2 * random() - 1);
            const r = Math.cbrt(random()) * radius;
            const offset = new THREE.Vector3(
              Math.sin(phi) * Math.cos(theta) * r * 1.15,
              Math.cos(phi) * r * 0.85,
              Math.sin(phi) * Math.sin(theta) * r * 1.15,
            );

            const position = centre.clone().add(offset);
            const scale = 0.2 + random() * 0.24;
            const quaternion = new THREE.Quaternion().setFromEuler(
              new THREE.Euler(random() * Math.PI, random() * Math.PI * 2, random() * Math.PI),
            );

            leafPlacements.push({
              matrix: new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(scale, scale, scale)),
              color: leafPalette[Math.floor(random() * leafPalette.length)].clone(),
            });
          }
        });
      });
    });

    // A dome of leaves wrapping the whole crown, so the canopy stays full from
    // every angle instead of being a flat fan of branch tips.
    for (let i = 0; i < 2600; i += 1) {
      // Biased towards the top: sqrt-ish sampling plus a rejection pass low down.
      const y = 4.6 + Math.pow(random(), 0.5) * 13.4;
      if (y < 9 && random() < 0.7) continue;
      const normalised = (y - 12.2) / 5.8;
      const allowed = Math.sqrt(Math.max(0, 1 - normalised * normalised));
      if (allowed <= 0.06) continue;

      // Pine crowns are wide and flat, so the horizontal radius is exaggerated.
      const radius = allowed * (0.4 + 0.6 * Math.sqrt(random())) * 9.4;
      const theta = random() * Math.PI * 2;
      const position = new THREE.Vector3(
        Math.cos(theta) * radius * 1.15,
        y + (random() - 0.5) * 0.35,
        Math.sin(theta) * radius * 0.92,
      );
      const scale = 0.19 + random() * 0.22;
      const quaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(random() * Math.PI, random() * Math.PI * 2, random() * Math.PI),
      );

      leafPlacements.push({
        matrix: new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(scale, scale, scale)),
        color: leafPalette[Math.floor(random() * leafPalette.length)].clone(),
      });
    }

    const leafMesh = new THREE.InstancedMesh(
      leafGeometry(),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.62,
        metalness: 0.05,
        side: THREE.DoubleSide,
        flatShading: true,
      }),
      leafPlacements.length,
    );

    const timeUniform = { value: 0 };
    const leafMaterial = leafMesh.material as THREE.MeshStandardMaterial;
    leafMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeUniform;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           #ifdef USE_INSTANCING
             vec3 leafPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
             float phase = leafPos.x * 0.55 + leafPos.z * 0.42 + leafPos.y * 0.22;
             transformed.x += sin(uTime * 1.05 + phase) * 0.055;
             transformed.z += cos(uTime * 0.8 + phase * 1.4) * 0.05;
             transformed.y += sin(uTime * 0.6 + phase * 0.7) * 0.02;
           #endif`,
        );
    };

    leafPlacements.forEach((placement, index) => {
      leafMesh.setMatrixAt(index, placement.matrix);
      leafMesh.setColorAt(index, placement.color);
    });
    leafMesh.instanceMatrix.needsUpdate = true;
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
    scene.add(leafMesh);

    // --- fallen leaves -------------------------------------------------------
    const YELLOW = ["#fde68a", "#fbbf24", "#f59e0b", "#eab308", "#facc15", "#fcd34d"].map(
      (hex) => new THREE.Color(hex),
    );

    const groundCount = 900;
    const groundLeaves = new THREE.InstancedMesh(
      leafGeometry(),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.34,
        metalness: 0.28,
        side: THREE.DoubleSide,
        flatShading: true,
        emissive: 0x2a1a00,
        emissiveIntensity: 0.5,
      }),
      groundCount,
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < groundCount; i += 1) {
      const angle = random() * Math.PI * 2;
      const radius = 1.5 + Math.pow(random(), 0.55) * 14.5;
      dummy.position.set(
        Math.cos(angle) * radius,
        0.035 + random() * 0.02,
        Math.sin(angle) * radius * 0.92,
      );
      dummy.rotation.set(-Math.PI / 2 + (random() - 0.5) * 0.35, random() * Math.PI * 2, 0);
      const scale = 0.24 + random() * 0.26;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      groundLeaves.setMatrixAt(i, dummy.matrix);
      groundLeaves.setColorAt(i, YELLOW[Math.floor(random() * YELLOW.length)].clone());
    }
    groundLeaves.instanceMatrix.needsUpdate = true;
    if (groundLeaves.instanceColor) groundLeaves.instanceColor.needsUpdate = true;
    scene.add(groundLeaves);

    // warm pool of light on the ground, so the fallen leaves read as gold
    const leafGlow = new THREE.Mesh(
      new THREE.CircleGeometry(13.5, 48),
      new THREE.MeshBasicMaterial({
        map: radialTexture("rgba(250,204,21,0.30)", "rgba(250,204,21,0)"),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    leafGlow.rotation.x = -Math.PI / 2;
    leafGlow.position.y = 0.012;
    scene.add(leafGlow);

    // --- leaves on the wind --------------------------------------------------
    const windCount = 54;
    const windLeaves = new THREE.InstancedMesh(
      leafGeometry(),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3,
        metalness: 0.3,
        side: THREE.DoubleSide,
        flatShading: true,
        emissive: 0x3a2400,
        emissiveIntensity: 0.45,
      }),
      windCount,
    );
    windLeaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const windState = Array.from({ length: windCount }, () => ({
      phase: random() * Math.PI * 2,
      speed: 0.12 + random() * 0.22,
      radius: 3.2 + random() * 5.4,
      baseY: 0.4 + random() * 9.5,
      offset: random() * Math.PI * 2,
      scale: 0.22 + random() * 0.22,
      tilt: random() * Math.PI,
    }));
    for (let i = 0; i < windCount; i += 1) {
      windLeaves.setColorAt(i, YELLOW[Math.floor(random() * YELLOW.length)].clone());
      windLeaves.setMatrixAt(i, new THREE.Matrix4());
    }
    if (windLeaves.instanceColor) windLeaves.instanceColor.needsUpdate = true;
    scene.add(windLeaves);

    const haze = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: radialTexture("rgba(52,211,153,0.42)", "rgba(52,211,153,0)"),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    haze.position.set(0, 10.5, -6);
    haze.scale.set(30, 26, 1);
    scene.add(haze);

    const moteGeometry = new THREE.BufferGeometry();
    const motePositions = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i += 1) {
      motePositions[i * 3] = (random() - 0.5) * 22;
      motePositions[i * 3 + 1] = random() * 16;
      motePositions[i * 3 + 2] = (random() - 0.5) * 18;
    }
    moteGeometry.setAttribute("position", new THREE.BufferAttribute(motePositions, 3));
    const motes = new THREE.Points(
      moteGeometry,
      new THREE.PointsMaterial({
        color: 0xd9f99d,
        size: 0.09,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    scene.add(motes);

    // --- interaction ---------------------------------------------------------
    let dragging = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      moved = 0;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      desiredRef.current.azimuth += dx * 0.006;
      desiredRef.current.polar = THREE.MathUtils.clamp(desiredRef.current.polar - dy * 0.004, 0.6, 1.95);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      canvas.releasePointerCapture(event.pointerId);
      if (moved < 6) reset();
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      desiredRef.current.distance = THREE.MathUtils.clamp(
        desiredRef.current.distance * (1 + event.deltaY * 0.0012),
        7,
        52,
      );
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    let fitScale = 1;
    const resize = () => {
      const width = wrap.clientWidth;
      const height = wrap.clientHeight;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      // A portrait canvas sees far less width, so pull the camera back.
      fitScale = camera.aspect < 1 ? Math.min(1.7, 0.75 / camera.aspect) : 1;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    // --- loop ----------------------------------------------------------------
    let previous = performance.now();
    let frame = 0;
    const projected = new THREE.Vector3();

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      timeUniform.value += delta;

      const view = viewRef.current;
      const desired = desiredRef.current;
      const ease = reduceMotion ? 1 : 1 - Math.pow(0.001, delta);
      view.azimuth += (desired.azimuth - view.azimuth) * ease;
      view.polar += (desired.polar - view.polar) * ease;
      view.distance += (desired.distance - view.distance) * ease;
      view.target.lerp(desired.target, ease);

      const sinPolar = Math.sin(view.polar);
      const distance = view.distance * fitScale;
      camera.position.set(
        view.target.x + distance * sinPolar * Math.sin(view.azimuth),
        view.target.y + distance * Math.cos(view.polar),
        view.target.z + distance * sinPolar * Math.cos(view.azimuth),
      );
      camera.lookAt(view.target);

      motes.rotation.y += delta * 0.02;

      for (let i = 0; i < windCount; i += 1) {
        const state = windState[i];
        state.phase += delta * state.speed;
        dummy.position.set(
          Math.cos(state.phase) * state.radius,
          state.baseY + Math.sin(state.phase * 1.6 + state.offset) * 0.55,
          Math.sin(state.phase * 0.82 + state.offset) * state.radius * 0.8,
        );
        dummy.rotation.set(
          state.tilt + Math.sin(state.phase * 1.9) * 0.6,
          state.phase * 1.7 + state.offset,
          Math.cos(state.phase * 1.2) * 0.8,
        );
        dummy.scale.setScalar(state.scale);
        dummy.updateMatrix();
        windLeaves.setMatrixAt(i, dummy.matrix);
      }
      windLeaves.instanceMatrix.needsUpdate = true;

      const width = wrap.clientWidth;
      const height = wrap.clientHeight;

      anchors.forEach((anchor) => {
        const element = markerRefs.current.get(anchor.id);
        if (!element) return;
        projected.copy(anchor.position).project(camera);
        const visible =
          projected.z < 1 && (anchor.kind === "chapter" || selectionRef.current.chapterId !== null);
        const x = (projected.x * 0.5 + 0.5) * width;
        const y = (-projected.y * 0.5 + 0.5) * height;
        element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        element.style.opacity = visible ? "1" : "0";
        element.style.pointerEvents = visible ? "auto" : "none";
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else if (material) material.dispose();
      });
      ground.geometry.dispose();
      renderer.dispose();
    };
  }, [reset]);

  const setMarkerRef = useCallback(
    (id: string) => (element: HTMLButtonElement | null) => {
      if (element) markerRefs.current.set(id, element);
      else markerRefs.current.delete(id);
    },
    [],
  );

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#04120b] text-emerald-50">
      <div ref={wrapRef} className="relative h-full w-full">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

        <div className="pointer-events-none absolute inset-0">
          {CHAPTERS.map((chapter) => (
            <div key={chapter.id}>
              <button
                ref={setMarkerRef(chapter.id)}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setChapterId(chapter.id);
                  setStoryId(null);
                }}
                aria-label={`${chapter.label} · ${chapter.year}`}
                className="pointer-events-auto absolute left-0 top-0 flex h-11 w-11 items-center justify-center transition-opacity duration-300"
              >
                <span
                  className="h-3.5 w-3.5 rounded-full"
                  style={{
                    backgroundColor: chapter.color,
                    boxShadow: `0 0 0 6px ${chapter.color}22, 0 0 16px ${chapter.color}bb`,
                  }}
                />
                <span
                  className="pointer-events-none absolute left-full ml-2.5 whitespace-nowrap rounded-md bg-[#03110b]/80 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-emerald-50 backdrop-blur-[2px] sm:text-[13px]"
                  style={{ textShadow: "0 1px 8px rgba(2,16,10,0.9)" }}
                >
                  {chapter.label}
                  <span className="ml-1.5 hidden text-[10px] font-normal text-emerald-200/60 sm:inline">
                    {chapter.year}
                  </span>
                </span>
              </button>

              {chapter.stories.map((story) => (
                <button
                  key={story.id}
                  ref={setMarkerRef(`${chapter.id}:${story.id}`)}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (chapterId !== chapter.id) {
                      setChapterId(chapter.id);
                      return;
                    }
                    setStoryId(story.id);
                  }}
                  aria-label={story.title}
                  className="pointer-events-auto absolute left-0 top-0 flex h-8 w-8 items-center justify-center"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-2 ring-[#04120b]"
                    style={{
                      backgroundColor: chapter.color,
                      boxShadow:
                        chapterId === chapter.id
                          ? `0 0 0 3px ${chapter.color}44, 0 0 14px ${chapter.color}`
                          : "0 0 6px rgba(0,0,0,0.8)",
                      opacity: chapterId === chapter.id ? 1 : 0.5,
                    }}
                  />
                </button>
              ))}
            </div>
          ))}
        </div>

        {activeChapter && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center sm:inset-x-auto sm:right-6 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2">
            <aside
              onClick={(event) => event.stopPropagation()}
              className="pointer-events-auto w-full max-w-[340px] rounded-2xl border border-emerald-300/20 bg-[#04160e]/92 p-4 shadow-2xl shadow-black/60 backdrop-blur-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: activeChapter.color }}
                  >
                    {activeStory ? `${activeChapter.label} · ${activeChapter.year}` : activeChapter.year}
                  </p>
                  <h2 className="mt-1 text-base font-bold leading-snug text-emerald-50">
                    {activeStory ? activeStory.title : activeChapter.label}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => (activeStory ? setStoryId(null) : reset())}
                  aria-label="关闭"
                  className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-100/70 transition hover:bg-emerald-400/20 hover:text-emerald-50"
                >
                  ✕
                </button>
              </div>

              <p className="mt-2 text-[12px] leading-relaxed text-emerald-100/75">
                {activeStory ? activeStory.body : activeChapter.summary}
              </p>

              {(activeStory || activeChapter.stories.length > 0) && (
                <p className="mt-2 text-[10px] tracking-wide text-emerald-200/50">
                  {(activeStory ? activeStory.tags : activeChapter.stories.map((item) => item.title))
                    .map((tag) => (activeStory ? `#${tag}` : tag))
                    .join("  ")}
                </p>
              )}

              <div
                className={`mt-3 flex flex-wrap gap-1.5 border-t border-emerald-300/10 pt-2.5 ${
                  activeChapter.stories.length === 0 ? "hidden" : ""
                }`}
              >
                {activeChapter.stories.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStoryId(item.id)}
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] transition ${
                      activeStory?.id === item.id
                        ? "border-emerald-300/50 bg-emerald-400/20 text-emerald-50"
                        : "border-emerald-300/15 bg-emerald-400/5 text-emerald-100/60 hover:bg-emerald-400/12"
                    }`}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
