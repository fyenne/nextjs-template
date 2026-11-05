const THREE = require("three");
const { buildTreeSnowGeometry } = require("./.snowcheck/snow-cap.js");
const { createCampfire } = require("./.snowcheck/campfire.js");

function fail(message) {
  throw new Error(message);
}

function tube(segments, radial, frame) {
  const stride = radial + 1;
  const pos = new Float32Array((segments + 1) * stride * 3);
  for (let i = 0; i <= segments; i += 1) {
    const t = segments === 0 ? 1 : i / segments;
    const { center, axisX, axisY, radius, lift } = frame(t);
    for (let j = 0; j <= radial; j += 1) {
      const theta = ((j % radial) / radial) * Math.PI * 2;
      const p = center
        .clone()
        .addScaledVector(axisX, Math.cos(theta) * radius)
        .addScaledVector(axisY, Math.sin(theta) * radius);
      if (lift) p.y += Math.cos(theta) * radius * lift;
      const idx = (i * stride + j) * 3;
      pos[idx] = p.x;
      pos[idx + 1] = p.y;
      pos[idx + 2] = p.z;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mesh = new THREE.Mesh(geometry);
  mesh.userData.tube = { segments, radial };
  return mesh;
}

function stats(geometry) {
  const pos = geometry.getAttribute("position");
  let min = new THREE.Vector3(Infinity, Infinity, Infinity);
  let max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < pos.count; i += 1) {
    min.x = Math.min(min.x, pos.getX(i));
    min.y = Math.min(min.y, pos.getY(i));
    min.z = Math.min(min.z, pos.getZ(i));
    max.x = Math.max(max.x, pos.getX(i));
    max.y = Math.max(max.y, pos.getY(i));
    max.z = Math.max(max.z, pos.getZ(i));
  }
  return { count: pos.count, min, max };
}

function meanNormalY(geometry) {
  const pos = geometry.getAttribute("position");
  const index = geometry.getIndex();
  if (!index) return { mean: 0, upShare: 0, crest: 0 };
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const ys = [];
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(pos, index.getX(i));
    b.fromBufferAttribute(pos, index.getX(i + 1));
    c.fromBufferAttribute(pos, index.getX(i + 2));
    n.crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (n.lengthSq() < 1e-12) continue;
    ys.push(n.normalize().y);
  }
  if (ys.length === 0) return { mean: 0, upShare: 0, crest: 0 };
  const mean = ys.reduce((sum, y) => sum + y, 0) / ys.length;
  const upShare = ys.filter((y) => y > 0).length / ys.length;
  const crest = ys.slice().sort((p, q) => q - p).slice(0, Math.max(1, Math.floor(ys.length * 0.2)));
  const crestMean = crest.reduce((sum, y) => sum + y, 0) / crest.length;
  return { mean, upShare, crest: crestMean };
}

// Monk local +Z, yaw -0.18, must match the sin/cos vector the page uses.
const monk = new THREE.Object3D();
monk.rotation.y = -0.18;
const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(monk.quaternion);
const expected = new THREE.Vector3(Math.sin(-0.18), 0, Math.cos(-0.18)).normalize();
if (fwd.distanceTo(expected) > 1e-4) fail(`monk forward ${fwd.toArray()} != ${expected.toArray()}`);

const fireX = 2.65 + fwd.x * 1.5;
const fireZ = 3.6 + fwd.z * 1.5;
if (fireZ < 3.6) fail("fire is behind the monk");
if (Math.hypot(fireX - 2.65, fireZ - 3.6) < 1.2) fail("fire sits inside the robe");

// Horizontal limb. Snow must sit on top and stay narrower than the wood.
const branch = tube(24, 10, (t) => ({
  center: new THREE.Vector3(1 + t * 4, 4, 0),
  axisX: new THREE.Vector3(0, 1, 0),
  axisY: new THREE.Vector3(0, 0, 1),
  radius: 0.25,
}));
const tree = new THREE.Group();
tree.add(branch);
const snow = buildTreeSnowGeometry(tree);
const wide = stats(snow.geometry);
console.log("horizontal", wide.count, "y", wide.min.y.toFixed(3), wide.max.y.toFixed(3), "z", wide.min.z.toFixed(3), wide.max.z.toFixed(3));
if (wide.count < 50) fail("horizontal branch produced no ridge");
const lateral = Math.max(Math.abs(wide.min.z), Math.abs(wide.max.z));
if (lateral > 0.25 * 0.7) fail(`snow is too wide: ${lateral} vs radius 0.25`);
if (lateral < 0.25 * 0.35) fail(`snow is missing a cap: ${lateral}`);
if (wide.min.y < 4.02) fail(`snow dropped beside the wood at y=${wide.min.y}`);
if (wide.max.y < 4.65) fail(`snow has no vertical body, max y=${wide.max.y}`);
const facing = meanNormalY(snow.geometry);
console.log("normals", facing.mean.toFixed(3), "upShare", facing.upShare.toFixed(3), "crest", facing.crest.toFixed(3));
if (facing.upShare < 0.95) fail(`ridge winding faces down on ${((1 - facing.upShare) * 100).toFixed(1)}% of faces`);
if (facing.crest < 0.8) fail(`crest does not face the sky, ny=${facing.crest}`);

// across × tangent for a +Z tangent is +Y. Pin the sign the loft uses.
const across = new THREE.Vector3(-1, 0, 0);
const tangent = new THREE.Vector3(0, 0, 1);
if (new THREE.Vector3().crossVectors(across, tangent).y < 0.99) fail("across × tangent is not +Y");

// Wrinkled vertical shaft must not grow a side fin.
const shaft = tube(32, 12, (t) => ({
  center: new THREE.Vector3(0, t * 10, 0),
  axisX: new THREE.Vector3(1, 0, 0),
  axisY: new THREE.Vector3(0, 0, 1),
  radius: 0.8,
  lift: 0.23,
}));
const shaftTree = new THREE.Group();
shaftTree.add(shaft);
const shaftSnow = buildTreeSnowGeometry(shaftTree);
const shaftStats = stats(shaftSnow.geometry);
console.log("shaft", shaftStats.count, "y", shaftStats.min.y.toFixed(3), shaftStats.max.y.toFixed(3));
if (!(shaftStats.count === 1 && Math.abs(shaftStats.max.y) < 1e-4)) {
  if (shaftStats.min.y < 9) fail(`vertical bark got snow down to y=${shaftStats.min.y}`);
}

// Branch leaving the trunk centerline must not bulge snow out of the bark.
const trunk = tube(20, 12, (t) => ({
  center: new THREE.Vector3(0, t * 8, 0),
  axisX: new THREE.Vector3(1, 0, 0),
  axisY: new THREE.Vector3(0, 0, 1),
  radius: 0.8,
}));
const limb = tube(16, 8, (t) => ({
  center: new THREE.Vector3(t * 3, 4, 0),
  axisX: new THREE.Vector3(0, 1, 0),
  axisY: new THREE.Vector3(0, 0, 1),
  radius: 0.2,
}));
const grown = new THREE.Group();
grown.add(trunk, limb);
const clipped = buildTreeSnowGeometry(grown);
const clip = stats(clipped.geometry);
console.log("clipped", clip.count, "x", clip.min.x.toFixed(3), clip.max.x.toFixed(3));
if (clip.count < 20) fail("emerged limb has no snow");
if (clip.min.x < 0.7) fail(`snow still inside the trunk at x=${clip.min.x}`);

// Campfire frame: unrotated group, flames stand on their base, logs lie flat, motion changes the flame.
const camp = createCampfire();
if (camp.group.rotation.y !== 0 || camp.group.rotation.x !== 0 || camp.group.rotation.z !== 0) fail("campfire group is rotated");
const cones = [];
const logs = [];
camp.group.traverse((object) => {
  if (!object.isMesh) return;
  if (object.geometry.type === "ConeGeometry") cones.push(object);
  if (object.geometry.type === "CylinderGeometry") logs.push(object);
});
if (cones.length < 5) fail(`expected dancing flames, found ${cones.length}`);
if (logs.length !== 4) fail(`expected 4 logs, found ${logs.length}`);
for (const cone of cones) {
  cone.geometry.computeBoundingBox();
  const box = cone.geometry.boundingBox;
  if (box.min.y < -0.02) fail(`flame base is at ${box.min.y}, not on the logs`);
  if (box.max.y < 0.4) fail("flame is too short to read");
  const tip = new THREE.Vector3(0, 1, 0).applyQuaternion(cone.quaternion);
  if (tip.y < 0.9) fail(`flame does not point up: ${tip.toArray()}`);
}
for (const log of logs) {
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(log.quaternion);
  if (Math.abs(axis.y) > 0.05) fail(`log is not lying flat: ${axis.toArray()}`);
}
const posed = cones[0].rotation.z;
const tall = cones[0].scale.y;
camp.update(0.37);
if (cones[0].rotation.z === posed && cones[0].scale.y === tall) fail("fire did not dance");
console.log("fire scale", tall.toFixed(3), "->", cones[0].scale.y.toFixed(3), "yaw group", camp.group.rotation.y);
console.log("ok");
