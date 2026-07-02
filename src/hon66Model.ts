import {
  makeCylinder,
  type Shape3D,
  Sketcher,
} from "replicad";

export type Bitting = [number, number, number, number, number, number];
export type HandleType = "keyless" | "octagonal";

export interface Hon66Params {
  cutA: Bitting;
  cutB: Bitting;
  handleType: HandleType;
}

export const defaultParams: Hon66Params = {
  cutA: [2, 3, 4, 5, 6, 1],
  cutB: [6, 5, 4, 3, 2, 1],
  handleType: "octagonal",
};

const inch = 25.4;
const keyThickness = 3;

const keyLength = 1.834 * inch;
const keyHeight = 9;
const tipChamfer = 0.106 * inch;
const webThickness = 0.015 * inch;
const tipProfileHalfHeight = (0.0315 * inch) / 2;
const longEdgeChamfer = 1.0;
const keylessBowWidth = 7.5;
const keylessBowHeight = 10;
const keylessBowThickness = 2.6;
const keylessBowBottomChamfer = 2.5;
const keylessBowTopChamfer = 3.3;
const bowWidth = 18;
const bowHeight = 18;
const bowCorner = 4;
const bowHoleRadius = 3.2;
const bottomNotchDepth = 3.2;
const bottomNotchRightFromTip = 41.2;

const cutSpacing = 0.120 * inch;
const firstCutFromRight = 0.746 * inch;
const cut1WebDistance = 6.9;
const cut1Depth = (keyHeight - cut1WebDistance) / 2;
const cutStep = 0.014 * inch;
const cutLand = 1;
const leadInLand = 4;

type Point2 = [number, number];

export function parseBitting(value: string): Bitting {
  const digits = value.trim().split("").map((char) => Number(char));
  if (digits.length !== 6 || digits.some((digit) => !Number.isInteger(digit) || digit < 1 || digit > 6)) {
    throw new Error("Bitting must be exactly six digits from 1 to 6.");
  }

  return digits as Bitting;
}

export function formatBitting(cuts: Bitting): string {
  return cuts.join("");
}

export function depthOneWebDistance() {
  return topCutY(1) - bottomCutY(1);
}

function cutX(index: number) {
  return keyLength - firstCutFromRight + index * cutSpacing;
}

function cutDepth(cut: number) {
  return cut1Depth + (cut - 1) * cutStep;
}

function topCutY(cut: number) {
  return keyHeight / 2 - cutDepth(cut);
}

function bottomCutY(cut: number) {
  return -keyHeight / 2 + cutDepth(cut);
}

function firstRegularLandStart() {
  return cutX(0) - cutLand / 2;
}

function startsLand(cuts: Bitting, index: number) {
  return index === 0 || cuts[index] !== cuts[index - 1];
}

function endsLand(cuts: Bitting, index: number) {
  return index === cuts.length - 1 || cuts[index] !== cuts[index + 1];
}

function bottomFirstRampStart(cuts: Bitting) {
  return firstRegularLandStart() - Math.abs(bottomCutY(cuts[0]) - bottomCutY(1));
}

function bottomDepth1RampEnd(cuts: Bitting) {
  return bottomFirstRampStart(cuts) - leadInLand;
}

function bottomFullRampStart(cuts: Bitting) {
  return bottomDepth1RampEnd(cuts) - Math.abs(bottomCutY(1) - -keyHeight / 2);
}

function topFirstRampStart(cuts: Bitting) {
  return firstRegularLandStart() - Math.abs(topCutY(cuts[0]) - topCutY(1));
}

function topDepth1RampEnd(cuts: Bitting) {
  return topFirstRampStart(cuts) - leadInLand;
}

function topFullRampStart(cuts: Bitting) {
  return topDepth1RampEnd(cuts) - Math.abs(keyHeight / 2 - topCutY(1));
}

function bottomLeadInPoints(cuts: Bitting): Point2[] {
  return [
    [bottomFullRampStart(cuts), -keyHeight / 2],
    [bottomDepth1RampEnd(cuts), bottomCutY(1)],
    [bottomFirstRampStart(cuts), bottomCutY(1)],
  ];
}

function topLeadInPoints(cuts: Bitting): Point2[] {
  return [
    [topFirstRampStart(cuts), topCutY(1)],
    [topDepth1RampEnd(cuts), topCutY(1)],
    [topFullRampStart(cuts), keyHeight / 2],
  ];
}

function topCutPoints(cuts: Bitting): Point2[] {
  const points: Point2[] = [];
  cuts.forEach((cut, index) => {
    if (startsLand(cuts, index)) points.push([cutX(index) - cutLand / 2, topCutY(cut)]);
    if (endsLand(cuts, index)) points.push([cutX(index) + cutLand / 2, topCutY(cut)]);
  });
  return points;
}

function bottomCutPoints(cuts: Bitting): Point2[] {
  const points: Point2[] = [];
  cuts.forEach((cut, index) => {
    if (startsLand(cuts, index)) points.push([cutX(index) - cutLand / 2, bottomCutY(cut)]);
    if (endsLand(cuts, index)) points.push([cutX(index) + cutLand / 2, bottomCutY(cut)]);
  });
  return points;
}

function reversedTopCutPoints(cuts: Bitting): Point2[] {
  const points: Point2[] = [];
  for (let index = cuts.length - 1; index >= 0; index -= 1) {
    const cut = cuts[index];
    if (endsLand(cuts, index)) points.push([cutX(index) + cutLand / 2, topCutY(cut)]);
    if (startsLand(cuts, index)) points.push([cutX(index) - cutLand / 2, topCutY(cut)]);
  }
  return points;
}

function keyOutlinePoints(): Point2[] {
  return [
    [0, -keyHeight / 2],
    [keyLength - tipChamfer, -keyHeight / 2],
    [keyLength, -keyHeight / 2 + tipChamfer],
    [keyLength, keyHeight / 2 - tipChamfer],
    [keyLength - tipChamfer, keyHeight / 2],
    [0, keyHeight / 2],
  ];
}

function keyProfilePoints(cutA: Bitting, cutB: Bitting): Point2[] {
  return [
    [0, -keyHeight / 2],
    ...bottomLeadInPoints(cutB),
    ...bottomCutPoints(cutB),
    [keyLength, -tipProfileHalfHeight],
    [keyLength, tipProfileHalfHeight],
    ...reversedTopCutPoints(cutA),
    ...topLeadInPoints(cutA),
    [0, keyHeight / 2],
  ];
}

function polygonSketch(points: Point2[], plane: "XY" | "YZ" = "XY") {
  const [first, ...rest] = points;
  let sketch = new Sketcher(plane).movePointerTo(first);
  rest.forEach((point) => {
    sketch = sketch.lineTo(point);
  });
  return sketch.close();
}

function extrudePolygon(points: Point2[], height: number, plane: "XY" | "YZ" = "XY"): Shape3D {
  return polygonSketch(points, plane).extrude(height) as Shape3D;
}

function keylessBow(): Shape3D {
  const top = keyHeight / 2;
  const bottom = top - keylessBowHeight;
  const left = -keylessBowWidth;
  const extrusionHeight = Math.min(keylessBowThickness, keyThickness);
  const holeRadius = 2.1 / 2;
  const holeCenterX = -(4.78 - holeRadius);
  const holeCenterY = bottom + (2.42 + holeRadius);

  const bow = extrudePolygon(
    [
      [0, bottom],
      [0, top],
      [left + keylessBowTopChamfer, top],
      [left, top - keylessBowTopChamfer],
      [left, bottom + keylessBowBottomChamfer],
      [left + keylessBowBottomChamfer, bottom],
    ],
    extrusionHeight,
  ).translateZ(-keyThickness / 2);

  const hole = makeCylinder(
    holeRadius,
    extrusionHeight + 0.2,
    [holeCenterX, holeCenterY, -keyThickness / 2 - 0.1],
    [0, 0, 1],
  );

  return bow.cut(hole);
}

function octagonalBow(): Shape3D {
  const halfHeight = bowHeight / 2;
  const bow = extrudePolygon(
    [
      [-bowWidth + bowCorner, -halfHeight],
      [-bowCorner, -halfHeight],
      [0, -halfHeight + bowCorner],
      [0, halfHeight - bowCorner],
      [-bowCorner, halfHeight],
      [-bowWidth + bowCorner, halfHeight],
      [-bowWidth, halfHeight - bowCorner],
      [-bowWidth, -halfHeight + bowCorner],
    ],
    keyThickness,
  ).translateZ(-keyThickness / 2);

  const cutterOverlap = 0.1;
  const hole = makeCylinder(
    bowHoleRadius,
    keyThickness + 2 * cutterOverlap,
    [-bowWidth / 2, 0, -keyThickness / 2 - cutterOverlap],
    [0, 0, 1],
  );

  return bow.cut(hole);
}

function handleExtension(type: HandleType): Shape3D {
  return type === "octagonal"
    ? octagonalBow()
    : keylessBow();
}

function keyBlankHalf(cutA: Bitting, cutB: Bitting): Shape3D {
  const outline = extrudePolygon(keyOutlinePoints(), webThickness);
  const profile = extrudePolygon(keyProfilePoints(cutA, cutB), keyThickness / 2 - webThickness)
    .translateZ(webThickness);

  return outline.fuse(profile);
}

function keyBlank(cutA: Bitting, cutB: Bitting): Shape3D {
  const half = keyBlankHalf(cutA, cutB);
  return half.fuse(half.clone().rotate(180, [0, 0, 0], [1, 0, 0]));
}

function positiveYzChamferCutter(): Shape3D {
  const xMargin = 1;
  const cutterOverlap = 0.1;
  const yOuter = keyHeight / 2;
  const zOuter = keyThickness / 2;

  return extrudePolygon(
    [
      [yOuter + cutterOverlap, zOuter + cutterOverlap],
      [yOuter - longEdgeChamfer, zOuter + cutterOverlap],
    [yOuter + cutterOverlap, zOuter - longEdgeChamfer],
    ],
    keyLength + 2 * xMargin,
    "YZ",
  ).translateX(-xMargin);
}

function bottomProfileNotchCutter(): Shape3D {
  const cutterOverlap = 0.1;
  const xStart = 0;
  const yStart = -keyHeight / 2;
  const xRampEnd = xStart + bottomNotchDepth;
  const yNotch = yStart + bottomNotchDepth;
  const xSquareEdge = keyLength - bottomNotchRightFromTip;
  const yExit = yStart - keylessBowHeight - cutterOverlap;

  return extrudePolygon(
    [
      [xStart, yStart],
      [xRampEnd, yNotch],
      [xSquareEdge, yNotch],
      [xSquareEdge, yExit],
      [xStart, yExit],
    ],
    keyThickness + 2 * cutterOverlap,
  ).translateZ(-keyThickness / 2 - cutterOverlap);
}

export function buildHon66Key(params: Hon66Params): Shape3D {
  const base = keyBlank(params.cutA, params.cutB)
    .fuse(handleExtension(params.handleType));

  if (params.handleType !== "keyless") {
    return base;
  }

  return base
    .cut(positiveYzChamferCutter())
    .cut(bottomProfileNotchCutter());
}
