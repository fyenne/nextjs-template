"use client";

import React, { useEffect, useRef, useState } from "react";
import AsciiCube from "@/components/ascii/AsciiCube";
import * as THREE from "three";
import { AutumnTransition } from "@/lib/scene/autumn";
import { TREE_TRUNK_RADIUS, stepDog, type DogMotion } from "@/lib/scene/dog-motion";
import { LAPS_TO_UNLOCK } from "@/lib/scene/lap-tracker";
import { createPuppy, easeTongue } from "@/lib/scene/puppy";
import { SceneStages } from "@/lib/scene/stages";
import { VisitorSession } from "@/lib/scene/visitor";
import { createCampfire } from "@/lib/scene/campfire";
import {
  createNightSky,
  NIGHT_GREETING_HOLD_MS,
  type NightSky,
} from "@/lib/scene/night-sky";
import { BLACK_HOLE_LOOKS, BlackHoleEffect } from "@/lib/scene/black-hole";
import { WinterTransition } from "@/lib/scene/winter";
import { wheelToFactor, zoomAboutAnchor } from "@/lib/scene/zoom";

// A procedural Chinese pine: dark fluted bark, wind-swept limbs, and sparse
// needle pads in a quiet mountain atmosphere. The black-hole disk is
// NASA-inspired and procedurally rendered.

const FOLIAGE_COLORS = ["#203a30", "#2c4938", "#3b543e", "#4c6047", "#5b6b50", "#29443a"];

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

type TubeOptions = {
  segments?: number;
  radial?: number;
  wrinkle?: number;
  flare?: number;
  moss?: number;
};

/** Tapered, irregular tube with lengthwise bark ridges and UVs. */
function taperedTube(
  curve: THREE.Curve<THREE.Vector3>,
  radiusStart: number,
  radiusEnd: number,
  { segments = 32, radial = 10, wrinkle = 0.14, flare = 0, moss = 0 }: TubeOptions = {},
) {
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const frames = curve.computeFrenetFrames(segments, false);
  const lengthScale = Math.max(1, curve.getLength() / 2.8);
  const stride = radial + 1;

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const point = curve.getPointAt(t);
    const normal = frames.normals[Math.min(i, frames.normals.length - 1)];
    const binormal = frames.binormals[Math.min(i, frames.binormals.length - 1)];
    const baseRadius = THREE.MathUtils.lerp(radiusStart, radiusEnd, Math.pow(t, 0.86));

    for (let j = 0; j <= radial; j += 1) {
      const u = j / radial;
      const angle = u * Math.PI * 2;
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);
      const flutes = Math.cos(angle * 7 + t * 3.1) * 0.62 + Math.sin(angle * 13 - t * 6.2) * 0.38;
      const wobble = Math.sin(t * 43 + angle * 2.7) * 0.5 + Math.cos(t * 79 - angle * 4.1) * 0.5;
      const radius =
        baseRadius *
        (1 + wrinkle * (flutes * 0.78 + wobble * 0.42)) *
        (1 + flare * Math.exp(-t * 13));

      positions.push(
        point.x + (normal.x * nx + binormal.x * ny) * radius,
        point.y + (normal.y * nx + binormal.y * ny) * radius,
        point.z + (normal.z * nx + binormal.z * ny) * radius,
      );

      const patch = Math.max(0, Math.sin(angle * 3.2 + t * 15) * Math.cos(angle * 5.1 - t * 9));
      const mossAmount = moss * patch * Math.max(0.12, 1 - t * 1.45);
      const shade = 0.88 + 0.12 * Math.sin(angle * 4 + t * 21);
      colors.push(
        shade * (1 - mossAmount) + 0.46 * mossAmount,
        shade * (1 - mossAmount) + 0.65 * mossAmount,
        shade * (1 - mossAmount) + 0.35 * mossAmount,
      );
      uvs.push(u, t * lengthScale);
    }
  }

  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * stride + j;
      const b = a + 1;
      const c = (i + 1) * stride + j;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A small bottlebrush of triangular pine needles, instanced by the thousand. */
function pineSprigGeometry() {
  const random = makeRandom(9147);
  const positions: number[] = [];

  for (let i = 0; i < 13; i += 1) {
    const angle = (i / 13) * Math.PI * 2 + random() * 0.25;
    const base = new THREE.Vector3((i % 4) * 0.055, 0, 0);
    const tip = new THREE.Vector3(
      0.62 + random() * 0.42,
      Math.cos(angle) * (0.2 + random() * 0.24),
      Math.sin(angle) * (0.2 + random() * 0.24),
    );
    const direction = tip.clone().sub(base).normalize();
    const across = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0));
    if (across.lengthSq() < 0.001) across.set(0, 0, 1);
    across.normalize().multiplyScalar(0.025 + random() * 0.025);
    const left = base.clone().sub(across);
    const right = base.clone().add(across);
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z, tip.x, tip.y, tip.z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function grassTuftGeometry() {
  const random = makeRandom(7319);
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2 + random() * 0.55;
    const forward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const across = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const base = forward.clone().multiplyScalar(random() * 0.1);
    const height = 0.45 + random() * 0.55;
    const bend = 0.12 + random() * 0.28;
    const width = 0.018 + random() * 0.025;
    const middle = base.clone().addScaledVector(forward, bend * 0.35).add(new THREE.Vector3(0, height * 0.58, 0));
    const tip = base.clone().addScaledVector(forward, bend).add(new THREE.Vector3(0, height, 0));
    const baseLeft = base.clone().addScaledVector(across, -width);
    const baseRight = base.clone().addScaledVector(across, width);
    const middleLeft = middle.clone().addScaledVector(across, -width * 0.58);
    const middleRight = middle.clone().addScaledVector(across, width * 0.58);
    const offset = positions.length / 3;

    [baseLeft, baseRight, middleLeft, middleRight, tip].forEach((point) => {
      positions.push(point.x, point.y, point.z);
    });
    indices.push(offset, offset + 1, offset + 2, offset + 1, offset + 3, offset + 2, offset + 2, offset + 3, offset + 4);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
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

function makeBarkTexture(random: () => number) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const ridge = Math.sin(x * 0.16 + Math.sin(y * 0.025) * 2.8) * 9;
      const grain = (random() - 0.5) * 24;
      image.data[index] = 72 + ridge + grain;
      image.data[index + 1] = 66 + ridge * 0.8 + grain;
      image.data[index + 2] = 55 + ridge * 0.55 + grain * 0.8;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  for (let i = 0; i < 95; i += 1) {
    let x = random() * size;
    const startY = random() * size - 80;
    const length = 100 + random() * 390;
    ctx.beginPath();
    ctx.moveTo(x, startY);
    for (let y = 0; y <= length; y += 18) {
      x += (random() - 0.5) * 8;
      ctx.lineTo(x, startY + y);
    }
    ctx.strokeStyle = `rgba(18, 21, 18, ${0.25 + random() * 0.42})`;
    ctx.lineWidth = 0.7 + random() * 2.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + 2, startY);
    ctx.lineTo(x + 2 + (random() - 0.5) * 8, startY + length * 0.75);
    ctx.strokeStyle = "rgba(176, 164, 136, 0.16)";
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  for (let i = 0; i < 80; i += 1) {
    const x = random() * size;
    const y = random() * size;
    ctx.beginPath();
    ctx.moveTo(x - 3 - random() * 8, y);
    ctx.lineTo(x + 3 + random() * 8, y + (random() - 0.5) * 4);
    ctx.strokeStyle = "rgba(20, 23, 19, 0.38)";
    ctx.lineWidth = 0.6 + random();
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function makeGroundTexture(random: () => number) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const patch = Math.sin(x * 0.09) * Math.cos(y * 0.075) * 8;
      const grain = (random() - 0.5) * 22;
      image.data[index] = 39 + patch + grain * 0.6;
      image.data[index + 1] = 49 + patch + grain;
      image.data[index + 2] = 39 + patch * 0.6 + grain * 0.55;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  for (let i = 0; i < 500; i += 1) {
    const x = random() * size;
    const y = random() * size;
    ctx.fillStyle = random() > 0.45 ? "rgba(94,105,76,0.22)" : "rgba(13,22,18,0.28)";
    ctx.fillRect(x, y, 0.5 + random() * 1.5, 0.5 + random() * 2.5);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(20, 20);
  texture.anisotropy = 4;
  return texture;
}

function makeBeamTexture() {
  const width = 128;
  const height = 256;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const image = ctx.createImageData(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const horizontal = Math.pow(Math.sin((x / width) * Math.PI), 2.4);
        const vertical = Math.sin((y / height) * Math.PI);
        image.data[index] = 255;
        image.data[index + 1] = 250;
        image.data[index + 2] = 226;
        image.data[index + 3] = horizontal * vertical * 150;
      }
    }
    ctx.putImageData(image, 0, 0);
  }
  return new THREE.CanvasTexture(canvas);
}

const GALACTIC_FONT = "700 108px Galactic, Kronthul, sans-serif";
const INTRO_FONT = "600 46px Georgia, 'Palatino Linotype', Palatino, serif";

type SpeechMode = "glyphs" | "intro";

/**
 * Winter only. One sentence, revealed a word at a time.
 * The space in "hello !" is intentional, so the mark arrives as its own pop.
 */
const WINTER_GREETING = "hello ! welcome to siming yan's inner garden, lets start our journey to know more of me";
const WINTER_WORDS = WINTER_GREETING.split(" ");
const WORD_POP_MS = 420;

/** Meaningless Standard Galactic glyphs, 2–12 letters. */
function nextMonkSnippet(previous = "") {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const length = 2 + Math.floor(Math.random() * 11);
    let snippet = "";
    for (let i = 0; i < length; i += 1) {
      snippet += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    if (snippet !== previous) return snippet;
  }
  return "QX";
}

function wrapLines(measure: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (measure.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [text];
}

function makeBubbleTexture(text: string, mode: SpeechMode = "glyphs") {
  const intro = mode === "intro";
  const measure = document.createElement("canvas").getContext("2d");
  const font = intro ? INTRO_FONT : GALACTIC_FONT;
  let lines = [text];
  let textWidth = text.length * (intro ? 26 : 78);
  if (measure) {
    measure.font = font;
    if (intro) lines = wrapLines(measure, text, 780);
    textWidth = Math.ceil(Math.max(...lines.map((line) => measure.measureText(line).width), 1));
  }
  const padX = intro ? 44 : 56;
  const padY = intro ? 28 : 36;
  const tailH = 42;
  const tailW = 36;
  const radius = 40;
  const lineH = intro ? 58 : 108;
  const bodyW = Math.max(textWidth + padX * 2, intro ? 180 : 280);
  const bodyH = intro ? lines.length * lineH + padY * 2 : 108 + padY * 2;
  const cssW = bodyW;
  const cssH = bodyH + tailH;
  const ratio = 2;
  const canvas = document.createElement("canvas");
  canvas.width = cssW * ratio;
  canvas.height = cssH * ratio;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(ratio, ratio);
    const x = 2;
    const y = 2;
    const w = cssW - 4;
    const h = bodyH - 4;
    const cx = x + w / 2;

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(cx + tailW / 2, y + h);
    ctx.lineTo(cx, y + h + tailH - 3);
    ctx.lineTo(cx - tailW / 2, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fillStyle = "rgba(246, 242, 230, 0.96)";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(60, 52, 44, 0.55)";
    ctx.lineJoin = "round";
    ctx.stroke();

    ctx.fillStyle = "#14110d";
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (intro) {
      lines.forEach((line, index) => {
        ctx.fillText(line, cssW / 2, padY + lineH * (index + 0.5) + 2);
      });
    } else {
      ctx.fillText(text, cssW / 2, (bodyH - 2) / 2 + 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return { texture, width: cssW, height: cssH, lines: lines.length };
}

function terrainHeight(x: number, z: number) {
  const distance = Math.sqrt(x * x + z * z);
  const fade = THREE.MathUtils.smoothstep(distance, 2, 10);
  return -0.1 + fade * (Math.sin(x * 0.31) * 0.11 + Math.cos(z * 0.27) * 0.09 + Math.sin((x + z) * 0.17) * 0.07);
}

function createMonk() {
  const monk = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({
    color: 0xf0bd94,
    roughness: 0.88,
    emissive: 0x4a2112,
    emissiveIntensity: 0.12,
  });
  const robe = new THREE.MeshStandardMaterial({
    color: 0xb85c28,
    roughness: 0.94,
    emissive: 0x341006,
    emissiveIntensity: 0.18,
  });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0xcf7434, roughness: 0.94 });
  const darkRobe = new THREE.MeshStandardMaterial({ color: 0x60372b, roughness: 0.96 });
  const face = new THREE.MeshStandardMaterial({ color: 0x42291f, roughness: 1 });
  const blush = new THREE.MeshStandardMaterial({ color: 0xe59a84, roughness: 1 });
  const sphere = new THREE.SphereGeometry(1, 32, 20);

  const addPart = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
    scale: [number, number, number] = [1, 1, 1],
    rotation: [number, number, number] = [0, 0, 0],
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    monk.add(mesh);
    return mesh;
  };

  const robeProfile = [
    new THREE.Vector2(0.28, 0.1),
    new THREE.Vector2(0.48, 0.16),
    new THREE.Vector2(0.5, 0.35),
    new THREE.Vector2(0.43, 0.75),
    new THREE.Vector2(0.35, 1.15),
    new THREE.Vector2(0.29, 1.42),
    new THREE.Vector2(0.18, 1.52),
  ];
  addPart(new THREE.LatheGeometry(robeProfile, 40), robe, [0, 0, 0]);
  addPart(new THREE.TorusGeometry(0.46, 0.035, 8, 40), darkRobe, [0, 0.18, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  addPart(new THREE.TorusGeometry(0.39, 0.045, 8, 40), darkRobe, [0, 0.82, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);

  addPart(
    new THREE.TubeGeometry(
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-0.24, 1.43, 0.32),
        new THREE.Vector3(0.02, 1.12, 0.48),
        new THREE.Vector3(0.25, 0.82, 0.4),
      ),
      20,
      0.055,
      8,
      false,
    ),
    darkRobe,
    [0, 0, 0],
  );

  addPart(sphere, sleeve, [-0.38, 1.17, 0.14], [0.34, 0.55, 0.3], [0, 0, -0.38]);
  addPart(sphere, sleeve, [0.38, 1.17, 0.14], [0.34, 0.55, 0.3], [0, 0, 0.38]);

  const palm = new THREE.CapsuleGeometry(0.065, 0.28, 4, 10);
  addPart(palm, skin, [-0.065, 1.35, 0.53], [1, 1, 1], [0, 0, -0.1]);
  addPart(palm, skin, [0.065, 1.35, 0.53], [1, 1, 1], [0, 0, 0.1]);
  addPart(new THREE.CylinderGeometry(0.13, 0.15, 0.2, 20), skin, [0, 1.53, 0.02]);

  addPart(sphere, darkRobe, [-0.2, 0.13, 0.12], [0.16, 0.09, 0.25]);
  addPart(sphere, darkRobe, [0.2, 0.13, 0.12], [0.16, 0.09, 0.25]);
  addPart(sphere, skin, [0, 1.98, 0.04], [0.58, 0.6, 0.55]);
  addPart(sphere, skin, [-0.565, 1.97, 0.03], [0.13, 0.17, 0.11]);
  addPart(sphere, skin, [0.565, 1.97, 0.03], [0.13, 0.17, 0.11]);
  addPart(sphere, blush, [-0.37, 1.87, 0.49], [0.105, 0.065, 0.028]);
  addPart(sphere, blush, [0.37, 1.87, 0.49], [0.105, 0.065, 0.028]);

  const addFaceLine = (curve: THREE.QuadraticBezierCurve3, radius = 0.011) => {
    const line = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, radius, 6, false), face);
    monk.add(line);
  };
  addFaceLine(
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.34, 2.05, 0.5),
      new THREE.Vector3(-0.225, 2.0, 0.565),
      new THREE.Vector3(-0.11, 2.05, 0.585),
    ),
  );
  addFaceLine(
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0.11, 2.05, 0.585),
      new THREE.Vector3(0.225, 2.0, 0.565),
      new THREE.Vector3(0.34, 2.05, 0.5),
    ),
  );
  addFaceLine(
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.09, 1.82, 0.575),
      new THREE.Vector3(0, 1.765, 0.565),
      new THREE.Vector3(0.09, 1.82, 0.575),
    ),
    0.01,
  );

  const halo = addPart(
    new THREE.TorusGeometry(0.79, 0.012, 8, 80),
    new THREE.MeshBasicMaterial({ color: 0xffd79c, transparent: true, opacity: 0.32, depthWrite: false }),
    [0, 1.98, -0.16],
  );
  halo.castShadow = false;
  halo.receiveShadow = false;

  return monk;
}

function mountainGeometry(seed: number, radius: number, height: number) {
  const random = makeRandom(seed);
  const controlCount = 28;
  const controls = Array.from({ length: controlCount }, () => 0.4 + random() * 0.6);
  const segments = 168;
  const positions: number[] = [];
  const indices: number[] = [];

  // A continuous cylindrical ridgeline surrounds the tree in every direction.
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const controlPosition = (i / segments) * controlCount;
    const controlIndex = Math.floor(controlPosition) % controlCount;
    const blend = controlPosition - Math.floor(controlPosition);
    const ridgeBase = THREE.MathUtils.lerp(
      controls[controlIndex],
      controls[(controlIndex + 1) % controlCount],
      blend,
    );
    const ridge = height * (0.28 + ridgeBase * 0.72) + Math.sin(angle * 6 + seed) * height * 0.06;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    positions.push(x, -8, z, x, ridge, z);
  }

  for (let i = 0; i < segments; i += 1) {
    const bottom = i * 2;
    const top = bottom + 1;
    const nextBottom = bottom + 2;
    const nextTop = bottom + 3;
    indices.push(bottom, nextBottom, top, top, nextBottom, nextTop);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

export default function Home() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dogCoordsRef = useRef<HTMLParagraphElement | null>(null);
  const constellationLabelRef = useRef<HTMLDivElement | null>(null);
  const vignetteRef = useRef<HTMLDivElement | null>(null);
  const [showAscii, setShowAscii] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const viewRef = useRef({ azimuth: 0.08, polar: 1.36, distance: 35, target: new THREE.Vector3(-1.2, 8.1, 0) });
  const desiredRef = useRef({ azimuth: 0.08, polar: 1.36, distance: 35, target: new THREE.Vector3(-1.2, 8.1, 0) });

  useEffect(() => {
    const music = musicRef.current;
    if (!music) return;
    music.volume = 0.6;
    music.preload = "auto";
    let playing = false;
    const start = () => {
      if (playing || music.muted) return;
      const pending = music.play();
      if (!pending) {
        playing = true;
        return;
      }
      void pending.then(
        () => {
          playing = true;
        },
        () => {
          playing = false;
        },
      );
    };
    start();
    music.addEventListener("canplay", start);
    const unlock = () => start();
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      music.removeEventListener("canplay", start);
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const dogPreview = window.location.hash;
    if (dogPreview.startsWith("#dog") || dogPreview.startsWith("#pair")) {
      const pair = dogPreview.startsWith("#pair");
      const aim = viewRef.current.target;
      if (pair) aim.set(1.9, 1.15, 5);
      else aim.set(1.15, 0.65, 6.4);
      desiredRef.current.target.copy(aim);
      const pose = pair
        ? { azimuth: 0.35, polar: 1.3, distance: 9.5 }
        : dogPreview.includes("high")
          ? { azimuth: -2.5, polar: 0.95, distance: 5.2 }
          : dogPreview.includes("front")
          ? { azimuth: 0.4, polar: 1.22, distance: 4.6 }
          : dogPreview.includes("rear")
            ? { azimuth: 0.4 + Math.PI, polar: 1.28, distance: 5.2 }
            : { azimuth: -1.15, polar: 1.18, distance: 4.8 };
      viewRef.current.azimuth = pose.azimuth;
      viewRef.current.polar = pose.polar;
      viewRef.current.distance = pose.distance;
      desiredRef.current.azimuth = pose.azimuth;
      desiredRef.current.polar = pose.polar;
      desiredRef.current.distance = pose.distance;
    }

    // Where a double-click returns to: the pose the page opened with.
    const home = {
      azimuth: desiredRef.current.azimuth,
      polar: desiredRef.current.polar,
      distance: desiredRef.current.distance,
      target: desiredRef.current.target.clone(),
    };

    const debugParams = new URLSearchParams(window.location.search);
    const debugMonkFlight = debugParams.get("debug") === "monk-flight";
    const debugSwallow = debugParams.get("debug") === "swallow";
    const debugScene = debugMonkFlight || debugSwallow;
    const showHud = debugScene || dogPreview.startsWith("#dog") || dogPreview.startsWith("#pair");
    if (dogCoordsRef.current) dogCoordsRef.current.hidden = !showHud;
    const blackHoleLook =
      BLACK_HOLE_LOOKS[Math.min(BLACK_HOLE_LOOKS.length - 1, Math.max(0, (Number(debugParams.get("look")) || 2) - 1))];
    const debugStartMs = debugSwallow ? Math.max(0, Number(debugParams.get("t")) || 0) : 0;
    const reduceMotion = !debugScene && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const random = makeRandom(20261104);
    const textures: THREE.Texture[] = [];

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor("#17292d", 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2("#243b3e", 0.016);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);

    const hemisphere = new THREE.HemisphereLight(0xb9d0cd, 0x101912, 1.25);
    const ambient = new THREE.AmbientLight(0x54706a, 0.34);
    scene.add(hemisphere, ambient);

    const key = new THREE.DirectionalLight(0xffe1b3, 3.1);
    key.position.set(-11, 24, 10);
    key.target.position.set(0, 7, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -18;
    key.shadow.camera.right = 18;
    key.shadow.camera.top = 24;
    key.shadow.camera.bottom = -8;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 70;
    key.shadow.bias = -0.00035;
    scene.add(key, key.target);

    const rim = new THREE.DirectionalLight(0xa9d2cd, 2.15);
    rim.position.set(9, 17, -13);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0x88aaa5, 0.7);
    fill.position.set(10, 9, 20);
    scene.add(fill);

    // Concentric shan-shui ridgelines remain present through a complete orbit.
    const mountainMaterials: THREE.MeshBasicMaterial[] = [];
    [
      { seed: 31, radius: 108, height: 30, y: -3, color: "#425d61", opacity: 0.24 },
      { seed: 47, radius: 86, height: 22, y: -2, color: "#30494d", opacity: 0.32 },
      { seed: 63, radius: 68, height: 15, y: -1, color: "#223a3d", opacity: 0.38 },
    ].forEach((layer) => {
      const material = new THREE.MeshBasicMaterial({
        color: layer.color,
        transparent: true,
        opacity: layer.opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      });
      mountainMaterials.push(material);
      const mountain = new THREE.Mesh(mountainGeometry(layer.seed, layer.radius, layer.height), material);
      mountain.position.y = layer.y;
      scene.add(mountain);
    });

    // Uneven mossy ground, with the immediate root area kept nearly level.
    const groundTexture = makeGroundTexture(random);
    groundTexture.repeat.set(42, 42);
    textures.push(groundTexture);
    const groundGeometry = new THREE.PlaneGeometry(240, 240, 96, 96);
    groundGeometry.rotateX(-Math.PI / 2);
    const groundPositions = groundGeometry.getAttribute("position");
    for (let i = 0; i < groundPositions.count; i += 1) {
      groundPositions.setY(i, terrainHeight(groundPositions.getX(i), groundPositions.getZ(i)));
    }
    groundGeometry.computeVertexNormals();
    const groundMaterial = new THREE.MeshStandardMaterial({
      map: groundTexture,
      color: 0x879184,
      roughness: 1,
      metalness: 0,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.receiveShadow = true;
    scene.add(ground);

    const contactTexture = radialTexture("rgba(0,0,0,0.72)", "rgba(0,0,0,0)");
    textures.push(contactTexture);
    const contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(7.5, 64),
      new THREE.MeshBasicMaterial({ map: contactTexture, transparent: true, depthWrite: false }),
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.015;
    scene.add(contactShadow);

    const barkTexture = makeBarkTexture(random);
    textures.push(barkTexture);
    const barkMaterial = new THREE.MeshStandardMaterial({
      map: barkTexture,
      bumpMap: barkTexture,
      bumpScale: 0.13,
      color: 0xa8a091,
      roughness: 0.97,
      metalness: 0,
      vertexColors: true,
    });
    const tree = new THREE.Group();
    scene.add(tree);

    const limbs: THREE.Mesh[] = [];
    const addTube = (
      curve: THREE.Curve<THREE.Vector3>,
      radiusStart: number,
      radiusEnd: number,
      options?: TubeOptions,
      kind: "trunk" | "root" | "branch" = "branch",
    ) => {
      const mesh = new THREE.Mesh(taperedTube(curve, radiusStart, radiusEnd, options), barkMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Winter snow walks these rings. The last radial vertex repeats the first.
      mesh.userData.tube = {
        segments: options?.segments ?? 32,
        radial: options?.radial ?? 10,
      };
      mesh.userData.kind = kind;
      if (kind === "branch") limbs.push(mesh);
      tree.add(mesh);
      return mesh;
    };
    // Twigs and forks are their own meshes. Cutting a limb takes the ones that grew on it.
    const offshoots = new Map<THREE.Mesh, THREE.Mesh[]>();
    const rememberOffshoot = (limb: THREE.Mesh, child: THREE.Mesh) => {
      const list = offshoots.get(limb);
      if (list) list.push(child);
      else offshoots.set(limb, [child]);
    };

    const trunkCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, 0.05, 0),
        new THREE.Vector3(-0.5, 1.3, 0.18),
        new THREE.Vector3(-0.78, 2.8, 0.28),
        new THREE.Vector3(-0.35, 4.4, 0.02),
        new THREE.Vector3(0.62, 6.1, -0.3),
        new THREE.Vector3(0.88, 7.8, -0.18),
        new THREE.Vector3(0.35, 9.4, 0.24),
        new THREE.Vector3(-0.62, 10.9, 0.34),
        new THREE.Vector3(-0.72, 12.2, 0.08),
        new THREE.Vector3(0.02, 13.6, -0.28),
        new THREE.Vector3(0.68, 15.0, -0.1),
        new THREE.Vector3(0.5, 16.5, 0.08),
        new THREE.Vector3(0.14, 17.35, 0.02),
      ],
      false,
      "catmullrom",
      0.48,
    );
    addTube(trunkCurve, 1.26, 0.12, { segments: 128, radial: 24, wrinkle: 0.23, flare: 0.72, moss: 0.82 }, "trunk");

    // Exposed roots radiate unevenly and disappear into the dark forest floor.
    for (let i = 0; i < 9; i += 1) {
      const angle = (i / 9) * Math.PI * 2 + (random() - 0.5) * 0.32;
      const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const length = 2.8 + random() * 2.5;
      const middle = direction.clone().multiplyScalar(length * 0.48);
      const tip = direction.clone().multiplyScalar(length);
      middle.y = terrainHeight(middle.x, middle.z) + 0.16;
      tip.y = terrainHeight(tip.x, tip.z) + 0.035;
      const rootCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(direction.x * 0.18, 0.42, direction.z * 0.18),
        direction.clone().multiplyScalar(0.95).setY(0.12),
        middle,
        tip,
      ]);
      addTube(rootCurve, 0.31 + random() * 0.14, 0.022, {
        segments: 32,
        radial: 10,
        wrinkle: 0.2,
        flare: 0.28,
        moss: 0.95,
      }, "root");
    }

    type Placement = { matrix: THREE.Matrix4; color: THREE.Color };
    const foliagePlacements: Placement[] = [];
    const foliagePalette = FOLIAGE_COLORS.map((hex) => new THREE.Color(hex));

    const addFoliagePad = (center: THREE.Vector3, direction: THREE.Vector3, radius: number, count: number) => {
      const flatDirection = direction.clone().setY(0).normalize();
      const side = new THREE.Vector3(-flatDirection.z, 0, flatDirection.x);
      const yaw = Math.atan2(-flatDirection.z, flatDirection.x);

      for (let i = 0; i < count; i += 1) {
        const angle = random() * Math.PI * 2;
        const distance = Math.sqrt(random());
        const position = center
          .clone()
          .addScaledVector(flatDirection, Math.cos(angle) * distance * radius * 1.28)
          .addScaledVector(side, Math.sin(angle) * distance * radius * 0.82);
        position.y += (random() + random() - 1) * radius * 0.28;

        const quaternion = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            (random() - 0.5) * 0.95,
            yaw + (random() - 0.5) * 1.5,
            (random() - 0.5) * 0.85,
          ),
        );
        const scale = 0.44 + random() * 0.46;
        foliagePlacements.push({
          matrix: new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(scale, scale, scale)),
          color: foliagePalette[Math.floor(random() * foliagePalette.length)].clone(),
        });
      }
    };

    type BranchShape = "sweep" | "hook" | "droop" | "rise" | "twist";
    type BranchSpec = {
      at: number;
      angle: number;
      length: number;
      lift: number;
      droop: number;
      radius: number;
      bend: number;
      shape?: BranchShape;
      density?: number;
      dead?: boolean;
    };

    const branchSpecs: BranchSpec[] = [
      { at: 0.32, angle: 258, length: 4.2, lift: 0.55, droop: -0.9, radius: 0.27, bend: 0.65, shape: "droop", density: 0.38 },
      { at: 0.38, angle: 30, length: 4.5, lift: 0.9, droop: -0.4, radius: 0.29, bend: -0.55, shape: "twist", density: 0.75 },
      { at: 0.43, angle: 167, length: 5.2, lift: 0.75, droop: -0.65, radius: 0.28, bend: 0.65, shape: "hook", density: 0.85 },
      { at: 0.49, angle: 82, length: 7.1, lift: 0.65, droop: -1.05, radius: 0.31, bend: 0.75, shape: "sweep", density: 1.0 },
      { at: 0.535, angle: 205, length: 4.4, lift: 0.6, droop: -0.45, radius: 0.25, bend: -0.6, shape: "twist", density: 1.05 },
      { at: 0.56, angle: 282, length: 5.7, lift: 0.85, droop: -0.5, radius: 0.27, bend: -0.7, shape: "rise", density: 1.05 },
      { at: 0.61, angle: 148, length: 4.8, lift: 0.55, droop: -0.6, radius: 0.24, bend: 0.5, shape: "droop", density: 1.1 },
      { at: 0.655, angle: 24, length: 4.1, lift: 0.7, droop: -0.35, radius: 0.22, bend: -0.55, shape: "twist", density: 1.15 },
      { at: 0.685, angle: 325, length: 3.8, lift: 0.45, droop: -0.8, radius: 0.2, bend: 0.45, shape: "droop", density: 1.2 },
      { at: 0.71, angle: 106, length: 5.6, lift: 0.65, droop: -0.65, radius: 0.23, bend: 0.55, shape: "hook", density: 1.25 },
      { at: 0.755, angle: 252, length: 4.7, lift: 0.65, droop: -0.5, radius: 0.2, bend: -0.5, shape: "sweep", density: 1.3 },
      { at: 0.79, angle: 155, length: 4.2, lift: 0.7, droop: -0.4, radius: 0.19, bend: 0.55, shape: "hook", density: 1.35 },
      { at: 0.82, angle: 73, length: 4.8, lift: 0.55, droop: -0.4, radius: 0.18, bend: 0.45, shape: "rise", density: 1.4 },
      { at: 0.855, angle: 25, length: 3.6, lift: 0.55, droop: -0.35, radius: 0.16, bend: -0.45, shape: "twist", density: 1.45 },
      { at: 0.88, angle: 278, length: 3.8, lift: 0.6, droop: -0.3, radius: 0.15, bend: -0.35, shape: "twist", density: 1.5 },
      { at: 0.91, angle: 190, length: 3.1, lift: 0.5, droop: -0.25, radius: 0.14, bend: 0.4, shape: "rise", density: 1.5 },
      { at: 0.93, angle: 111, length: 3.2, lift: 0.45, droop: -0.35, radius: 0.13, bend: 0.3, shape: "hook", density: 1.55 },
      { at: 0.965, angle: 248, length: 2.4, lift: 0.35, droop: -0.15, radius: 0.1, bend: -0.25, shape: "rise", density: 1.65 },
      { at: 0.21, angle: 232, length: 2.3, lift: 0.2, droop: -1.1, radius: 0.18, bend: 0.25, dead: true },
    ];

    branchSpecs.forEach((spec) => {
      const angle = THREE.MathUtils.degToRad(spec.angle);
      const direction = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
      const side = new THREE.Vector3(direction.z, 0, -direction.x);
      const start = trunkCurve.getPointAt(spec.at);
      const wind = new THREE.Vector3(spec.length * 0.1, 0, 0);
      const p1 = start
        .clone()
        .addScaledVector(direction, spec.length * 0.18)
        .addScaledVector(side, spec.bend * 0.18)
        .add(new THREE.Vector3(0, spec.lift * 0.8, 0));
      const p2 = start
        .clone()
        .addScaledVector(direction, spec.length * 0.46)
        .addScaledVector(side, spec.bend)
        .addScaledVector(wind, 0.25)
        .add(new THREE.Vector3(0, spec.lift, 0));
      const p3 = start
        .clone()
        .addScaledVector(direction, spec.length * 0.74)
        .addScaledVector(side, spec.bend * 0.55)
        .addScaledVector(wind, 0.65)
        .add(new THREE.Vector3(0, spec.lift * 0.5 + spec.droop * 0.3, 0));
      const tip = start
        .clone()
        .addScaledVector(direction, spec.length)
        .add(wind)
        .add(new THREE.Vector3(0, spec.droop, 0));

      // Distinct growth habits keep the limbs from reading as repeated copies.
      if (spec.shape === "hook") {
        p1.y = start.y + spec.lift * 0.3;
        p2.y = start.y + spec.lift * 1.35;
        p3.y = start.y + spec.lift * 0.9 + spec.droop * 0.15;
        p3.addScaledVector(side, -spec.bend * 1.15);
        tip.y = start.y + spec.droop * 0.25 + 0.42;
        tip.addScaledVector(side, -spec.bend * 0.35);
      } else if (spec.shape === "droop") {
        p1.y = start.y + spec.lift * 0.3;
        p2.y = start.y + spec.lift * 0.45;
        p3.y = start.y + spec.droop * 0.65;
        tip.y = start.y + spec.droop * 1.35;
        p3.addScaledVector(side, spec.bend * 0.45);
      } else if (spec.shape === "rise") {
        p1.y = start.y + spec.lift * 0.75;
        p2.y = start.y + spec.lift * 1.4;
        p3.y = start.y + spec.lift * 1.1 + spec.droop * 0.1;
        tip.y = start.y + spec.droop * 0.15 + 0.45;
      } else if (spec.shape === "twist") {
        p1.addScaledVector(side, -spec.bend * 1.2);
        p2.addScaledVector(side, spec.bend * 0.7);
        p2.y += 0.25;
        p3.addScaledVector(side, -spec.bend * 1.1);
        p3.y -= 0.15;
        tip.addScaledVector(side, spec.bend * 0.65);
      }

      const curve = new THREE.CatmullRomCurve3([start, p1, p2, p3, tip], false, "catmullrom", 0.45);
      const limb = addTube(curve, spec.radius, spec.dead ? 0.012 : 0.022, {
        segments: spec.dead ? 28 : 48,
        radial: 11,
        wrinkle: 0.19,
        flare: 0.2,
        moss: 0.48,
      });

      if (spec.dead) {
        const forkStart = curve.getPointAt(0.58);
        const forkTip = forkStart.clone().addScaledVector(side, 1.15).add(new THREE.Vector3(0.25, 0.55, 0));
        const fork = addTube(
          new THREE.CatmullRomCurve3([forkStart, forkStart.clone().lerp(forkTip, 0.55).add(new THREE.Vector3(0, 0.2, 0)), forkTip]),
          0.055,
          0.006,
          { segments: 12, radial: 6, wrinkle: 0.15 },
        );
        rememberOffshoot(limb, fork);
        return;
      }

      const density = spec.density ?? 1;
      [0.44, 0.6, 0.75, 0.88].forEach((t, index) => {
        const base = curve.getPointAt(THREE.MathUtils.clamp(t + (random() - 0.5) * 0.06, 0.38, 0.95));
        const sideSign = index % 2 === 0 ? -1 : 1;
        const branchletAngle = angle + sideSign * THREE.MathUtils.degToRad(18 + random() * 92);
        const branchletDirection = new THREE.Vector3(Math.sin(branchletAngle), 0, Math.cos(branchletAngle));
        const branchletSide = new THREE.Vector3(-branchletDirection.z, 0, branchletDirection.x);
        const length = Math.min(2.9, spec.length * (0.18 + random() * 0.18));
        const branchletTip = base
          .clone()
          .addScaledVector(branchletDirection, length)
          .add(new THREE.Vector3(0.05 + random() * 0.38, -0.28 + random() * 1.05, 0));
        const branchletMid = base
          .clone()
          .lerp(branchletTip, 0.46)
          .addScaledVector(branchletSide, (random() - 0.5) * 0.9)
          .add(new THREE.Vector3(0, -0.08 + random() * 0.48, 0));
        const branchletMid2 = base
          .clone()
          .lerp(branchletTip, 0.78)
          .add(new THREE.Vector3(0, (random() - 0.5) * 0.28, 0));
        const branchletCurve = new THREE.CatmullRomCurve3([base, branchletMid, branchletMid2, branchletTip]);
        const branchlet = addTube(branchletCurve, spec.radius * (0.25 + random() * 0.17), 0.007, {
          segments: 24,
          radial: 7,
          wrinkle: 0.16,
          moss: 0.25,
        });
        rememberOffshoot(limb, branchlet);
        addFoliagePad(
          branchletTip,
          branchletDirection,
          0.82 + random() * 0.48,
          Math.round((82 + Math.floor(random() * 54)) * density),
        );
      });

      const padCentre = curve.getPointAt(0.91);
      addFoliagePad(
        padCentre,
        direction,
        0.95 + spec.length * 0.095,
        Math.round((96 + Math.floor(spec.length * 16)) * density),
      );

      // A pair of fine bare twigs breaks the edge of each foliage silhouette.
      for (let i = 0; i < 2; i += 1) {
        const twigStart = curve.getPointAt(0.79 + i * 0.12);
        const twigDirection = direction.clone().addScaledVector(side, i === 0 ? 0.8 : -0.65).normalize();
        const twigTip = twigStart
          .clone()
          .addScaledVector(twigDirection, 0.75 + random() * 0.7)
          .add(new THREE.Vector3(0, 0.3 + random() * 0.35, 0));
        const twig = addTube(new THREE.CatmullRomCurve3([twigStart, twigStart.clone().lerp(twigTip, 0.5), twigTip]), 0.024, 0.003, {
          segments: 10,
          radial: 5,
          wrinkle: 0.1,
        });
        rememberOffshoot(limb, twig);
      }
    });

    addFoliagePad(trunkCurve.getPointAt(0.985), new THREE.Vector3(1, 0, 0.2), 1.4, 230);

    const sprigGeometry = pineSprigGeometry();
    const foliageMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.86,
      metalness: 0,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    const foliage = new THREE.InstancedMesh(sprigGeometry, foliageMaterial, foliagePlacements.length);
    const timeUniform = { value: 0 };
    foliageMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeUniform;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           #ifdef USE_INSTANCING
             vec3 anchor = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
             float phase = anchor.x * 0.48 + anchor.z * 0.36 + anchor.y * 0.19;
             transformed.x += sin(uTime * 0.72 + phase) * 0.075;
             transformed.z += cos(uTime * 0.54 + phase * 1.3) * 0.045;
           #endif`,
        );
    };
    foliagePlacements.forEach((placement, index) => {
      foliage.setMatrixAt(index, placement.matrix);
      foliage.setColorAt(index, placement.color);
    });
    foliage.instanceMatrix.needsUpdate = true;
    if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    foliage.frustumCulled = false;
    scene.add(foliage);

    // Dense, uneven grass hides the root flares, then thins into the clearing.
    const grassPalette = ["#2b442c", "#3e5633", "#59643d", "#6b7047", "#314b36"].map(
      (hex) => new THREE.Color(hex),
    );
    const grassMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.96,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    grassMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeUniform;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           #ifdef USE_INSTANCING
             vec3 anchor = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
             float phase = anchor.x * 0.7 + anchor.z * 0.53;
             float bend = position.y * position.y;
             transformed.x += sin(uTime * 0.8 + phase) * bend * 0.12;
             transformed.z += cos(uTime * 0.62 + phase) * bend * 0.07;
           #endif`,
        );
    };
    const grassCount = 5800;
    const grass = new THREE.InstancedMesh(grassTuftGeometry(), grassMaterial, grassCount);
    const grassDummy = new THREE.Object3D();
    for (let i = 0; i < grassCount; i += 1) {
      const nearRoots = i < 4300;
      const angle = random() * Math.PI * 2;
      const radius = nearRoots ? 0.65 + Math.pow(random(), 0.72) * 5.8 : 5.5 + Math.pow(random(), 1.4) * 9;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = nearRoots ? 0.65 + random() * 0.65 : 0.45 + random() * 0.6;
      grassDummy.position.set(x, terrainHeight(x, z) + 0.015, z);
      grassDummy.rotation.set(0, random() * Math.PI * 2, (random() - 0.5) * 0.08);
      grassDummy.scale.set(scale * (0.8 + random() * 0.4), scale, scale * (0.8 + random() * 0.4));
      grassDummy.updateMatrix();
      grass.setMatrixAt(i, grassDummy.matrix);
      grass.setColorAt(i, grassPalette[Math.floor(random() * grassPalette.length)]);
    }
    grass.instanceMatrix.needsUpdate = true;
    if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
    grass.receiveShadow = true;
    grass.frustumCulled = false;
    scene.add(grass);

    const monk = createMonk();
    const monkX = 2.65;
    const monkZ = 3.6;
    monk.position.set(monkX, terrainHeight(monkX, monkZ) + 0.02, monkZ);
    monk.rotation.y = -0.18;
    monk.scale.setScalar(1.05);
    scene.add(monk);
    // Feet sit on the group origin. The float follows the body, not the feet.
    const monkBodyOffset = new THREE.Vector3();
    monk.updateWorldMatrix(true, true);
    const monkBounds = new THREE.Box3().setFromObject(monk);
    monkBounds.getCenter(monkBodyOffset);
    monkBodyOffset.sub(monk.position);
    const monkRadius = monkBounds.getBoundingSphere(new THREE.Sphere()).radius;

    const monkLight = new THREE.PointLight(0xffc38f, 5.5, 7, 2);
    monkLight.position.set(monkX, 2.6, monkZ + 1.5);
    scene.add(monkLight);

    const puppy = createPuppy();
    const dog = puppy.dog;
    const dogX = 1.15;
    const dogZ = 6.4;
    dog.position.set(dogX, terrainHeight(dogX, dogZ), dogZ);
    dog.rotation.y = 0.4;
    scene.add(dog);
    const dogTarget = new THREE.Vector3(dogX, 0, dogZ);
    const dogMotion: DogMotion = { x: dogX, z: dogZ, detourSide: 1 };
    const dogShadow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    dogShadow.rotation.x = -Math.PI / 2;
    dogShadow.scale.set(0.52, 1.25, 1);
    dogShadow.position.set(dogX, terrainHeight(dogX, dogZ) + 0.02, dogZ);
    scene.add(dogShadow);
    const dogRay = new THREE.Raycaster();
    let walkPhase = 0;

    // Three full laps round the tree move the scene on one stage for the rest of this
    // page view: green, then autumn, then winter. Every load starts green with a fresh
    // lap count; the server only remembers, per visitor uuid, how many times each stage
    // has been earned (plus the browser and IP, for logging).
    const stages = new SceneStages();
    const autumn = new AutumnTransition(foliage, grass, { scene, renderer, hemisphere, key, rim });
    const visitor = new VisitorSession();
    const abortVisitor = new AbortController();
    let earnedAutumn = 0;
    let earnedWinter = 0;
    if (!debugScene) {
      void visitor.load(abortVisitor.signal).then((status) => {
        if (!status) return;
        earnedAutumn = Math.max(earnedAutumn, status.unlocks);
        earnedWinter = Math.max(earnedWinter, status.winterUnlocks);
      });
    }

    // WebGL speech bubble. Before winter: Galactic glyphs, a new 2–12 letter string every 2–6 seconds.
    // In winter: the garden sentence, one new word at a time.
    // Hidden until the face is ready so the first glyph paint is not Latin.
    const BUBBLE_WORLD_HEIGHT = 1.76;
    let speechMode: SpeechMode = "glyphs";
    let wordCount = 1;
    let spoken = nextMonkSnippet();
    let galacticReady = false;
    let cancelled = false;
    let nightTimer: number | null = null;
    let nightStartedAt: number | null = null;
    let nightSky: NightSky | null = null;
    let bubbleTexture = makeBubbleTexture(" ");
    const bubble = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: bubbleTexture.texture,
        transparent: true,
        // The sprite is one camera-facing quad. Depth testing slices the words
        // wherever a nearer trunk, branch, or snow ridge crosses that quad, and
        // the night sky (renderOrder 16) paints over whatever is left because
        // the sprite does not write depth. Draw it last, on top of the scene.
        depthTest: false,
        depthWrite: false,
        opacity: 0,
      }),
    );
    bubble.renderOrder = 20;
    const bubbleY = terrainHeight(monkX, monkZ) + 4.05;
    bubble.position.set(monkX, bubbleY, monkZ);
    bubble.visible = false;
    scene.add(bubble);
    const bubbleOffset = new THREE.Vector3().subVectors(bubble.position, monk.position);
    const monkLightOffset = new THREE.Vector3().subVectors(monkLight.position, monk.position);
    const monkBodyWorld = new THREE.Vector3();
    const moonCenterWorld = new THREE.Vector3();
    const contactWorld = new THREE.Vector3();
    const floatTargetWorld = new THREE.Vector3();
    const toMoonWorld = new THREE.Vector3();
    const tunnelAxis = new THREE.Vector3(0, 1, 0);
    const tunnelDir = new THREE.Vector3();
    const tunnelMid = new THREE.Vector3();
    let floatTargetReady = false;
    let monkArrived = false;
    // Keep normal flight at 2.4 units/s; the debug URL skips the long setup.
    const MONK_FLOAT_SPEED = debugMonkFlight ? 16 : 2.4;
    // CylinderGeometry points along local +Y. Radius is 1.5× the monk's bounding sphere.
    const tunnelRadius = monkRadius * 1.5;
    const lightTunnel = new THREE.Mesh(
      new THREE.CylinderGeometry(tunnelRadius, tunnelRadius, 1, 40, 1, false),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: { uRadius: { value: tunnelRadius } },
        vertexShader: `
          varying vec3 vViewPos;
          varying vec3 vAxis;
          varying vec3 vCenter;
          varying float vAlong;
          void main() {
            vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
            vViewPos = viewPos.xyz;
            vAxis = normalize(mat3(modelViewMatrix) * vec3(0.0, 1.0, 0.0));
            vCenter = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            // Geometry +Y is the moon end. position.y runs -0.5 at the monk to 0.5 at the moon.
            vAlong = position.y + 0.5;
            gl_Position = projectionMatrix * viewPos;
          }
        `,
        fragmentShader: `
          varying vec3 vViewPos;
          varying vec3 vAxis;
          varying vec3 vCenter;
          varying float vAlong;
          uniform float uRadius;
          void main() {
            vec3 ray = normalize(vViewPos);
            vec3 w0 = -vCenter;
            float b = dot(ray, vAxis);
            float d = dot(ray, w0);
            float e = dot(vAxis, w0);
            float denom = 1.0 - b * b;
            float dist = length(cross(w0, vAxis));
            if (denom > 1e-4) {
              float t = (b * e - d) / denom;
              float s = (e - b * d) / denom;
              dist = length(w0 + ray * t - vAxis * s);
            }
            float glow = smoothstep(uRadius, uRadius * 0.12, dist);
            float endFade = 1.0 - smoothstep(0.35, 1.0, vAlong);
            if (glow * endFade <= 0.001) discard;
            gl_FragColor = vec4(0.78, 0.88, 1.0, glow * endFade * 0.18);
          }
        `,
      }),
    );
    lightTunnel.name = "Moon tunnel";
    lightTunnel.visible = false;
    lightTunnel.frustumCulled = false;
    // Stars finish at 16 and do not write depth, so they used to paint over this beam.
    // Draw after them. Depth testing still lets the moon, which writes depth, cover it.
    lightTunnel.renderOrder = 18;
    lightTunnel.castShadow = false;
    lightTunnel.receiveShadow = false;
    scene.add(lightTunnel);

    const paintBubble = (text: string, mode: SpeechMode) => {
      const next = makeBubbleTexture(text, mode);
      bubbleTexture.texture.dispose();
      bubbleTexture = next;
      bubble.material.map = next.texture;
      bubble.material.needsUpdate = true;
      const worldH = mode === "intro" ? Math.min(3.15, 1.05 + next.lines * 0.46) : BUBBLE_WORLD_HEIGHT;
      bubble.scale.set(worldH * (next.width / next.height), worldH, 1);
    };

    const showSpeech = () => {
      if (speechMode === "intro") paintBubble(WINTER_WORDS.slice(0, wordCount).join(" "), "intro");
      else if (galacticReady) paintBubble(spoken, "glyphs");
    };

    const startNightTransition = () => {
      nightTimer = null;
      if (cancelled || nightStartedAt !== null) return;
      nightStartedAt = performance.now();
      nightSky?.start(nightStartedAt);
    };

    let chatterTimer = 0;
    const scheduleChatter = () => {
      if (speechMode === "intro" && wordCount >= WINTER_WORDS.length) {
        if (nightTimer === null && nightStartedAt === null) {
          nightTimer = window.setTimeout(startNightTransition, NIGHT_GREETING_HOLD_MS);
        }
        return;
      }
      const delay = speechMode === "intro" ? WORD_POP_MS : 2000 + Math.random() * 4000;
      chatterTimer = window.setTimeout(() => {
        if (speechMode === "intro") wordCount += 1;
        else spoken = nextMonkSnippet(spoken);
        showSpeech();
        if (!debugScene) scheduleChatter();
      }, delay);
    };
    scheduleChatter();

    const beginIntro = () => {
      if (speechMode === "intro") return;
      speechMode = "intro";
      wordCount = 1;
      showSpeech();
      window.clearTimeout(chatterTimer);
      scheduleChatter();
    };

    void createNightSky({
      scene,
      renderer,
      fog: scene.fog as THREE.FogExp2,
      hemisphere,
      ambient,
      key,
      rim,
      fill,
      monkLight,
      mountains: mountainMaterials,
    })
      .then((sky) => {
        if (cancelled) {
          sky.dispose();
          return;
        }
        nightSky = sky;
        if (debugScene) {
          placeCamera(camera, viewRef.current);
          nightStartedAt = performance.now();
          sky.startForDebug(nightStartedAt, camera);
          if (sky.moonCenter(moonCenterWorld)) {
            monkBodyWorld.copy(monk.position).add(monkBodyOffset);
            floatTargetWorld.subVectors(monkBodyWorld, moonCenterWorld);
            if (floatTargetWorld.lengthSq() < 1e-8) floatTargetWorld.set(0, 0, 1);
            floatTargetWorld.setLength(sky.moonRadius + monkRadius).add(moonCenterWorld);
            if (debugSwallow) {
              monk.position.copy(floatTargetWorld).sub(monkBodyOffset);
              monkArrived = true;
              // The risen moon sits behind the start camera, so turn the debug view to the monk on its face.
              const aim = floatTargetWorld.clone();
              const offset = camera.position.clone().sub(aim);
              const aimDistance = Math.max(0.01, offset.length());
              const azimuth = Math.atan2(offset.x, offset.z);
              const polar = Math.acos(THREE.MathUtils.clamp(offset.y / aimDistance, -1, 1));
              for (const pose of [viewRef.current, desiredRef.current]) {
                pose.azimuth = azimuth;
                pose.polar = polar;
                pose.distance = aimDistance / fitScale;
                pose.target.copy(aim);
              }
            } else {
              monkBodyWorld.lerp(floatTargetWorld, 0.68);
              monk.position.copy(monkBodyWorld).sub(monkBodyOffset);
              floatTargetReady = true;
            }
          }
        } else if (nightStartedAt !== null) {
          sky.start(nightStartedAt);
        }
      })
      .catch((error: unknown) => {
        console.error("Could not load night-sky star data", error);
      });

    let fontLoad = Promise.resolve();
    if (typeof document !== "undefined" && "fonts" in document) {
      fontLoad = document.fonts.load(GALACTIC_FONT).then(() => undefined);
    }
    fontLoad
      .then(() => {
        if (cancelled) return;
        galacticReady = true;
        if (speechMode === "glyphs") paintBubble(spoken, "glyphs");
      })
      .catch(() => {
        if (cancelled) return;
        galacticReady = true;
        if (speechMode === "glyphs") paintBubble(spoken, "glyphs");
      });

    // The monk faces +Z in local space; rotate by his yaw for the world vector.
    // yaw -0.18 sends local +Z to about (-0.18, 0, 0.98). The fire uses this same vector.
    const monkForward = new THREE.Vector3(Math.sin(monk.rotation.y), 0, Math.cos(monk.rotation.y)).normalize();
    const campfire = createCampfire();
    // In front of the monk, and a step to his right so the dog's spawn does not sit in the flames.
    // Right is derived from monkForward: (fz, 0, -fx).
    // 200% farther than 1.85: the old gap, plus twice that gap again.
    const fireDistance = 1.85 * 3;
    const fireSide = 0.2;
    const fireX = monkX + monkForward.x * fireDistance + monkForward.z * fireSide;
    const fireZ = monkZ + monkForward.z * fireDistance - monkForward.x * fireSide;
    campfire.group.position.set(fireX, terrainHeight(fireX, fireZ) + 0.02, fireZ);
    campfire.group.scale.setScalar(1.5);
    campfire.group.visible = false;
    scene.add(campfire.group);
    const blackHoleEffect = new BlackHoleEffect();

    // A few quiet stones anchor the foreground without making a forest floor busy.
    const stoneGeometry = new THREE.IcosahedronGeometry(1, 1);
    const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x3d4842, roughness: 0.98, flatShading: true });
    for (let i = 0; i < 18; i += 1) {
      const angle = random() * Math.PI * 2;
      const distance = 2.8 + random() * 11;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
      const scale = 0.18 + Math.pow(random(), 2) * 0.72;
      stone.scale.set(scale * (0.8 + random() * 0.8), scale * (0.45 + random() * 0.45), scale);
      stone.position.set(x, terrainHeight(x, z) + stone.scale.y * 0.42, z);
      stone.rotation.set(random() * 0.5, random() * Math.PI, random() * 0.35);
      stone.castShadow = true;
      stone.receiveShadow = true;
      scene.add(stone);
    }

    const litterMaterial = new THREE.MeshStandardMaterial({
      color: 0x4b4734,
      roughness: 1,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    const litter = new THREE.InstancedMesh(sprigGeometry, litterMaterial, 220);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 220; i += 1) {
      const angle = random() * Math.PI * 2;
      const distance = 1.3 + Math.pow(random(), 0.65) * 12;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      dummy.position.set(x, terrainHeight(x, z) + 0.025, z);
      dummy.rotation.set((random() - 0.5) * 0.15, random() * Math.PI * 2, (random() - 0.5) * 0.12);
      dummy.scale.setScalar(0.2 + random() * 0.28);
      dummy.updateMatrix();
      litter.setMatrixAt(i, dummy.matrix);
    }
    litter.instanceMatrix.needsUpdate = true;
    litter.receiveShadow = true;
    scene.add(litter);

    // Winter needs the finished scene: the crown, grass, litter and the surfaces snow settles on.
    const winter = new WinterTransition({
      scene,
      renderer,
      hemisphere,
      key,
      rim,
      fill,
      tree,
      foliage,
      grass,
      litter,
      snowy: [],
      groundSnowy: [groundMaterial, stoneMaterial],
      mountains: mountainMaterials,
      groundHeight: terrainHeight,
      caps: [
        { parent: monk, position: [0, 2.47, 0.03], radii: [0.4, 0.17, 0.38] },
        { parent: puppy.head, position: [0, 0.33, -0.03], radii: [0.25, 0.085, 0.22] },
        { parent: puppy.body, position: [0, 0.74, -0.17], radii: [0.27, 0.075, 0.34] },
      ],
    });
    textures.push(winter.flakeTexture);

    // #autumn and #winter jump straight to a stage so each look can be checked quickly.
    if (debugScene || window.location.hash.includes("winter")) {
      stages.jumpTo("winter");
      winter.start(0, true);
      if (!debugScene) beginIntro();
      campfire.group.visible = true;
    } else if (window.location.hash.includes("autumn")) {
      stages.jumpTo("autumn");
      autumn.start(0, true);
    }

    const mistTexture = radialTexture("rgba(255,255,255,0.8)", "rgba(255,255,255,0)");
    textures.push(mistTexture);
    const mistSprites: { sprite: THREE.Sprite; baseX: number; speed: number; phase: number }[] = [];
    [
      { position: [-9, 1.3, -10], scale: [28, 5], opacity: 0.13 },
      { position: [8, 2.0, -17], scale: [34, 6], opacity: 0.12 },
      { position: [-3, 4.0, -23], scale: [38, 8], opacity: 0.09 },
      { position: [5, 0.9, 5], scale: [22, 3.4], opacity: 0.075 },
      { position: [-10, 7.5, -28], scale: [32, 7], opacity: 0.065 },
    ].forEach((settings, index) => {
      const material = new THREE.SpriteMaterial({
        map: mistTexture,
        color: 0xc0d1cd,
        transparent: true,
        opacity: settings.opacity,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(settings.position[0], settings.position[1], settings.position[2]);
      sprite.scale.set(settings.scale[0], settings.scale[1], 1);
      sprite.renderOrder = 2;
      scene.add(sprite);
      mistSprites.push({ sprite, baseX: settings.position[0], speed: 0.025 + index * 0.006, phase: random() * 6 });
    });

    const haze = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: mistTexture,
        color: 0xbad1c9,
        transparent: true,
        opacity: 0.13,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    haze.position.set(-4, 12, -14);
    haze.scale.set(27, 24, 1);
    haze.renderOrder = 2;
    scene.add(haze);

    const beamTexture = makeBeamTexture();
    textures.push(beamTexture);
    [
      { x: -8, y: 13, z: -10, scale: 3.6, opacity: 0.075 },
      { x: -3.5, y: 14, z: -12, scale: 5.2, opacity: 0.055 },
      { x: 2, y: 14.5, z: -15, scale: 3.2, opacity: 0.045 },
    ].forEach((settings) => {
      const beam = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: beamTexture,
          color: 0xffe5b9,
          transparent: true,
          opacity: settings.opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          rotation: -0.42,
        }),
      );
      beam.position.set(settings.x, settings.y, settings.z);
      beam.scale.set(settings.scale, 27, 1);
      beam.renderOrder = 2;
      scene.add(beam);
    });

    const moteGeometry = new THREE.BufferGeometry();
    const motePositions = new Float32Array(70 * 3);
    for (let i = 0; i < 70; i += 1) {
      motePositions[i * 3] = (random() - 0.5) * 24;
      motePositions[i * 3 + 1] = random() * 17;
      motePositions[i * 3 + 2] = (random() - 0.5) * 17;
    }
    moteGeometry.setAttribute("position", new THREE.BufferAttribute(motePositions, 3));
    const motes = new THREE.Points(
      moteGeometry,
      new THREE.PointsMaterial({
        color: 0xd6ded1,
        size: 0.055,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    motes.renderOrder = 2;
    scene.add(motes);

    // Static geometry and lights only need one shadow-map render.
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;

    let dragging = false;
    let touchTracking = false;
    let gestureMoved = false;
    let lastTapAt = 0;
    let lastX = 0;
    let lastY = 0;
    let pointerInside = false;
    const activePointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;
    canvas.style.touchAction = "none";
    const pointerNdc = new THREE.Vector2();
    const hideConstellation = () => {
      nightSky?.setHovered(null);
      if (constellationLabelRef.current) constellationLabelRef.current.style.display = "none";
    };
    const updateConstellationHover = (event: PointerEvent) => {
      const label = constellationLabelRef.current;
      if (!label || dragging || !nightSky) {
        hideConstellation();
        return;
      }
      const name = nightSky.pick(camera, pointerNdc);
      if (!name) {
        hideConstellation();
        return;
      }
      nightSky.setHovered(name);
      const rect = wrap.getBoundingClientRect();
      label.textContent = name;
      label.style.left = `${THREE.MathUtils.clamp(event.clientX - rect.left + 14, 8, rect.width - 150)}px`;
      label.style.top = `${THREE.MathUtils.clamp(event.clientY - rect.top + 16, 8, rect.height - 44)}px`;
      label.style.display = "block";
    };
    const trackPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      pointerInside = true;
    };
    // After the moon has finished rising, a click cuts a limb. The tube's
    // origin is the buried trunk end, so the wood is in the vertices: drop
    // that whole shape straight down. No velocity. A hold then keeps the
    // grabbed point on the camera ray at the camera-to-flame distance, so
    // the stick can move in every direction and lands in the fire when the
    // cursor is on the fire. Letting go anywhere else drops it straight down.
    type FelledLimb = { mesh: THREE.Mesh; dropToY: number; settled: boolean };
    const felled: FelledLimb[] = [];
    let carried: FelledLimb | null = null;
    let carryArmed = false;
    let carryDistance = 1;
    let pendingCut: THREE.Mesh | null = null;
    let pressX = 0;
    let pressY = 0;
    const branchRay = new THREE.Raycaster();
    const branchBox = new THREE.Box3();
    const dropCenter = new THREE.Vector3();
    const grabOffsetWorld = new THREE.Vector3();
    const grabPointWorld = new THREE.Vector3();
    const flameWorld = new THREE.Vector3();
    const CLICK_SLOP = 8;
    const DROP_SPEED = 22;

    const cuttableMeshes = () => limbs.filter((mesh) => !mesh.userData.felled);
    const fallenMeshes = () => {
      const meshes: THREE.Mesh[] = [];
      for (const limb of felled) {
        if (!limb.settled) continue;
        limb.mesh.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (mesh.isMesh) meshes.push(mesh);
        });
      }
      return meshes;
    };
    const fallenLimbOf = (object: THREE.Object3D) => {
      let current: THREE.Object3D | null = object;
      while (current) {
        const limb = felled.find((entry) => entry.mesh === current);
        if (limb) return limb;
        current = current.parent;
      }
      return undefined;
    };

    const placeFlame = (target: THREE.Vector3) => {
      const scale = campfire.group.scale.y;
      target.copy(campfire.group.position);
      target.y += 0.68 * scale;
      return target;
    };

    // position.y that puts the lowest vertex on the snow. X and Z stay put.
    const restedY = (mesh: THREE.Mesh) => {
      mesh.updateWorldMatrix(true, false);
      branchBox.setFromObject(mesh);
      dropCenter.set((branchBox.min.x + branchBox.max.x) * 0.5, 0, (branchBox.min.z + branchBox.max.z) * 0.5);
      const groundY = terrainHeight(dropCenter.x, dropCenter.z) + 0.04;
      return mesh.position.y + (groundY - branchBox.min.y);
    };

    const cutBranch = (mesh: THREE.Mesh) => {
      const extras = offshoots.get(mesh);
      if (extras) {
        for (const extra of extras) {
          if (extra.userData.felled) continue;
          extra.userData.felled = true;
          // Keep the twig where it grew, then let the limb's later move carry it.
          mesh.attach(extra);
        }
      }
      mesh.userData.felled = true;
      scene.attach(mesh);
      felled.push({ mesh, dropToY: restedY(mesh), settled: false });
      winter.refreshBranchSnow();
    };

    const burnBranch = (limb: FelledLimb) => {
      limb.mesh.traverse((object) => {
        const child = object as THREE.Mesh;
        if (child.geometry) child.geometry.dispose();
      });
      offshoots.delete(limb.mesh);
      offshoots.forEach((list) => {
        const childIndex = list.indexOf(limb.mesh);
        if (childIndex >= 0) list.splice(childIndex, 1);
      });
      limb.mesh.removeFromParent();
      const index = felled.indexOf(limb);
      if (index >= 0) felled.splice(index, 1);
      campfire.grow();
    };

    const overFire = () => {
      placeFlame(flameWorld);
      const reach = 1.15 * campfire.group.scale.x + 0.5;
      return grabPointWorld.distanceTo(flameWorld) <= reach;
    };

    const pointerSpan = () => {
      const points = Array.from(activePointers.values());
      if (points.length < 2) return 0;
      return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    };
    const slopFor = (event: PointerEvent) => (event.pointerType === "touch" ? 14 : CLICK_SLOP);
    const onPointerDown = (event: PointerEvent) => {
      hideConstellation();
      trackPointer(event);
      pressX = event.clientX;
      pressY = event.clientY;
      gestureMoved = false;
      carried = null;
      carryArmed = false;
      pendingCut = null;
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // iOS can reject capture if the touch already ended.
      }
      if (activePointers.size >= 2) {
        dragging = false;
        touchTracking = false;
        pinchDistance = pointerSpan();
        return;
      }
      if (nightSky?.moonFullyUp) {
        branchRay.setFromCamera(pointerNdc, camera);
        const hit = branchRay.intersectObjects([...fallenMeshes(), ...cuttableMeshes()], false)[0];
        const fallen = hit ? fallenLimbOf(hit.object) : undefined;
        if (fallen) {
          carried = fallen;
          grabOffsetWorld.copy(fallen.mesh.position).sub(hit.point);
          carryDistance = camera.position.distanceTo(placeFlame(flameWorld));
          canvas.style.cursor = "grabbing";
          return;
        }
        if (hit) {
          pendingCut = hit.object as THREE.Mesh;
          return;
        }
      }
      // A finger rests to aim the dog. The orbit starts only after it actually drags.
      touchTracking = event.pointerType === "touch";
      dragging = event.pointerType !== "touch";
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onPointerMove = (event: PointerEvent) => {
      trackPointer(event);
      if (activePointers.has(event.pointerId)) {
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      if (activePointers.size >= 2) {
        const span = pointerSpan();
        if (pinchDistance > 0 && span > 0) {
          const points = Array.from(activePointers.values());
          const midX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
          const midY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
          zoomAt(midX, midY, pinchDistance / span);
        }
        pinchDistance = span;
        dragging = false;
        touchTracking = false;
        return;
      }
      if (carried) {
        if (!carryArmed) {
          if (Math.hypot(event.clientX - pressX, event.clientY - pressY) <= CLICK_SLOP) return;
          carryArmed = true;
          carried.settled = false;
        }
        // View ray from the camera, not the ground plane. Length reaches the
        // flames, so every cursor direction — including straight up — moves the stick.
        branchRay.setFromCamera(pointerNdc, camera);
        branchRay.ray.at(carryDistance, grabPointWorld);
        carried.mesh.position.copy(grabPointWorld).add(grabOffsetWorld);
        canvas.style.cursor = "grabbing";
        gestureMoved = true;
        return;
      }
      if (touchTracking && !dragging) {
        updateConstellationHover(event);
        if (Math.hypot(event.clientX - pressX, event.clientY - pressY) > slopFor(event)) {
          touchTracking = false;
          dragging = true;
          gestureMoved = true;
          lastX = event.clientX;
          lastY = event.clientY;
        }
        return;
      }
      if (pendingCut) {
        if (Math.hypot(event.clientX - pressX, event.clientY - pressY) > slopFor(event)) {
          pendingCut = null;
          dragging = true;
          lastX = event.clientX;
          lastY = event.clientY;
        } else {
          return;
        }
      }
      if (!dragging) {
        updateConstellationHover(event);
        if (nightSky?.moonFullyUp) {
          branchRay.setFromCamera(pointerNdc, camera);
          const hoverHit = branchRay.intersectObjects([...fallenMeshes(), ...cuttableMeshes()], false)[0];
          canvas.style.cursor = hoverHit ? "pointer" : "";
        } else canvas.style.cursor = "";
        return;
      }
      hideConstellation();
      gestureMoved = true;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      desiredRef.current.azimuth += dx * 0.005;
      desiredRef.current.polar = THREE.MathUtils.clamp(
        desiredRef.current.polar - dy * 0.0035,
        0.01,
        Math.PI - 0.01,
      );
    };
    const onPointerUp = (event: PointerEvent) => {
      const tapped = event.pointerType === "touch" && !gestureMoved && !carryArmed;
      activePointers.delete(event.pointerId);
      pinchDistance = pointerSpan();
      if (carried) {
        if (carryArmed && overFire()) burnBranch(carried);
        else if (carryArmed) {
          carried.dropToY = restedY(carried.mesh);
          carried.settled = false;
        }
        carried = null;
        carryArmed = false;
      } else if (pendingCut && nightSky?.moonFullyUp) {
        if (Math.hypot(event.clientX - pressX, event.clientY - pressY) <= slopFor(event)) cutBranch(pendingCut);
        pendingCut = null;
      } else if (tapped) {
        const nowTap = performance.now();
        if (nowTap - lastTapAt < 320) onDoubleClick();
        lastTapAt = nowTap;
      }
      if (event.pointerType === "touch") {
        pointerInside = false;
        hideConstellation();
      }
      dragging = false;
      touchTracking = false;
      canvas.style.cursor = "";
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    // Zoom keeps the point under the cursor fixed. The ray is cast from the pose the
    // camera is easing towards, so rapid wheel ticks stay accurate.
    const zoomCamera = camera.clone();
    const zoomRay = new THREE.Raycaster();
    const zoomNdc = new THREE.Vector2();
    const zoomTargets: THREE.Object3D[] = [ground, tree, foliage, monk, dog];
    const zoomAt = (clientX: number, clientY: number, factor: number) => {
      const rect = canvas.getBoundingClientRect();
      zoomNdc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      const desired = desiredRef.current;
      zoomCamera.aspect = camera.aspect;
      zoomCamera.updateProjectionMatrix();
      placeCamera(zoomCamera, desired);
      zoomCamera.updateMatrixWorld(true);
      zoomRay.setFromCamera(zoomNdc, zoomCamera);

      // Anchor on whatever is under the cursor, but not absurdly far behind the view.
      const maxDepth = desired.distance * fitScale * 1.6;
      const hit = zoomRay.intersectObjects(zoomTargets, true)[0];
      const depth = hit ? Math.min(hit.distance, maxDepth) : desired.distance * fitScale;
      const anchor = zoomRay.ray.at(depth, new THREE.Vector3());

      const zoomed = zoomAboutAnchor(desired.distance, desired.target, zoomCamera.position, anchor, factor);
      desired.distance = zoomed.distance;
      desired.target.set(zoomed.target.x, zoomed.target.y, zoomed.target.z);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAt(event.clientX, event.clientY, wheelToFactor(event.deltaY, event.deltaMode));
    };
    const onDoubleClick = () => {
      const desired = desiredRef.current;
      const turns = Math.round((viewRef.current.azimuth - home.azimuth) / (Math.PI * 2));
      desired.azimuth = home.azimuth + turns * Math.PI * 2;
      desired.polar = home.polar;
      desired.distance = home.distance;
      desired.target.copy(home.target);
    };
    const onPointerLeave = () => {
      pointerInside = false;
      hideConstellation();
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", onDoubleClick);
    const blockGesture = (event: Event) => event.preventDefault();
    canvas.addEventListener("gesturestart", blockGesture);
    canvas.addEventListener("gesturechange", blockGesture);

    let fitScale = 1;
    const placeCamera = (
      cam: THREE.PerspectiveCamera,
      pose: { azimuth: number; polar: number; distance: number; target: THREE.Vector3 },
    ) => {
      const sinPolar = Math.sin(pose.polar);
      const distance = pose.distance * fitScale;
      cam.position.set(
        pose.target.x + distance * sinPolar * Math.sin(pose.azimuth),
        pose.target.y + distance * Math.cos(pose.polar),
        pose.target.z + distance * sinPolar * Math.cos(pose.azimuth),
      );
      cam.lookAt(pose.target);
    };
    const resize = () => {
      const width = wrap.clientWidth;
      const height = wrap.clientHeight;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      fitScale = camera.aspect < 1 ? Math.min(1.85, 0.88 / camera.aspect) : camera.aspect < 1.3 ? 1.08 : 1;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    let frame = 0;
    let previous = performance.now();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      timeUniform.value = reduceMotion ? 0 : now / 1000;

      const view = viewRef.current;
      const desired = desiredRef.current;
      const ease = reduceMotion ? 1 : 1 - Math.pow(0.0008, delta);
      view.azimuth += (desired.azimuth - view.azimuth) * ease;
      view.polar += (desired.polar - view.polar) * ease;
      view.distance += (desired.distance - view.distance) * ease;
      view.target.lerp(desired.target, ease);

      placeCamera(camera, view);

      // Speech bubble: visible only from the monk's front side, with a soft fade
      // so it never pops when you swing the camera around him.
      const toCamera = new THREE.Vector3().subVectors(camera.position, monk.position).normalize();
      const facing = monkForward.dot(toCamera);
      const bubbleVisible =
        !debugScene && (speechMode === "intro" || galacticReady)
          ? THREE.MathUtils.smoothstep(facing, -0.2, 0.5)
          : 0;
      bubble.material.opacity = 0.94 * bubbleVisible;
      bubble.visible = bubbleVisible > 0.02;

      const trunkClearance = TREE_TRUNK_RADIUS + puppy.radius;
      // Winter is the last stage. The dog stays where it is and no longer follows the cursor.
      const chasing = !winter.started;
      if (chasing && pointerInside && !dragging) {
        dogRay.setFromCamera(pointerNdc, camera);
        const hits = dogRay.intersectObject(ground);
        if (hits.length > 0) {
          let aimX = hits[0].point.x;
          let aimZ = hits[0].point.z;
          const radial = Math.hypot(aimX, aimZ);
          if (radial < trunkClearance) {
            const pushed = trunkClearance / Math.max(radial, 0.001);
            aimX *= pushed;
            aimZ *= pushed;
          } else if (radial > 16) {
            aimX *= 16 / radial;
            aimZ *= 16 / radial;
          }
          dogTarget.set(aimX, 0, aimZ);
        }
      }

      // The dog walks round the trunk towards the cursor and runs when far behind it.
      let dogMoving = false;
      if (chasing) {
        dogMotion.x = dog.position.x;
        dogMotion.z = dog.position.z;
        const walk = stepDog(dogMotion, dogTarget.x, dogTarget.z, delta, trunkClearance, reduceMotion);
        dogMoving = walk.moving;
        if (dogMoving) {
          dog.position.x = dogMotion.x;
          dog.position.z = dogMotion.z;
          const yaw = Math.atan2(walk.headX, walk.headZ);
          const turn = Math.atan2(Math.sin(yaw - dog.rotation.y), Math.cos(yaw - dog.rotation.y));
          dog.rotation.y += turn * (reduceMotion ? 1 : Math.min(1, delta * 8));
          if (!walk.blocked) walkPhase += walk.step * 8;
        }
      }
      dog.position.y = terrainHeight(dog.position.x, dog.position.z);
      dogShadow.position.set(dog.position.x, dog.position.y + 0.025, dog.position.z);
      dogShadow.rotation.y = dog.rotation.y;

      const progress = stages.update(dog.position.x, dog.position.z);
      const lap = progress.lap;
      if (lap.newFullLap !== null && !lap.justCompleted) {
        visitor.report({ laps: lap.newFullLap, direction: lap.direction });
      }
      if (progress.advancedTo === "autumn") {
        visitor.report({ laps: LAPS_TO_UNLOCK, direction: lap.direction, completed: true, stage: "autumn" });
        earnedAutumn += 1;
        autumn.start(now, reduceMotion);
      } else if (progress.advancedTo === "winter") {
        visitor.report({ laps: LAPS_TO_UNLOCK, direction: lap.direction, completed: true, stage: "winter" });
        earnedWinter += 1;
        autumn.finish();
        winter.start(now, reduceMotion);
        beginIntro();
        campfire.group.visible = true;
      }
      autumn.update(now);
      winter.update(now, reduceMotion);

      if (dogCoordsRef.current) {
        const formatAxis = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
        const remembered = [
          earnedAutumn > 0 ? `autumn x${earnedAutumn}` : "",
          earnedWinter > 0 ? `winter x${earnedWinter}` : "",
        ].filter(Boolean);
        const earned = remembered.length > 0 ? `   earned ${remembered.join(" ")}` : "";
        const arrow = lap.direction === "ccw" ? "↺" : "↻";
        const shownLaps = progress.advancedTo ? 0 : lap.laps;
        const lapText =
          progress.next === null
            ? "winter"
            : `${progress.stage === "autumn" ? "autumn   " : ""}laps ${arrow} ${shownLaps.toFixed(1)}/${LAPS_TO_UNLOCK} → ${progress.next}`;
        dogCoordsRef.current.textContent = debugSwallow
          ? `swallow   ${blackHoleLook.name}`
          : `from tree   x ${formatAxis(dog.position.x)}   z ${formatAxis(dog.position.z)}   ${lapText}${earned}`;
      }

      const gait = dogMoving && !reduceMotion ? 1 : 0;
      puppy.legs.forEach((leg, index) => {
        const swing = Math.sin(walkPhase + (index === 0 || index === 3 ? 0 : Math.PI)) * 0.42 * gait;
        leg.rotation.x += (swing - leg.rotation.x) * 0.45;
      });
      const bob = gait * Math.abs(Math.sin(walkPhase)) * 0.04;
      puppy.body.position.y += (bob - puppy.body.position.y) * 0.4;
      puppy.head.rotation.z += (Math.sin(walkPhase) * 0.05 * gait - puppy.head.rotation.z) * 0.3;
      puppy.ears.forEach((ear, index) => {
        const side = index === 0 ? -1 : 1;
        const flop = Math.sin(walkPhase * 2 + index) * 0.12 * gait;
        ear.rotation.z += (side * (0.42 + flop) - ear.rotation.z) * 0.35;
      });
      easeTongue(puppy, gait > 0);
      puppy.tail.rotation.x = 0.22 + Math.sin(now * 0.006) * 0.05;
      puppy.tail.rotation.y = Math.sin(now * (dogMoving ? 0.013 : 0.007)) * (dogMoving ? 0.7 : 0.28);
      puppy.tail.rotation.z = 0;

      if (!reduceMotion) {
        mistSprites.forEach(({ sprite, baseX, speed, phase }) => {
          sprite.position.x = baseX + Math.sin(now * 0.001 * speed + phase) * 2.2;
        });
        motes.rotation.y = now * 0.000012;
      }

      if (campfire.group.visible) campfire.update(now / 1000);
      for (const limb of felled) {
        if (limb.settled || limb === carried) continue;
        const remaining = limb.dropToY - limb.mesh.position.y;
        if (reduceMotion || Math.abs(remaining) <= DROP_SPEED * delta) {
          limb.mesh.position.y = limb.dropToY;
          limb.settled = true;
        } else {
          limb.mesh.position.y += Math.sign(remaining) * DROP_SPEED * delta;
        }
      }
      nightSky?.update(now, camera);
      // Fire at its cap: drift the body center straight at the moon center.
      // The target is fixed on the first frame, so the path stays one line.
      if (
        !monkArrived &&
        (debugMonkFlight || campfire.atMaximum) &&
        nightSky?.moonFullyUp &&
        nightSky.moonCenter(moonCenterWorld)
      ) {
        if (!floatTargetReady) {
          monkBodyWorld.copy(monk.position).add(monkBodyOffset);
          floatTargetWorld.subVectors(monkBodyWorld, moonCenterWorld);
          if (floatTargetWorld.lengthSq() < 1e-8) floatTargetWorld.set(0, 0, 1);
          floatTargetWorld.setLength(nightSky.moonRadius + monkRadius).add(moonCenterWorld);
          floatTargetReady = true;
        }
        monkBodyWorld.copy(monk.position).add(monkBodyOffset);
        toMoonWorld.subVectors(floatTargetWorld, monkBodyWorld);
        const remaining = toMoonWorld.length();
        if (remaining > 1e-4) {
          const step = Math.min(MONK_FLOAT_SPEED * delta, remaining);
          monk.position.addScaledVector(toMoonWorld, step / remaining);
          if (step >= remaining - 1e-6) monkArrived = true;
        } else {
          monk.position.add(toMoonWorld);
          monkArrived = true;
        }
        monkLight.position.copy(monk.position).add(monkLightOffset);
      }
      // The glow is the segment from just behind his body to the moon center.
      // Local +Y of the cylinder is turned onto that same line.
      if (!floatTargetReady || monkArrived) {
        lightTunnel.visible = false;
      } else {
        monkBodyWorld.copy(monk.position).add(monkBodyOffset);
        tunnelDir.subVectors(floatTargetWorld, monkBodyWorld);
        const span = tunnelDir.length();
        if (span < 1e-3) {
          lightTunnel.visible = false;
        } else {
          tunnelDir.multiplyScalar(1 / span);
          const length = span + monkRadius;
          tunnelMid.copy(monkBodyWorld).addScaledVector(tunnelDir, (span - monkRadius) * 0.5);
          lightTunnel.position.copy(tunnelMid);
          lightTunnel.quaternion.setFromUnitVectors(tunnelAxis, tunnelDir);
          lightTunnel.scale.set(1, length, 1);
          lightTunnel.visible = true;
        }
      }
      if (monkArrived && !blackHoleEffect.started && nightSky?.moonCenter(moonCenterWorld)) {
        monkBodyWorld.copy(monk.position).add(monkBodyOffset);
        contactWorld.subVectors(monkBodyWorld, moonCenterWorld);
        if (contactWorld.lengthSq() < 1e-8) contactWorld.set(0, 0, 1);
        contactWorld.setLength(nightSky.moonRadius).add(moonCenterWorld);
        blackHoleEffect.start(now - debugStartMs, contactWorld, blackHoleLook, reduceMotion);
      }
      if (blackHoleEffect.started && !debugSwallow) {
        const hudOpacity = 1 - THREE.MathUtils.smoothstep(blackHoleEffect.progress, 0.12, 0.36);
        if (dogCoordsRef.current) dogCoordsRef.current.style.opacity = String(hudOpacity);
        if (constellationLabelRef.current) constellationLabelRef.current.style.opacity = String(hudOpacity);
        if (vignetteRef.current) vignetteRef.current.style.opacity = String(hudOpacity);
      }
      bubble.position.copy(monk.position).add(bubbleOffset);
      if (bubble.visible) bubble.position.y += Math.sin(now * 0.0011) * 0.06;

      if (blackHoleEffect.started) nightSky?.collapseMoon(contactWorld, blackHoleEffect.moonCollapse);
      blackHoleEffect.render(renderer, scene, camera, now);
      if (blackHoleEffect.fullyDark) {
        cancelAnimationFrame(frame);
        setShowAscii(true);
      }
    };
    animate();

    return () => {
      cancelled = true;
      abortVisitor.abort();
      cancelAnimationFrame(frame);
      window.clearTimeout(chatterTimer);
      if (nightTimer !== null) window.clearTimeout(nightTimer);
      nightSky?.dispose();
      blackHoleEffect.dispose();
      bubbleTexture.texture.dispose();
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("dblclick", onDoubleClick);
      canvas.removeEventListener("gesturestart", blockGesture);
      canvas.removeEventListener("gesturechange", blockGesture);

      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        const renderable = object as THREE.Mesh;
        if (renderable.geometry) geometries.add(renderable.geometry);
        const material = renderable.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((item) => materials.add(item));
        else if (material) materials.add(material);
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      campfire.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <main className="fixed inset-0 h-[100dvh] touch-none overflow-hidden overscroll-none bg-[#17292d]">
      <div ref={wrapRef} className="relative h-full w-full">
        <canvas
          ref={canvasRef}
          aria-label="A windswept Chinese pine among misty mountains. A golden puppy on the grass follows the cursor."
          className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
        />
        <button
          type="button"
          aria-label={musicMuted ? "Unmute music" : "Mute music"}
          onClick={() => {
            const music = musicRef.current;
            if (!music) return;
            if (music.paused) {
              music.muted = false;
              setMusicMuted(false);
              void music.play().catch(() => {});
              return;
            }
            music.muted = !music.muted;
            setMusicMuted(music.muted);
          }}
          className="absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(1rem,env(safe-area-inset-top))] z-50 min-h-11 rounded-md bg-black/40 px-2.5 py-1 font-mono text-xs tracking-wide text-[#f3efe4] opacity-40 transition-opacity hover:opacity-80 active:opacity-80"
        >
          {musicMuted ? "muted" : "music"}
        </button>
        <audio ref={musicRef} src="/music/bwv565-fugue.mp3" loop autoPlay playsInline />
        <p
          ref={dogCoordsRef}
          hidden
          className="pointer-events-none absolute left-4 top-14 z-10 m-0 rounded-md bg-black/40 px-2.5 py-1 font-mono text-xs tracking-wide text-[#f3efe4]"
        >
          from tree   x +0.00   z +0.00   laps ↻ 0.0/3 → autumn
        </p>
        <div
          ref={constellationLabelRef}
          role="tooltip"
          className="pointer-events-none absolute z-30 hidden rounded-full border border-blue-100/40 bg-slate-950/85 px-3 py-1.5 font-serif text-sm tracking-wide text-blue-50 shadow-lg shadow-blue-900/30 backdrop-blur-sm"
        />
        <div
          ref={vignetteRef}
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 52% 43%, transparent 35%, rgba(3, 10, 12, 0.12) 70%, rgba(2, 7, 9, 0.52) 120%)",
          }}
        />
        {showAscii && (
          <div className="absolute inset-0 z-40">
            <AsciiCube />
          </div>
        )}
      </div>
    </main>
  );
}
