// Collision shape definitions (in body-local pixels) and polygon decomposition.
//
// Box2D/Planck only supports small convex polygons, while Godot's
// CollisionPolygon2D accepts any simple polygon. `decompose` turns an arbitrary
// polygon into convex pieces: ear-clip into triangles, then greedily merge
// neighbours back together while the result stays convex.

export type Pt = readonly [number, number];

export type ShapeDef =
  /** Rectangle like RectangleShape2D: size w×h centred at (x, y), rotated by rot. */
  | { type: 'rect'; w: number; h: number; x?: number; y?: number; rot?: number }
  /** Polygon like CollisionPolygon2D, any winding, may be concave. */
  | { type: 'poly'; points: readonly Pt[] };

/** Convex pieces need no more vertices than this (Planck allows up to 12). */
const MAX_PIECE_VERTICES = 8;
/** Pieces smaller than this (px²) are dropped; Planck rejects degenerate polygons. */
const MIN_PIECE_AREA = 2;

export function signedArea(pts: readonly Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

function cross(a: Pt, b: Pt, c: Pt): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Assumes positive orientation (signedArea > 0). Collinear vertices are allowed. */
function isConvex(pts: readonly Pt[]): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    if (cross(pts[i], pts[(i + 1) % n], pts[(i + 2) % n]) < -1e-6) return false;
  }
  return true;
}

function pointInTriangle(p: Pt, a: Pt, b: Pt, c: Pt): boolean {
  return cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
}

/** Remove duplicate and collinear vertices, and make the winding positive. */
function clean(input: readonly Pt[]): Pt[] {
  let pts = input.filter((p, i) => {
    const q = input[(i + 1) % input.length];
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-3;
  });
  pts = pts.filter((p, i) => {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const next = pts[(i + 1) % pts.length];
    return Math.abs(cross(prev, p, next)) > 1e-6;
  });
  return signedArea(pts) < 0 ? pts.reverse() : pts;
}

function earClip(pts: readonly Pt[]): number[][] {
  const idx = pts.map((_, i) => i);
  const tris: number[][] = [];
  while (idx.length > 3) {
    let clipped = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k - 1 + idx.length) % idx.length];
      const i1 = idx[k];
      const i2 = idx[(k + 1) % idx.length];
      if (cross(pts[i0], pts[i1], pts[i2]) <= 1e-9) continue; // reflex corner
      const blocked = idx.some(
        (j) => j !== i0 && j !== i1 && j !== i2 && pointInTriangle(pts[j], pts[i0], pts[i1], pts[i2]),
      );
      if (blocked) continue;
      tris.push([i0, i1, i2]);
      idx.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) break; // self-intersecting input; keep what we have
  }
  if (idx.length === 3) tris.push(idx);
  return tris;
}

/** Merge two index polygons sharing an edge, if the result is convex and small enough. */
function tryMerge(a: number[], b: number[], pts: readonly Pt[]): number[] | null {
  if (a.length + b.length - 2 > MAX_PIECE_VERTICES) return null;
  for (let i = 0; i < a.length; i++) {
    const a0 = a[i];
    const a1 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      if (b[j] !== a1 || b[(j + 1) % b.length] !== a0) continue;
      const aFromA1 = [...a.slice(i + 1), ...a.slice(0, i + 1)]; // a1 ... a0
      const bFromA0 = [...b.slice(j + 1), ...b.slice(0, j + 1)]; // a0 ... a1
      const merged = [...aFromA1, ...bFromA0.slice(1, -1)];
      return isConvex(merged.map((k) => pts[k])) ? merged : null;
    }
  }
  return null;
}

/** Split any simple polygon into convex pieces Planck can use. */
export function decompose(input: readonly Pt[]): Pt[][] {
  const pts = clean(input);
  if (pts.length < 3) return [];
  if (pts.length <= MAX_PIECE_VERTICES && isConvex(pts)) return [pts];

  const polys = earClip(pts);
  for (let merged = true; merged; ) {
    merged = false;
    search: for (let i = 0; i < polys.length; i++) {
      for (let j = i + 1; j < polys.length; j++) {
        const m = tryMerge(polys[i], polys[j], pts);
        if (m) {
          polys[i] = m;
          polys.splice(j, 1);
          merged = true;
          break search;
        }
      }
    }
  }
  return polys.map((p) => p.map((i) => pts[i])).filter((p) => signedArea(p) > MIN_PIECE_AREA);
}

/** Corners of a rect shape in body-local pixels. */
export function rectPoints(s: Extract<ShapeDef, { type: 'rect' }>): Pt[] {
  const hw = s.w / 2;
  const hh = s.h / 2;
  const c = Math.cos(s.rot ?? 0);
  const n = Math.sin(s.rot ?? 0);
  const cx = s.x ?? 0;
  const cy = s.y ?? 0;
  const corners: Pt[] = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  return corners.map(([x, y]) => [cx + x * c - y * n, cy + x * n + y * c] as const);
}

/** Convex pieces for any shape definition, in body-local pixels. */
export function shapePieces(s: ShapeDef): Pt[][] {
  return s.type === 'rect' ? [rectPoints(s)] : decompose(s.points);
}

/** Scale and offset a polygon (e.g. a CollisionPolygon2D node with its own position/scale). */
export function transformPoints(points: readonly Pt[], dx = 0, dy = 0, scale = 1): Pt[] {
  return points.map(([x, y]) => [x * scale + dx, y * scale + dy] as const);
}
