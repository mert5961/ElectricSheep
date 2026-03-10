import * as THREE from 'three';

const EPSILON = 1e-8;
const UNIT_SQUARE = [
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 0, y: 0 },
  { x: 1, y: 0 },
];

export function cloneQuad(quad) {
  return quad.map(({ x, y }) => ({ x, y }));
}

export function solveScreenToUnitMatrix(quad) {
  return solveQuadToQuadMatrix(quad, UNIT_SQUARE);
}

export function solveUnitToScreenMatrix(quad) {
  return solveQuadToQuadMatrix(UNIT_SQUARE, quad);
}

export function solveQuadToQuadMatrix(sourceQuad, targetQuad) {
  const coefficients = solveHomography(sourceQuad, targetQuad);
  if (!coefficients) return null;

  const matrix = new THREE.Matrix3();
  matrix.set(
    coefficients[0], coefficients[1], coefficients[2],
    coefficients[3], coefficients[4], coefficients[5],
    coefficients[6], coefficients[7], 1,
  );
  return matrix;
}

export function projectPoint(matrix, point) {
  const elements = matrix.elements;
  const x = point.x;
  const y = point.y;

  const w = (elements[2] * x) + (elements[5] * y) + elements[8];
  if (Math.abs(w) < EPSILON) return null;

  return {
    x: ((elements[0] * x) + (elements[3] * y) + elements[6]) / w,
    y: ((elements[1] * x) + (elements[4] * y) + elements[7]) / w,
  };
}

export function transformQuad(matrix, quad) {
  return quad.map((point) => projectPoint(matrix, point) || { ...point });
}

export function createQuadFromUnitBounds(targetQuad, {
  minX = 0.3,
  maxX = 0.7,
  minY = 0.3,
  maxY = 0.7,
} = {}) {
  const unitToScreen = solveUnitToScreenMatrix(targetQuad);
  const boundedQuad = [
    { x: minX, y: maxY },
    { x: maxX, y: maxY },
    { x: minX, y: minY },
    { x: maxX, y: minY },
  ];

  if (!unitToScreen) {
    return cloneQuad(targetQuad);
  }

  return transformQuad(unitToScreen, boundedQuad);
}

function solveHomography(sourcePoints, targetPoints) {
  if (!Array.isArray(sourcePoints) || !Array.isArray(targetPoints)) return null;
  if (sourcePoints.length !== 4 || targetPoints.length !== 4) return null;

  const matrix = [];
  const vector = [];

  for (let i = 0; i < 4; i++) {
    const source = sourcePoints[i];
    const target = targetPoints[i];
    const x = source.x;
    const y = source.y;
    const u = target.x;
    const v = target.y;

    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    vector.push(u);

    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    vector.push(v);
  }

  return gaussianElimination(matrix, vector);
}

function gaussianElimination(matrix, vector) {
  const size = vector.length;
  const rows = matrix.map((row, rowIndex) => [...row, vector[rowIndex]]);

  for (let column = 0; column < size; column++) {
    let pivotRow = column;
    let pivotValue = Math.abs(rows[column][column]);

    for (let row = column + 1; row < size; row++) {
      const candidate = Math.abs(rows[row][column]);
      if (candidate > pivotValue) {
        pivotValue = candidate;
        pivotRow = row;
      }
    }

    if (pivotValue < EPSILON) {
      return null;
    }

    if (pivotRow !== column) {
      [rows[column], rows[pivotRow]] = [rows[pivotRow], rows[column]];
    }

    const divisor = rows[column][column];
    for (let entry = column; entry <= size; entry++) {
      rows[column][entry] /= divisor;
    }

    for (let row = 0; row < size; row++) {
      if (row === column) continue;
      const factor = rows[row][column];
      if (Math.abs(factor) < EPSILON) continue;

      for (let entry = column; entry <= size; entry++) {
        rows[row][entry] -= factor * rows[column][entry];
      }
    }
  }

  return rows.map((row) => row[size]);
}
