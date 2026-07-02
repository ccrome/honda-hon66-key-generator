import initOpenCascade from "replicad-opencascadejs";
import wasmUrl from "replicad-opencascadejs/src/replicad_single.wasm?url";
import { setOC, type Shape3D } from "replicad";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./styles.css";
import {
  buildHon66Key,
  defaultParams,
  formatBitting,
  parseBitting,
  type HandleType,
  type Hon66Params,
} from "./hon66Model";

type OpenCascadeInit = (config?: { locateFile?: (path: string) => string }) => Promise<unknown>;

function requireElement<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing UI element: ${selector}`);
  }
  return element;
}

const app = requireElement<HTMLDivElement>("#app");

app.innerHTML = `
  <div class="app-shell">
    <aside class="controls">
      <header>
        <h1>Honda HON66 Key Generator</h1>
        <a class="repo-link" href="https://github.com/ccrome/honda-hon66-key-generator" target="_blank" rel="noreferrer">GitHub repository</a>
      </header>

      <form id="params-form" class="form" novalidate>
        <label>
          <span>A bitting</span>
          <input id="cut-a" name="cutA" inputmode="numeric" pattern="[1-6]{6}" maxlength="6" value="${formatBitting(defaultParams.cutA)}" />
        </label>
        <label>
          <span>B bitting</span>
          <input id="cut-b" name="cutB" inputmode="numeric" pattern="[1-6]{6}" maxlength="6" value="${formatBitting(defaultParams.cutB)}" />
        </label>
        <label>
          <span>Handle</span>
          <select id="handle-type" name="handleType">
            <option value="keyless" ${defaultParams.handleType === "keyless" ? "selected" : ""}>Keyless</option>
            <option value="octagonal" ${defaultParams.handleType === "octagonal" ? "selected" : ""}>Octagonal bow</option>
          </select>
        </label>
      </form>

      <div class="actions">
        <button id="export-step" type="button" disabled>Export STEP</button>
        <button id="export-stl" type="button" disabled>Export STL</button>
      </div>

      <dl class="readout">
        <div>
          <dt>Status</dt>
          <dd id="status">Loading CAD kernel...</dd>
        </div>
        <div>
          <dt>Engine</dt>
          <dd>replicad / OpenCascade WASM</dd>
        </div>
      </dl>

      <p class="privacy-note">Runs entirely in your browser. No key data is stored locally or sent to a server. For extra privacy, use an incognito or private window.</p>
      <p class="warning-note">Warning: this is a generated model, not a guaranteed working key. A printed or machined part can break in use, especially in an ignition cylinder, and a broken piece can create expensive removal or repair costs. Do not use this on an ignition or any other critical lock without verifying fit, strength, and safe removal first.</p>
    </aside>

    <section class="viewer-panel">
      <div id="viewer" class="viewer"></div>
    </section>
  </div>
`;

const form = requireElement<HTMLFormElement>("#params-form");
const cutAInput = requireElement<HTMLInputElement>("#cut-a");
const cutBInput = requireElement<HTMLInputElement>("#cut-b");
const handleTypeInput = requireElement<HTMLSelectElement>("#handle-type");
const statusNode = requireElement<HTMLElement>("#status");
const stepButton = requireElement<HTMLButtonElement>("#export-step");
const stlButton = requireElement<HTMLButtonElement>("#export-stl");
const viewerNode = requireElement<HTMLDivElement>("#viewer");

let currentShape: Shape3D | null = null;
let currentParams: Hon66Params = defaultParams;
let currentMesh: THREE.Mesh | null = null;
let currentEdges: THREE.LineSegments | null = null;
let rebuildGeneration = 0;
let rebuildTimer = 0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3f5f7);

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
camera.position.set(58, -48, 34);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
viewerNode.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(20, 0, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x6f7b86, 1.9));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
keyLight.position.set(18, -28, 42);
scene.add(keyLight);

const grid = new THREE.GridHelper(70, 14, 0xc5ccd3, 0xe0e4e8);
grid.rotation.x = Math.PI / 2;
grid.position.z = -2.2;
scene.add(grid);

function setStatus(text: string) {
  statusNode.textContent = text;
}

function resizeRenderer() {
  const rect = viewerNode.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}

function shapeToGeometry(shape: Shape3D) {
  const mesh = shape.mesh({ tolerance: 0.04, angularTolerance: 0.25 });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(mesh.vertices, 3));
  geometry.setIndex(mesh.triangles);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

function updatePreview(shape: Shape3D) {
  currentMesh?.geometry.dispose();
  currentMesh?.removeFromParent();
  currentEdges?.geometry.dispose();
  currentEdges?.removeFromParent();

  const geometry = shapeToGeometry(shape);
  currentMesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0xb8c4cf,
      metalness: 0.25,
      roughness: 0.48,
    }),
  );
  scene.add(currentMesh);

  currentEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 18),
    new THREE.LineBasicMaterial({ color: 0x2d3741, transparent: true, opacity: 0.22 }),
  );
  scene.add(currentEdges);

  const box = geometry.boundingBox;
  if (box) {
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    controls.target.copy(center);
    const maxSize = Math.max(size.x, size.y, size.z);
    camera.position.set(center.x + maxSize * 1.1, center.y - maxSize * 1.0, center.z + maxSize * 0.65);
    camera.near = Math.max(0.01, maxSize / 1000);
    camera.far = maxSize * 20;
    camera.updateProjectionMatrix();
    controls.update();
  }
}

function readParams(): Hon66Params {
  return {
    cutA: parseBitting(cutAInput.value),
    cutB: parseBitting(cutBInput.value),
    handleType: handleTypeInput.value as HandleType,
  };
}

async function rebuild() {
  const requestId = ++rebuildGeneration;
  setStatus("Generating model...");
  stepButton.disabled = true;
  stlButton.disabled = true;

  await new Promise((resolve) => window.setTimeout(resolve, 0));
  currentParams = readParams();
  currentShape = buildHon66Key(currentParams);
  if (requestId !== rebuildGeneration) return;
  updatePreview(currentShape);

  stepButton.disabled = false;
  stlButton.disabled = false;
  const handleLabel = currentParams.handleType === "octagonal" ? "octagonal bow" : "keyless";
  setStatus(`Ready: A${formatBitting(currentParams.cutA)} B${formatBitting(currentParams.cutB)}, ${handleLabel}`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportCurrent(kind: "step" | "stl") {
  if (!currentShape) return;
  const bitting = `${formatBitting(currentParams.cutA)}_${formatBitting(currentParams.cutB)}_${currentParams.handleType}`;
  const blob = kind === "step"
    ? currentShape.blobSTEP()
    : currentShape.blobSTL({ tolerance: 0.03, angularTolerance: 0.2, binary: true });

  downloadBlob(blob, `hon66_${bitting}.${kind === "step" ? "step" : "stl"}`);
}

function scheduleRebuild() {
  window.clearTimeout(rebuildTimer);
  rebuildTimer = window.setTimeout(() => {
    rebuild().catch((error: unknown) => {
      stepButton.disabled = true;
      stlButton.disabled = true;
      setStatus(error instanceof Error ? error.message : "Generation failed.");
    });
  }, 250);
}

function handleInputChange() {
  try {
    readParams();
  } catch (error: unknown) {
    stepButton.disabled = true;
    stlButton.disabled = true;
    setStatus(error instanceof Error ? error.message : "Generation failed.");
    return;
  }

  scheduleRebuild();
}

form.addEventListener("input", handleInputChange);
form.addEventListener("change", handleInputChange);
form.addEventListener("submit", (event) => event.preventDefault());

stepButton.addEventListener("click", () => exportCurrent("step"));
stlButton.addEventListener("click", () => exportCurrent("stl"));
window.addEventListener("resize", resizeRenderer);

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

resizeRenderer();
animate();

(initOpenCascade as OpenCascadeInit)({
  locateFile: () => wasmUrl,
}).then((oc) => {
  setOC(oc as Parameters<typeof setOC>[0]);
  return rebuild();
}).catch((error: unknown) => {
  setStatus(error instanceof Error ? error.message : "Could not load CAD kernel.");
});
