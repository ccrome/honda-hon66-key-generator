import { exportSTEP, type Shape3D } from "replicad";
import * as THREE from "three";

export type StepShape = {
  shape: Shape3D;
  name: string;
  color: string;
  alpha: number;
};

export function shapeToGeometry(shape: Shape3D) {
  const mesh = shape.mesh({ tolerance: 0.04, angularTolerance: 0.25 });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(mesh.vertices, 3));
  geometry.setIndex(mesh.triangles);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

export function combineShapesToGeometry(shapes: Shape3D[]) {
  const combined = new THREE.BufferGeometry();
  const positions: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const shape of shapes) {
    const geometry = shapeToGeometry(shape);
    const position = geometry.getAttribute("position");
    const index = geometry.getIndex();
    if (!index) continue;

    for (let i = 0; i < position.count; i += 1) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
    }
    for (let i = 0; i < index.count; i += 1) {
      indices.push(index.getX(i) + vertexOffset);
    }
    vertexOffset += position.count;
    geometry.dispose();
  }

  combined.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  combined.setIndex(indices);
  combined.computeVertexNormals();
  combined.computeBoundingBox();
  return combined;
}

export function geometryToBinaryStl(geometry: THREE.BufferGeometry, solidName: string) {
  const positions = geometry.getAttribute("position");
  const index = geometry.getIndex();
  if (!index) {
    throw new Error("Cannot export STL without indexed geometry.");
  }

  const triangleCount = index.count / 3;
  const buffer = new ArrayBuffer(84 + triangleCount * 50);
  const view = new DataView(buffer);
  const header = new TextEncoder().encode(solidName.slice(0, 80));
  new Uint8Array(buffer, 0, header.length).set(header);
  view.setUint32(80, triangleCount, true);

  let offset = 84;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let i = 0; i < index.count; i += 3) {
    const ia = index.getX(i);
    const ib = index.getX(i + 1);
    const ic = index.getX(i + 2);
    a.fromBufferAttribute(positions, ia);
    b.fromBufferAttribute(positions, ib);
    c.fromBufferAttribute(positions, ic);
    normal.copy(b).sub(a).cross(c.clone().sub(a)).normalize();
    view.setFloat32(offset, normal.x, true); offset += 4;
    view.setFloat32(offset, normal.y, true); offset += 4;
    view.setFloat32(offset, normal.z, true); offset += 4;
    view.setFloat32(offset, a.x, true); offset += 4;
    view.setFloat32(offset, a.y, true); offset += 4;
    view.setFloat32(offset, a.z, true); offset += 4;
    view.setFloat32(offset, b.x, true); offset += 4;
    view.setFloat32(offset, b.y, true); offset += 4;
    view.setFloat32(offset, b.z, true); offset += 4;
    view.setFloat32(offset, c.x, true); offset += 4;
    view.setFloat32(offset, c.y, true); offset += 4;
    view.setFloat32(offset, c.z, true); offset += 4;
    view.setUint16(offset, 0, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "model/stl" });
}

export function exportShapesStep(shapes: StepShape[]) {
  return exportSTEP(shapes);
}

export function exportShapesStl(shapes: Shape3D[], solidName: string) {
  const geometry = combineShapesToGeometry(shapes);
  const blob = geometryToBinaryStl(geometry, solidName);
  geometry.dispose();
  return blob;
}
