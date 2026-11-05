"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTreeSnowGeometry = buildTreeSnowGeometry;
const THREE = __importStar(require("three"));
/**
 * Narrow snow ridge along the top of each limb.
 * The footprint stays well inside the wood so the bark shows on the sides.
 * Height is the gathered column. Do not widen this to bury the branch:
 * a fat coat is what read as stacked blobs.
 */
const SNOW_UP = new THREE.Vector3(0, 1, 0);
const SNOW_COLS = 13;
function smoothSeries(values, radius) {
    const out = new Array(values.length);
    for (let i = 0; i < values.length; i += 1) {
        let acc = 0;
        let wsum = 0;
        const span = Math.max(0, Math.min(radius, values.length - 1));
        for (let k = -span; k <= span; k += 1) {
            const j = Math.min(values.length - 1, Math.max(0, i + k));
            const w = span + 1 - Math.abs(k);
            acc += values[j] * w;
            wsum += w;
        }
        out[i] = acc / wsum;
    }
    return out;
}
function readSnowRings(mesh, segments, radial) {
    const position = mesh.geometry.getAttribute("position");
    const stride = radial + 1;
    const rings = [];
    const v = new THREE.Vector3();
    for (let i = 0; i <= segments; i += 1) {
        const spine = new THREE.Vector3();
        const ridge = new THREE.Vector3();
        let bestUp = -Infinity;
        for (let j = 0; j < radial; j += 1) {
            v.fromBufferAttribute(position, i * stride + j).applyMatrix4(mesh.matrixWorld);
            spine.add(v);
        }
        spine.multiplyScalar(1 / radial);
        for (let j = 0; j < radial; j += 1) {
            v.fromBufferAttribute(position, i * stride + j).applyMatrix4(mesh.matrixWorld);
            const rise = v.y - spine.y;
            if (rise > bestUp) {
                bestUp = rise;
                ridge.copy(v);
            }
        }
        const radius = Math.max(0.001, ridge.distanceTo(spine));
        rings.push({
            spine,
            ridge,
            radius,
            up: THREE.MathUtils.clamp(bestUp / radius, 0, 1),
            t: segments === 0 ? 1 : i / segments,
            index: i,
        });
    }
    return rings;
}
/**
 * Width stays near half the wood, so bark shows on both sides.
 * Height is the pile: taller than the footprint, not a side coat.
 */
function capSize(radius, t) {
    const node = Math.exp(-t * 5) + Math.exp(-(1 - t) * 4);
    const halfWidth = Math.max(0.022, radius * 0.5) * (1 + 0.05 * node);
    const height = Math.max(halfWidth * 3.6, radius * 1.8, 0.07) * (1 + 0.2 * node);
    const embed = Math.min(halfWidth * 0.42, radius * 0.22 + 0.012);
    return { halfWidth, height, embed };
}
/**
 * Horizontal axis across the branch: tangent × world up.
 * For tangent (0, 0, 1) this is (-1, 0, 0). across × tangent is +Y.
 */
function horizontalAcross(tangent, previous) {
    const ax = -tangent.z;
    const az = tangent.x;
    const len = Math.hypot(ax, az);
    const across = new THREE.Vector3();
    if (len < 1e-4) {
        if (previous)
            across.copy(previous);
        else
            across.set(1, 0, 0);
    }
    else {
        across.set(ax / len, 0, az / len);
        if (previous && across.dot(previous) < 0)
            across.negate();
    }
    return across;
}
function ringKeepsSnow(ring, segments) {
    const tipZone = ring.index >= segments - 2;
    // Thick vertical bark stays bare. A sky-facing shoulder may hold a cap.
    if (ring.radius > 0.42) {
        if (ring.up > 0.7)
            return true;
        return tipZone && ring.radius < 0.62;
    }
    // A vertical twig only wears snow on its end, not as a side stripe.
    if (ring.up < 0.28)
        return tipZone;
    return true;
}
function insideTrunk(spine, samples) {
    let best = Infinity;
    let radius = 0;
    for (let i = 0; i < samples.length; i += 1) {
        const s = samples[i];
        const dx = spine.x - s.x;
        const dy = spine.y - s.y;
        const dz = spine.z - s.z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < best) {
            best = d;
            radius = s.radius;
        }
    }
    const limit = radius * 1.05;
    return best < limit * limit;
}
function appendLoft(rings, reachTip, positions, colors, finalY, sink, indices) {
    const n = rings.length;
    if (n < 2)
        return;
    const tangents = [];
    for (let i = 0; i < n; i += 1) {
        const prev = rings[Math.max(0, i - 1)].spine;
        const next = rings[Math.min(n - 1, i + 1)].spine;
        const tangent = next.clone().sub(prev);
        if (tangent.lengthSq() < 1e-8)
            tangent.copy(SNOW_UP);
        else
            tangent.normalize();
        tangents.push(tangent);
    }
    let previous = null;
    const across = [];
    for (let i = 0; i < n; i += 1) {
        const axis = horizontalAcross(tangents[i], previous);
        across.push(axis);
        previous = axis;
    }
    const sized = rings.map((ring) => capSize(ring.radius, ring.t));
    const wave = rings.map((ring, i) => 0.9 + 0.1 * Math.sin(ring.t * 19 + ring.radius * 70 + i * 0.15));
    const height = smoothSeries(sized.map((size, i) => size.height * wave[i]), 2);
    const halfWidth = smoothSeries(sized.map((size) => size.halfWidth), 2);
    const embed = smoothSeries(sized.map((size) => size.embed), 1);
    const ridgeX = smoothSeries(rings.map((ring) => ring.ridge.x), 1);
    const ridgeY = smoothSeries(rings.map((ring) => ring.ridge.y), 1);
    const ridgeZ = smoothSeries(rings.map((ring) => ring.ridge.z), 1);
    const stations = [];
    for (let i = 0; i < n; i += 1) {
        const drift = Math.sin(rings[i].t * 11 + rings[i].radius * 40) * halfWidth[i] * 0.05;
        stations.push({
            ridge: new THREE.Vector3(ridgeX[i] + across[i].x * drift, ridgeY[i], ridgeZ[i] + across[i].z * drift),
            across: across[i],
            halfWidth: halfWidth[i],
            height: height[i],
            embed: embed[i],
        });
    }
    if (reachTip) {
        const last = stations[stations.length - 1];
        const tangent = tangents[n - 1];
        for (let step = 1; step <= 2; step += 1) {
            const dist = last.halfWidth * (0.85 + step * 0.7);
            const ridge = last.ridge.clone().addScaledVector(tangent, dist);
            // Snow stays on top of the tip. It does not droop into a hanging bud.
            if (ridge.y < last.ridge.y)
                ridge.y = last.ridge.y;
            stations.push({
                ridge,
                across: last.across,
                halfWidth: last.halfWidth * (step === 1 ? 0.48 : 0.16),
                height: last.height * (step === 1 ? 0.7 : 0.32),
                embed: last.embed * 0.6,
            });
        }
    }
    const crest = new THREE.Color("#f7fbff");
    const edge = new THREE.Color("#e4edf5");
    const tint = 0.96 + 0.04 * Math.abs(Math.sin(rings[0].spine.x * 12.1 + rings[0].spine.z * 7.3));
    const base = positions.length / 3;
    for (let i = 0; i < stations.length; i += 1) {
        const station = stations[i];
        for (let col = 0; col < SNOW_COLS; col += 1) {
            const x = (col / (SNOW_COLS - 1)) * 2 - 1;
            // A round mound, pinched to the wood at the edges. Not a box and not a knife edge.
            const lift = Math.sqrt(Math.max(0, 1 - x * x));
            const y = station.ridge.y - station.embed * (1 - lift) + station.height * lift;
            positions.push(station.ridge.x + station.across.x * x * station.halfWidth, y, station.ridge.z + station.across.z * x * station.halfWidth);
            const color = edge.clone().lerp(crest, 0.28 + 0.72 * lift);
            colors.push(color.r * tint, color.g * tint, color.b * tint);
            finalY.push(y);
            sink.push(station.height * lift);
        }
    }
    for (let i = 0; i < stations.length - 1; i += 1) {
        for (let col = 0; col < SNOW_COLS - 1; col += 1) {
            const a = base + i * SNOW_COLS + col;
            const b = a + 1;
            const c = a + SNOW_COLS;
            const d = c + 1;
            // a → b is +across, a → c is +tangent, so the normal is +Y.
            indices.push(a, b, c, b, d, c);
        }
    }
}
function buildTreeSnowGeometry(tree) {
    tree.updateMatrixWorld(true);
    const tubes = [];
    tree.traverse((object) => {
        const mesh = object;
        if (!mesh.isMesh)
            return;
        const tube = mesh.userData.tube;
        if (!tube)
            return;
        const position = mesh.geometry.getAttribute("position");
        const stride = tube.radial + 1;
        if (!position || position.count < (tube.segments + 1) * stride)
            return;
        tubes.push({ segments: tube.segments, rings: readSnowRings(mesh, tube.segments, tube.radial) });
    });
    let trunk = -1;
    let trunkRadius = -1;
    tubes.forEach((tube, index) => {
        let maxR = 0;
        for (let i = 0; i < tube.rings.length; i += 1)
            maxR = Math.max(maxR, tube.rings[i].radius);
        if (maxR > trunkRadius) {
            trunkRadius = maxR;
            trunk = index;
        }
    });
    const samples = [];
    if (trunk >= 0) {
        tubes[trunk].rings.forEach((ring) => {
            samples.push({ x: ring.spine.x, y: ring.spine.y, z: ring.spine.z, radius: ring.radius });
        });
    }
    const positions = [];
    const colors = [];
    const finalY = [];
    const sink = [];
    const indices = [];
    tubes.forEach((tube, tubeIndex) => {
        let maxY = -Infinity;
        for (let i = 0; i < tube.rings.length; i += 1)
            maxY = Math.max(maxY, tube.rings[i].spine.y);
        // Roots sit in the ground snow. A ridge on them reads as a white worm.
        if (maxY < 1.15)
            return;
        const isTrunk = tubeIndex === trunk;
        const start = tube.rings[0]?.spine;
        const rootLimit = !isTrunk && tube.rings[0] && tube.rings[0].radius < 0.14 ? Math.max(0.26, tube.rings[0].radius * 4) : 0;
        const keep = tube.rings.map((ring) => {
            if (!ringKeepsSnow(ring, tube.segments))
                return false;
            const tipZone = ring.index >= tube.segments - 2;
            if (!isTrunk && samples.length > 0 && insideTrunk(ring.spine, samples))
                return false;
            if (rootLimit > 0 && start && !tipZone && ring.spine.distanceTo(start) < rootLimit)
                return false;
            return true;
        });
        for (let i = 1; i < keep.length - 1; i += 1) {
            const ring = tube.rings[i];
            if (!keep[i] && keep[i - 1] && keep[i + 1] && ring.radius <= 0.42 && ring.up >= 0.28)
                keep[i] = true;
        }
        let run = [];
        let runTip = false;
        const flush = () => {
            if (run.length >= 2)
                appendLoft(run, runTip, positions, colors, finalY, sink, indices);
            run = [];
            runTip = false;
        };
        for (let i = 0; i < keep.length; i += 1) {
            if (keep[i]) {
                run.push(tube.rings[i]);
                if (i === tube.segments)
                    runTip = true;
            }
            else
                flush();
        }
        flush();
    });
    const geometry = new THREE.BufferGeometry();
    if (positions.length === 0) {
        geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
        geometry.setAttribute("color", new THREE.Float32BufferAttribute([1, 1, 1], 3));
        return { geometry, finalY: new Float32Array([0]), sink: new Float32Array([0]) };
    }
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const vertexCount = positions.length / 3;
    geometry.setIndex(new THREE.BufferAttribute(vertexCount > 65535 ? new Uint32Array(indices) : new Uint16Array(indices), 1));
    geometry.computeVertexNormals();
    return { geometry, finalY: Float32Array.from(finalY), sink: Float32Array.from(sink) };
}
