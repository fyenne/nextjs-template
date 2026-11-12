"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { QR_ASCII } from "@/components/ascii/qr-ascii";

const CODE_LENGTH = 11;
const GLYPHS =
  "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ:+-*<>|=";
const ATLAS_COLS = 10;
const ATLAS_ROWS = 10;
// Shine through this phrase one character at a time, then repeat. 5 and U occur twice.
const GOLD_ORDER = "BWV565FUGUE";
const BLINK_DELAY = 0.2;
const BLINK_HOLD = 0.5;
const ANSWER = "BWV565FUGUE";
const BIO_WORDS = [
  "Siming",
  "Yan",
  "Wisconsin",
  "Econometrics",
  "Python",
  "C++",
  "SQL",
  "PyTorch",
  "Piano",
  "Basketball",
  "Classical",
  "Quantitative",
  "Finance",
  "Futures",
  "Machine",
  "Learning",
  "Theory",
  "Bayesian",
  "Kalman",
  "Filter",
  "VMAP",
  "XGBoost",
  "LightGBM",
  "CatBoost",
  "TabPFN",
  "Transformer",
  "UNet",
  "Momentum",
  "Volatility",
  "RSI",
  "MACD",
  "Bollinger",
  "Sharpe",
  "Sortino",
  "Drawdown",
  "Alpha",
  "Beta",
  "VWAP",
  "TWAP",
  "Basis",
  "Contango",
  "Backwardation",
  "Carry",
  "Skew",
  "Kurtosis",
  "ZScore",
  "EMA",
  "SMA",
  "ATR",
  "OBV",
  "ADX",
  "Stochastic",
  "CCI",
  "ROC",
  "GARCH",
  "VaR",
  "CVaR",
  "Delta",
  "Gamma",
  "Vega",
  "Theta",
  "Rho",
  "ImpliedVol",
  "RealizedVol",
  "Parkinson",
  "Hurst",
  "Cointegration",
  "MeanReversion",
  "StatArb",
  "OrderFlow",
  "VPIN",
  "Microprice",
  "Spread",
  "Imbalance",
  "Funding",
  "OpenInterest",
  "TermStructure",
  "Factor",
  "FamaFrench",
  "Slippage",
  "Impact",
  "LSTM",
  "GRU",
  "Attention",
  "Ensemble",
  "TimeSeries",
  "Polars",
  "Pandas",
  "Spark",
  "Docker",
  "Airflow",
  "Redis",
  "LoRA",
  "Backtest",
  "WalkForward",
  "PurgedCV",
  "Turnover",
  "Neutralize",
  "Winsorize",
  "RankIC",
  "XGBoost",
  "LightGBM",
  "CatBoost",
  "TabPFN",
  "Transformer",
  "UNet",
  "Bayesian",
  "Kalman",
  "Futures",
  "VMAP",
  "Qlib",
  "Alphas",
  "Signal",
  "Horizon",
  "Decay",
  "QuantLib",
  "Features",
  "HalfLife",
  "YangZhang",
  "Amihud",
];
// Logarithmic arm: r = a e^(θ tan p), p = 15°. One turn grows by e^(2π tan p) ≈ 5.38.
const PITCH = (15 * Math.PI) / 180;
const TAN_P = Math.tan(PITCH);
const ARM_TURNS = 1.3;
const THETA_MAX = ARM_TURNS * Math.PI * 2;
const SPIRAL_OUTER = 22;
const ARM_LANES = 4;
const LANE_GAP = 0.78;

const COLS_X = 27;
const COLS_Z = 21;
const HEIGHT = 8.2;
const X_GAP = 0.32;
const Z_GAP = 0.4;
const STEP = 0.17;

function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function makeAtlas() {
  const cell = 64;
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_COLS * cell;
  canvas.height = ATLAS_ROWS * cell;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `52px "MS Gothic", "Yu Gothic", "Noto Sans JP", ui-monospace, monospace`;
  for (let i = 0; i < GLYPHS.length && i < ATLAS_COLS * ATLAS_ROWS; i += 1) {
    const col = i % ATLAS_COLS;
    const row = Math.floor(i / ATLAS_COLS);
    ctx.fillText(GLYPHS[i], col * cell + cell / 2, row * cell + cell / 2 + 2);
  }
  const atlas = new THREE.CanvasTexture(canvas);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.minFilter = THREE.LinearFilter;
  atlas.magFilter = THREE.LinearFilter;
  atlas.needsUpdate = true;
  return atlas;
}

export default function AsciiCube() {
  const mountRef = useRef<HTMLDivElement>(null);
  const turnRef = useRef<() => void>(() => {});
  const codeRef = useRef("");
  const solvedRef = useRef(false);
  const commitRef = useRef<(value: string) => void>(() => {});
  const [code, setCode] = useState("");
  const [solved, setSolved] = useState(false);
  const [hoverLink, setHoverLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const links = [
    { id: "github", label: "GitHub", value: "https://github.com/fyenne" },
    { id: "wechat", label: "WeChat", value: "fyenneyenn" },
    { id: "email", label: "Email", value: "fyenne@hotmail.com" },
  ];

  commitRef.current = (value: string) => {
    if (solvedRef.current) return;
    const next = value.replace(/[^a-zA-Z0-9]/g, "").slice(0, CODE_LENGTH);
    if (next === codeRef.current) return;
    codeRef.current = next;
    setCode(next);
    turnRef.current();
    if (next.toUpperCase() === ANSWER) {
      solvedRef.current = true;
      setSolved(true);
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (solvedRef.current) return;
      if (event.target instanceof HTMLInputElement) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Backspace") {
        commitRef.current(codeRef.current.slice(0, -1));
        event.preventDefault();
        return;
      }
      if (!/^[a-zA-Z0-9]$/.test(event.key) || codeRef.current.length >= CODE_LENGTH) return;
      commitRef.current(codeRef.current + event.key);
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    camera.position.set(0.8, 3.2, 50);
    camera.lookAt(0, 0, 0);

    const group = new THREE.Group();
    // Half-extent is about 41. The frame at this camera is about 32 wide on a
    // 16:9 screen and 18 tall, so the box runs off every edge. The camera stays
    // in front of the near face.
    group.scale.setScalar(10);
    scene.add(group);

    const halfX = ((COLS_X - 1) * X_GAP) / 2;
    const halfZ = ((COLS_Z - 1) * Z_GAP) / 2;
    const box = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry((COLS_X - 1) * X_GAP + 0.8, HEIGHT, (COLS_Z - 1) * Z_GAP + 0.8)),
      new THREE.LineBasicMaterial({ color: 0x143d22, transparent: true, opacity: 0.45 }),
    );
    group.add(box);

    type Stamp = {
      x: number;
      z: number;
      index: number;
      len: number;
      speed: number;
      phase: number;
      seed: number;
      theta: number;
      letter: number;
      arm: number;
    };
    const stamps: Stamp[] = [];
    let column = 0;
    for (let ix = 0; ix < COLS_X; ix += 1) {
      for (let iz = 0; iz < COLS_Z; iz += 1) {
        column += 1;
        const roll = hash(column * 19.1);
        if (roll < 0.06) continue;
        const len = 20 + Math.floor(hash(column * 3.7) * 16);
        const speed = 0.04 + hash(column * 11.3) * 0.11;
        const phase = hash(column * 5.9);
        for (let row = 0; row < len; row += 1) {
          stamps.push({
            x: ix * X_GAP - halfX,
            z: iz * Z_GAP - halfZ,
            index: row,
            len,
            speed,
            phase,
            seed: hash(column * 40.2 + row * 2.3),
            theta: 0,
            letter: 0,
            arm: 0,
          });
        }
      }
    }

    const geometry = new THREE.PlaneGeometry(1, 1);
    const indexAttr = new Float32Array(stamps.length);
    const lenAttr = new Float32Array(stamps.length);
    const speedAttr = new Float32Array(stamps.length);
    const phaseAttr = new Float32Array(stamps.length);
    const seedAttr = new Float32Array(stamps.length);
    const anchorAttr = new Float32Array(stamps.length * 3);
    const thetaAttr = new Float32Array(stamps.length);
    const letterAttr = new Float32Array(stamps.length);
    const armAttr = new Float32Array(stamps.length);
    stamps.forEach((stamp, i) => {
      indexAttr[i] = stamp.index;
      lenAttr[i] = stamp.len;
      speedAttr[i] = stamp.speed;
      phaseAttr[i] = stamp.phase;
      seedAttr[i] = stamp.seed;
      anchorAttr[i * 3] = stamp.x;
      anchorAttr[i * 3 + 1] = 0;
      anchorAttr[i * 3 + 2] = stamp.z;
      thetaAttr[i] = stamp.theta;
      letterAttr[i] = stamp.letter;
      armAttr[i] = stamp.arm;
    });
    geometry.setAttribute("aIndex", new THREE.InstancedBufferAttribute(indexAttr, 1));
    geometry.setAttribute("aLen", new THREE.InstancedBufferAttribute(lenAttr, 1));
    geometry.setAttribute("aSpeed", new THREE.InstancedBufferAttribute(speedAttr, 1));
    geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phaseAttr, 1));
    geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seedAttr, 1));
    geometry.setAttribute("aAnchor", new THREE.InstancedBufferAttribute(anchorAttr, 3));
    geometry.setAttribute("aTheta", new THREE.InstancedBufferAttribute(thetaAttr, 1));
    geometry.setAttribute("aLetter", new THREE.InstancedBufferAttribute(letterAttr, 1));
    geometry.setAttribute("aArm", new THREE.InstancedBufferAttribute(armAttr, 1));

    const glyphCount = Math.min(GLYPHS.length, ATLAS_COLS * ATLAS_ROWS);
    const goldGlyphs = GOLD_ORDER.split("").map((char) => GLYPHS.indexOf(char));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      uniforms: {
        uAtlas: { value: makeAtlas() },
        uTime: { value: 0 },
        uHeight: { value: HEIGHT },
        uStep: { value: STEP },
        uSize: { value: 0.45 },
        uGlyphCount: { value: glyphCount },
        uAtlasCols: { value: ATLAS_COLS },
        uAtlasRows: { value: ATLAS_ROWS },
        uActiveGlyph: { value: -1 },
        uGalaxy: { value: 0 },
        uFlow: { value: 0 },
        uSpiralA: { value: 0.9 },
        uTanPitch: { value: TAN_P },
        uThetaMax: { value: THETA_MAX },
      },
      vertexShader: `
        attribute float aIndex;
        attribute float aLen;
        attribute float aSpeed;
        attribute float aPhase;
        attribute float aSeed;
        attribute vec3 aAnchor;
        attribute float aTheta;
        attribute float aLetter;
        attribute float aArm;
        uniform float uTime;
        uniform float uHeight;
        uniform float uStep;
        uniform float uSize;
        uniform float uGlyphCount;
        uniform float uAtlasCols;
        uniform float uAtlasRows;
        uniform float uGalaxy;
        uniform float uFlow;
        uniform float uSpiralA;
        uniform float uTanPitch;
        uniform float uThetaMax;
        varying vec2 vUv;
        varying float vAlong;
        varying float vGlyph;
        varying float vFade;

        void main() {
          float travel = fract(aPhase + uTime * aSpeed);
          float y = uHeight * (0.5 - travel) - aIndex * uStep;
          y = mod(y + uHeight * 0.5, uHeight) - uHeight * 0.5;
          vec3 rainPos = vec3(aAnchor.x, y, aAnchor.z);
          float theta = mod(aTheta + uFlow, uThetaMax);
          float rad = uSpiralA * exp(theta * uTanPitch);
          vec3 galaxyPos = vec3(cos(theta) * rad, sin(theta) * rad, (aSeed - 0.5) * 0.45);
          vec3 local = aArm > 0.5 ? mix(rainPos, galaxyPos, uGalaxy) : rainPos;
          vec4 viewPos = modelViewMatrix * instanceMatrix * vec4(local, 1.0);
          float sway = sin(uTime * 0.7 + aSeed * 12.0) * 0.07;
          float cs = cos(sway);
          float sn = sin(sway);
          vec2 spun = vec2(position.x * cs - position.y * sn, position.x * sn + position.y * cs);
          viewPos.xy += spun * uSize;
          gl_Position = projectionMatrix * viewPos;

          vAlong = aIndex / max(aLen - 1.0, 1.0);
          vFade = 1.0;
          float streamed = mod(floor(aSeed * 80.0 + aIndex * 3.0 + travel * aLen), uGlyphCount);
          vGlyph = aArm > 0.5 && uGalaxy > 0.35 ? aLetter : streamed;
          float col = mod(vGlyph, uAtlasCols);
          float row = floor(vGlyph / uAtlasCols);
          vUv = vec2(
            (col + uv.x) / uAtlasCols,
            1.0 - (row + 1.0 - uv.y) / uAtlasRows
          );
        }
      `,
      fragmentShader: `
        uniform sampler2D uAtlas;
        uniform float uActiveGlyph;
        varying vec2 vUv;
        varying float vAlong;
        varying float vGlyph;
        varying float vFade;

        void main() {
          if (vFade < 0.03) discard;
          vec4 ink = texture2D(uAtlas, vUv);
          if (ink.a < 0.12) discard;
          float trail = pow(1.0 - vAlong, 1.55);
          float head = smoothstep(0.28, 0.0, vAlong);
          vec3 body = vec3(0.12, 0.78, 0.34);
          vec3 hot = vec3(0.86, 1.0, 0.9);
          vec3 color = mix(body * trail, hot, head);
          float alpha = ink.a * (0.18 + 0.82 * trail) * vFade;
          float goldOn = uActiveGlyph >= 0.0 && abs(vGlyph - uActiveGlyph) < 0.5 ? 1.0 : 0.0;
          vec3 gold = vec3(1.0, 0.74, 0.16);
          color = mix(color, gold, goldOn);
          alpha = max(alpha, goldOn * ink.a);
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });

    const rain = new THREE.InstancedMesh(geometry, material, stamps.length);
    rain.frustumCulled = false;
    const identity = new THREE.Matrix4();
    for (let i = 0; i < stamps.length; i += 1) rain.setMatrixAt(i, identity);
    rain.instanceMatrix.needsUpdate = true;
    group.add(rain);

    const growth = Math.exp(TAN_P * THETA_MAX);
    const spiralA = SPIRAL_OUTER / growth;
    const arcScale = (spiralA * Math.hypot(1, TAN_P)) / TAN_P;
    const arcMax = arcScale * (growth - 1);
    const makeLabel = (text: string, fontPx: number) => {
      const measure = document.createElement("canvas").getContext("2d");
      if (!measure) throw new Error("No canvas context");
      measure.font = `${fontPx}px ui-monospace, "Cascadia Mono", Consolas, monospace`;
      const width = Math.ceil(measure.measureText(text).width + fontPx);
      const height = Math.ceil(fontPx * 1.55);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No canvas context");
      ctx.clearRect(0, 0, width, height);
      ctx.font = measure.font;
      ctx.fillStyle = "#3dff7a";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, width / 2, height / 2);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      return { texture, aspect: width / height };
    };
    const charW = 0.34;
    const minGap = 0.85;
    const lanes: number[][] = Array.from({ length: ARM_LANES }, () => []);
    BIO_WORDS.forEach((_, index) => lanes[index % ARM_LANES].push(index));
    const laneBudgets = lanes.map((lane) => {
      const text = lane.reduce((sum, index) => sum + Math.max(0.7, BIO_WORDS[index].length * charW), 0);
      return text + minGap * lane.length;
    });
    const laneFit = Math.min(1, (arcMax * 0.9) / Math.max(...laneBudgets));
    const galaxyGroup = new THREE.Group();
    galaxyGroup.rotation.x = 0.16;
    scene.add(galaxyGroup);
    const armWords: { mesh: THREE.Mesh; s0: number; lane: number }[] = [];
    const wordTextures: THREE.Texture[] = [];
    lanes.forEach((lane, laneIndex) => {
      const widths = lane.map((index) => Math.max(0.7, BIO_WORDS[index].length * charW) * laneFit);
      const gap = (arcMax * 0.9 - widths.reduce((sum, width) => sum + width, 0)) / lane.length;
      let along = gap * 0.5;
      lane.forEach((wordIndex, order) => {
        const label = makeLabel(BIO_WORDS[wordIndex], 72);
        wordTextures.push(label.texture);
        const width = widths[order];
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(width, 0.62 * laneFit),
          new THREE.MeshBasicMaterial({
            map: label.texture,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            toneMapped: false,
          }),
        );
        galaxyGroup.add(mesh);
        armWords.push({ mesh, s0: along + width * 0.5, lane: laneIndex });
        along += width + gap;
      });
    });
    const thanksLabel = makeLabel("Thank you for playing", 72);
    wordTextures.push(thanksLabel.texture);
    const thanks = new THREE.Mesh(
      new THREE.PlaneGeometry(thanksLabel.aspect * 1.2, 1.2),
      new THREE.MeshBasicMaterial({
        map: thanksLabel.texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    thanks.position.set(0, 0, 1.6);
    scene.add(thanks);
    const placeWord = (mesh: THREE.Mesh, distance: number, lane: number) => {
      const theta = Math.log(1 + distance / arcScale) / TAN_P;
      const rad = spiralA * Math.exp(theta * TAN_P);
      const tx = TAN_P * Math.cos(theta) - Math.sin(theta);
      const ty = TAN_P * Math.sin(theta) + Math.cos(theta);
      const length = Math.hypot(tx, ty) || 1;
      const offset = (lane - (ARM_LANES - 1) / 2) * LANE_GAP;
      mesh.position.set(
        Math.cos(theta) * rad + (-ty / length) * offset,
        Math.sin(theta) * rad + (tx / length) * offset,
        0,
      );
      let angle = Math.atan2(ty, tx);
      if (tx < 0) angle += Math.PI;
      mesh.rotation.z = angle;
    };

    const spin = {
      from: new THREE.Quaternion(),
      to: new THREE.Quaternion(),
      t: 1,
    };
    const axes = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)];
    let turns = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let galaxy = 0;
    turnRef.current = () => {
      if (solvedRef.current) return;
      const axis = axes[turns % axes.length];
      const dir = turns % 2 === 0 ? 1 : -1;
      const step = new THREE.Quaternion().setFromAxisAngle(axis, dir * Math.PI * 0.5);
      spin.from.copy(group.quaternion);
      spin.to.multiply(step);
      spin.t = reduceMotion ? 1 : 0;
      if (reduceMotion) group.quaternion.copy(spin.to);
      turns += 1;
    };

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let frame = 0;
    let last = performance.now();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;
      const seconds = now / 1000;
      material.uniforms.uTime.value = seconds;
      const step = BLINK_DELAY + BLINK_HOLD;
      const cursor = seconds % (goldGlyphs.length * step);
      const goldIndex = Math.floor(cursor / step);
      const into = cursor - goldIndex * step;
      material.uniforms.uActiveGlyph.value = into >= BLINK_DELAY ? goldGlyphs[goldIndex] : -1;
      if (solvedRef.current) {
        galaxy = Math.min(1, galaxy + delta / 2.4);
      } else if (spin.t < 1) {
        spin.t = Math.min(1, spin.t + delta / 0.62);
        group.quaternion.copy(spin.from).slerp(spin.to, easeInOutCubic(spin.t));
      }
      material.uniforms.uGalaxy.value = galaxy;
      material.uniforms.uFlow.value = seconds * (THETA_MAX / 26);
      const drift = (seconds * arcMax) / 42;
      for (const word of armWords) {
        placeWord(word.mesh, (word.s0 + drift) % arcMax, word.lane);
        (word.mesh.material as THREE.MeshBasicMaterial).opacity = galaxy;
      }
      (thanks.material as THREE.MeshBasicMaterial).opacity = galaxy;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      geometry.dispose();
      material.uniforms.uAtlas.value.dispose();
      material.dispose();
      for (const word of armWords) {
        word.mesh.geometry.dispose();
        (word.mesh.material as THREE.Material).dispose();
      }
      thanks.geometry.dispose();
      (thanks.material as THREE.Material).dispose();
      for (const texture of wordTextures) texture.dispose();
      box.geometry.dispose();
      (box.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const onChange = (value: string) => {
    commitRef.current(value);
  };

  return (
    <div className="fixed inset-0 touch-none bg-black text-[#b8ffc9]">
      <div ref={mountRef} className="absolute inset-0" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.72) 100%)" }}
      />
      {solved && (
        <aside className="absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(3.5rem,env(safe-area-inset-top))] z-10 max-w-[46vw] text-[#3dff7a]">
          <p className="mb-1 font-mono text-[10px] tracking-[0.22em]">buy me a thousand token</p>
          <pre className="m-0 overflow-hidden font-mono text-[6px] leading-none sm:text-[7px]">{QR_ASCII}</pre>
        </aside>
      )}
      {solved && (
        <div className="absolute left-1/2 top-[60%] z-10 flex -translate-x-1/2 gap-3">
          {links.map((item) => (
            <button
              key={item.id}
              type="button"
              onMouseEnter={() => setHoverLink(item.id)}
              onMouseLeave={() => setHoverLink(null)}
              onPointerDown={() => setHoverLink(item.id)}
              onFocus={() => setHoverLink(item.id)}
              onBlur={() => setHoverLink(null)}
              onClick={() => {
                void navigator.clipboard.writeText(item.value);
                setCopiedLink(item.id);
                window.setTimeout(() => setCopiedLink((current) => (current === item.id ? null : current)), 1400);
              }}
              className="relative min-h-11 touch-manipulation border border-[#3dff7a] bg-black/75 px-3 py-2 font-mono text-xs tracking-[0.2em] text-[#3dff7a]"
            >
              {item.label}
              {hoverLink === item.id && (
                <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap border border-[#1f8f45] bg-black px-2 py-1 text-[10px] tracking-normal text-[#b8ffc9]">
                  {copiedLink === item.id ? "copied" : item.value}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <form
        className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-4 pb-[max(2rem,env(safe-area-inset-bottom))]"
        onSubmit={(event) => event.preventDefault()}
      >
        <p className="font-mono text-xs tracking-[0.35em] text-[#1f8f45]">
          {solved ? "pitch 15°" : "11 letters or numbers"}
        </p>
        <label className="relative">
          <span className="sr-only">Eleven character code</span>
          <input
            autoFocus
            inputMode="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={CODE_LENGTH}
            value={code}
            readOnly={solved}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 cursor-text text-base opacity-0"
            aria-label="Eleven character code"
          />
          <span className="flex justify-center gap-1.5 sm:gap-2">
            {Array.from({ length: CODE_LENGTH }, (_, index) => {
              const filled = code[index] ?? "";
              const active = index === code.length && code.length < CODE_LENGTH;
              return (
                <span
                  key={index}
                  className="flex items-center justify-center border font-mono text-lg sm:text-2xl"
                  style={{
                    width: "clamp(28px, 6.2vw, 46px)",
                    height: "clamp(40px, 8vw, 58px)",
                    borderColor: active ? "#8dffb0" : "rgba(80, 200, 120, 0.38)",
                    background: "rgba(0, 0, 0, 0.45)",
                    boxShadow: active ? "0 0 12px rgba(80, 255, 140, 0.35)" : "none",
                  }}
                >
                  {filled}
                </span>
              );
            })}
          </span>
        </label>
      </form>
    </div>
  );
}
