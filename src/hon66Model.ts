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
  keyWidth: number;
  handleType: HandleType;
}

export const defaultParams: Hon66Params = {
  cutA: [2, 3, 4, 5, 6, 1],
  cutB: [6, 5, 4, 3, 2, 1],
  keyWidth: 3,
  handleType: "keyless",
};

const inch = 25.4;

const keyLength = 1.834 * inch;
const keyHeight = 0.311 * inch;
const tipChamfer = 0.106 * inch;
const webThickness = 0.015 * inch;
const tipProfileHalfHeight = (0.0315 * inch) / 2;
const longEdgeChamfer = 1.0;
const leftProfileWidth = 7;
const leftProfileHeight = 10;
const bowWidth = 18;
const bowHeight = 18;
const bowCorner = 4;
const bowHoleRadius = 3.2;
const bottomNotchDepth = 3.2;
const bottomNotchRightFromTip = 41.2;

const cutSpacing = 0.120 * inch;
const firstCutFromRight = 0.746 * inch;
const cut1Depth = 0.042 * inch;
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

function leftProfileExtension(keyWidth: number): Shape3D {
  const top = keyHeight / 2;
  const bottom = top - leftProfileHeight;
  return extrudePolygon(
    [
      [-leftProfileWidth, bottom],
      [0, bottom],
      [0, top],
      [-leftProfileWidth, top],
    ],
    keyWidth,
  ).translateZ(-keyWidth / 2);
}

function octagonalBow(keyWidth: number): Shape3D {
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
    keyWidth,
  ).translateZ(-keyWidth / 2);

  const cutterOverlap = 0.1;
  const hole = makeCylinder(
    bowHoleRadius,
    keyWidth + 2 * cutterOverlap,
    [-bowWidth / 2, 0, -keyWidth / 2 - cutterOverlap],
    [0, 0, 1],
  );

  return bow.cut(hole);
}

function handleExtension(type: HandleType, keyWidth: number): Shape3D {
  return type === "octagonal"
    ? octagonalBow(keyWidth)
    : leftProfileExtension(keyWidth);
}

function keyBlankHalf(cutA: Bitting, cutB: Bitting, keyWidth: number): Shape3D {
  const outline = extrudePolygon(keyOutlinePoints(), webThickness);
  const profile = extrudePolygon(keyProfilePoints(cutA, cutB), keyWidth / 2 - webThickness)
    .translateZ(webThickness);

  return outline.fuse(profile);
}

function keyBlank(cutA: Bitting, cutB: Bitting, keyWidth: number): Shape3D {
  const half = keyBlankHalf(cutA, cutB, keyWidth);
  return half.fuse(half.clone().rotate(180, [0, 0, 0], [1, 0, 0]));
}

function positiveYzChamferCutter(keyWidth: number): Shape3D {
  const xMargin = 1;
  const cutterOverlap = 0.1;
  const yOuter = keyHeight / 2;
  const zOuter = keyWidth / 2;

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

function bottomProfileNotchCutter(keyWidth: number): Shape3D {
  const cutterOverlap = 0.1;
  const xStart = 0;
  const yStart = -keyHeight / 2;
  const xRampEnd = xStart + bottomNotchDepth;
  const yNotch = yStart + bottomNotchDepth;
  const xSquareEdge = keyLength - bottomNotchRightFromTip;
  const yExit = yStart - Math.max(leftProfileHeight, bowHeight) - cutterOverlap;

  return extrudePolygon(
    [
      [xStart, yStart],
      [xRampEnd, yNotch],
      [xSquareEdge, yNotch],
      [xSquareEdge, yExit],
      [xStart, yExit],
    ],
    keyWidth + 2 * cutterOverlap,
  ).translateZ(-keyWidth / 2 - cutterOverlap);
}

export function buildHon66Key(params: Hon66Params): Shape3D {
  const base = keyBlank(params.cutA, params.cutB, params.keyWidth)
    .fuse(handleExtension(params.handleType, params.keyWidth));

  if (params.handleType !== "keyless") {
    return base;
  }

  return base
    .cut(positiveYzChamferCutter(params.keyWidth))
    .cut(bottomProfileNotchCutter(params.keyWidth));
}
