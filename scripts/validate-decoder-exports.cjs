const { execFileSync } = require("node:child_process");
const path = require("node:path");
const process = require("node:process");
const initOpenCascade = require("replicad-opencascadejs").default;
const { setOC } = require("replicad");
const { STLLoader } = require("three/examples/jsm/loaders/STLLoader.js");

const root = process.cwd();
const tempDir = path.join(root, ".tmp-decoder-validation");
global.__dirname = path.join(root, "node_modules/replicad-opencascadejs/src");
global.require = require;

execFileSync(
  "npx",
  [
    "tsc",
    "src/hon66Model.ts",
    "src/geometryExport.ts",
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

const { buildHon66DecoderSetParts } = require(path.join(tempDir, "hon66Model.js"));
const { exportShapesStl, exportShapesStep } = require(path.join(tempDir, "geometryExport.js"));

(async () => {
  const oc = await initOpenCascade({
    locateFile: (file) => path.join(root, "node_modules/replicad-opencascadejs/src", file),
  });
  setOC(oc);

  for (const variant of ["oneColor", "twoColor"]) {
    const parts = buildHon66DecoderSetParts(variant);
    const bodyParts = parts.filter((part) => part.role === "body");
    const fillParts = parts.filter((part) => part.role === "numberFill");
    const shapes = parts.map((part) => part.shape);
    if (bodyParts.length !== 6) {
      throw new Error(`Expected 6 ${variant} decoder bodies, got ${bodyParts.length}`);
    }
    if (variant === "oneColor" && fillParts.length !== 0) {
      throw new Error("One-color decoder should not include number fill pieces");
    }
    if (variant === "twoColor" && fillParts.length === 0) {
      throw new Error("Two-color decoder should include number fill pieces");
    }

    let sourceTriangles = 0;
    for (const [index, part] of parts.entries()) {
      const mesh = part.shape.mesh({ tolerance: 0.04, angularTolerance: 0.25 });
      const vertices = mesh.vertices.length / 3;
      const triangles = mesh.triangles.length / 3;
      console.log(`${variant} ${part.role} ${part.depth}.${index + 1}: ${vertices} vertices, ${triangles} triangles`);
      if (vertices === 0 || triangles === 0) {
        throw new Error(`${variant} part ${index + 1} did not generate mesh geometry`);
      }
      sourceTriangles += triangles;
    }

    const stl = exportShapesStl(shapes, `hon66_decoder_set_${variant}`);
    if (stl.size <= 84) {
      throw new Error(`${variant} decoder STL export was empty`);
    }

    const parsedGeometry = new STLLoader().parse(await stl.arrayBuffer());
    const parsedVertices = parsedGeometry.getAttribute("position").count;
    const parsedTriangles = parsedVertices / 3;
    if (parsedVertices === 0) {
      throw new Error(`${variant} decoder STL parsed to empty geometry`);
    }
    if (parsedTriangles !== sourceTriangles) {
      throw new Error(`Expected ${sourceTriangles} ${variant} parsed STL triangles, got ${parsedTriangles}`);
    }

    const step = exportShapesStep(parts.map((part, index) => ({
      shape: part.shape,
      name: `hon66_decoder_${part.depth}_${part.role}_${index + 1}`,
      color: part.role === "numberFill" ? "#2f6fb0" : "#d98c2b",
      alpha: 1,
    })));
    if (step.size === 0) {
      throw new Error(`${variant} decoder STEP export was empty`);
    }

    console.log(`${variant} decoder STL parses: ${parsedVertices} vertices, ${parsedTriangles} triangles`);
    console.log(`${variant} decoder STEP exports: ${step.size} bytes`);
  }
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
