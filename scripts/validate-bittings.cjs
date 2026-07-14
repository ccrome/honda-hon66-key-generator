const { execFileSync } = require("node:child_process");
const path = require("node:path");
const process = require("node:process");
const initOpenCascade = require("replicad-opencascadejs").default;
const { setOC } = require("replicad");

const root = process.cwd();
const tempDir = path.join(root, ".tmp-bitting-validation");
const sampleCount = Number(process.env.BITTING_SAMPLE_COUNT ?? 500);

global.__dirname = path.join(root, "node_modules/replicad-opencascadejs/src");
global.require = require;

execFileSync(
  "npx",
  [
    "tsc",
    "src/hon66Model.ts",
    "--outDir",
    tempDir,
    "--module",
    "Node16",
    "--target",
    "ES2020",
    "--moduleResolution",
    "node16",
    "--esModuleInterop",
    "--skipLibCheck",
    "--ignoreConfig",
    "--noImplicitAny",
    "false",
  ],
  { cwd: root, stdio: "inherit" },
);

const { buildHon66Key, defaultParams, parseBitting } = require(path.join(tempDir, "hon66Model.js"));

function formatIndexBitting(index) {
  let value = index;
  let result = "";
  for (let digit = 0; digit < 6; digit += 1) {
    result = String((value % 6) + 1) + result;
    value = Math.floor(value / 6);
  }
  return result;
}

function reverseBitting(value) {
  return value.split("").reverse().join("");
}

function buildSampleBittings(count) {
  const total = 6 ** 6;
  const requested = Math.min(count, total);
  const bittings = new Set(["133551"]);

  for (let index = 0; bittings.size < requested; index += 1) {
    bittings.add(formatIndexBitting((index * 7919) % total));
  }

  return [...bittings];
}

function validateMesh(shape, label) {
  const mesh = shape.mesh({ tolerance: 0.12, angularTolerance: 0.4 });
  const vertices = mesh.vertices.length / 3;
  const triangles = mesh.triangles.length / 3;

  if (vertices === 0 || triangles === 0) {
    throw new Error(`${label} generated empty mesh geometry`);
  }
  if (!Number.isInteger(vertices) || !Number.isInteger(triangles)) {
    throw new Error(`${label} generated malformed mesh buffers`);
  }

  return { vertices, triangles };
}

(async () => {
  const oc = await initOpenCascade({
    locateFile: (file) => path.join(root, "node_modules/replicad-opencascadejs/src", file),
  });
  setOC(oc);

  const bittings = buildSampleBittings(sampleCount);
  for (const [index, bitting] of bittings.entries()) {
    try {
      const cutA = parseBitting(bitting);
      const cutB = parseBitting(reverseBitting(bitting));
      const params = {
        ...defaultParams,
        cutA,
        cutB,
        handleType: index % 2 === 0 ? "octagonal" : "keyless",
      };
      const label = `${bitting}/${reverseBitting(bitting)} ${params.handleType}`;
      const shape = buildHon66Key(params);
      validateMesh(shape, label);
    } catch (error) {
      throw new Error(`Failed to validate bitting ${bitting}: ${error instanceof Error ? error.message : error}`);
    }

    if ((index + 1) % 50 === 0 || index + 1 === bittings.length) {
      console.log(`Validated ${index + 1}/${bittings.length} bittings`);
    }
  }

  console.log(`Validated ${bittings.length} HON66 bitting samples, including 133551`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
