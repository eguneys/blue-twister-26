import { rect_abcd, type Rect } from "./rect";
import type { Penetration } from "./steer";
import { length, add, dot, mulScalar, normalize, sub, vec2, type Vec2, len2, rotateVec2 } from "./vec2";

export type Poly = {
    points: Vec2[];        // in CCW order, closed implicitly (last -> first)

    // Internal, computed once:
    _edges: {
        A: Vec2;
        B: Vec2;
        normal: Vec2;      // always outward normal
        dir: Vec2;         // edge direction
        length: number;
    }[];
};

export function poly_from_rect(rect: Rect, theta?: number) {
  let v = rect_abcd(rect)
  if (theta) {
    let o = vec2(rect.xy.x + rect.wh.x / 2, rect.xy.y + rect.wh.y / 2)
    v = v.map(_ => {

      let res = sub(_, o)
      res = rotateVec2(res, theta)
      res = add(res, o)
      return res
    })
  }
  return poly_from_points(v)
}

export function poly_from_points(inputPoints: Vec2[]): Poly {
    if (inputPoints.length < 3)
        throw new Error("Poly requires at least 3 points");

    if (polygonIsSelfIntersecting(inputPoints))
        throw new Error("Polygon is self-intersecting");

    // Copy so we never mutate original
    let points = inputPoints.slice();

    // ---- 1. Ensure polygon is CCW ----
    const signedArea = computeSignedArea(points);

    if (signedArea > 0) {
        // CW → reverse → CCW
        points.reverse();
    }

    // ---- 2. Build edges with guaranteed outward normals ----
    const edges = [];

    for (let i = 0; i < points.length; i++) {
        const A = points[i];
        const B = points[(i + 1) % points.length];

        const dir = { x: B.x - A.x, y: B.y - A.y };
        const len = Math.hypot(dir.x, dir.y);
        const invLen = len === 0 ? 0 : 1 / len;

        // CCW polygon → outward normal = perpendicular(dir)
        const normal = { x: -dir.y * invLen, y: dir.x * invLen };

        edges.push({ A, B, dir, length: len, normal });
    }

    return { points, _edges: edges };
}

export function collisionSurface(poly: Poly, p: Vec2): Penetration {
    let bestNormal = vec2()
    let maxDist = -Infinity

    for (const edge of poly._edges) {
        const d = dot(sub(p, edge.A), edge.normal)

        if (d > maxDist) {
            maxDist = d
            bestNormal = edge.normal
        }
    }

    return {
        signedDistance: maxDist,
        normal: bestNormal
    }
}

export function computeSignedArea(pts: Vec2[]): number {
    let area = 0;

    for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }

    return area * 0.5; // positive = CCW
}


function segIntersect(A: Vec2, B: Vec2, C: Vec2, D: Vec2): boolean {
    function orient(p: Vec2, q: Vec2, r: Vec2) {
        return (q.y - p.y) * (r.x - q.x) - 
               (q.x - p.x) * (r.y - q.y);
    }

    const o1 = orient(A, B, C);
    const o2 = orient(A, B, D);
    const o3 = orient(C, D, A);
    const o4 = orient(C, D, B);

    // General intersection
    if ((o1 > 0 && o2 < 0 || o1 < 0 && o2 > 0) &&
        (o3 > 0 && o4 < 0 || o3 < 0 && o4 > 0)) {
        return true;
    }

    // Collinear + overlap cases
    function onSeg(p: Vec2, q: Vec2, r: Vec2) {
        return q.x >= Math.min(p.x, r.x) && q.x <= Math.max(p.x, r.x) &&
               q.y >= Math.min(p.y, r.y) && q.y <= Math.max(p.y, r.y);
    }

    if (o1 === 0 && onSeg(A, C, B)) return true;
    if (o2 === 0 && onSeg(A, D, B)) return true;
    if (o3 === 0 && onSeg(C, A, D)) return true;
    if (o4 === 0 && onSeg(C, B, D)) return true;

    return false;
}

function polygonIsSelfIntersecting(points: Vec2[]): boolean {
    const n = points.length;
    if (n < 4) return false; // triangles cannot self-intersect

    for (let i = 0; i < n; i++) {
        const A1 = points[i];
        const A2 = points[(i + 1) % n];

        for (let j = i + 1; j < n; j++) {
            const B1 = points[j];
            const B2 = points[(j + 1) % n];

            // Skip adjacent edges:
            if (A1 === B1 || A1 === B2 || A2 === B1 || A2 === B2)
                continue;

            if (segIntersect(A1, A2, B1, B2)) {
                return true;
            }
        }
    }

    return false;
}


export function findSegmentAtPoint(points: Vec2[], click: Vec2, eps = 3): number {
    // sq epsilon to avoid sqrt
    const eps2 = eps * eps;

    const n = points.length;

    for (let i = 0; i < n; i++) {
        const A = points[i];
        const B = points[(i + 1) % n]; // wrap around

        const ABx = B.x - A.x;
        const ABy = B.y - A.y;

        const APx = click.x - A.x;
        const APy = click.y - A.y;

        const AB_len2 = ABx * ABx + ABy * ABy;
        if (AB_len2 === 0) continue; // degenerate

        // Projection parameter t (0 = A, 1 = B)
        const t = (APx * ABx + APy * ABy) / AB_len2;

        // Must lie on the segment
        if (t < 0 || t > 1) continue;

        // Closest point on segment
        const closestX = A.x + t * ABx;
        const closestY = A.y + t * ABy;

        const dx = click.x - closestX;
        const dy = click.y - closestY;

        const dist2 = dx * dx + dy * dy;

        if (dist2 <= eps2) {
            return i; // segment index
        }
    }

    return -1; // no hit
}

// Utility: closest point on segment AB to point P, returns {point, t} where t in [0,1]
export function closestPointOnSegment(P: Vec2, A: Vec2, B: Vec2) {
  const AB = sub(B, A);
  const t = (() => {
    const denom = dot(AB, AB);
    if (denom === 0) return 0;
    return Math.max(0, Math.min(1, dot(sub(P, A), AB) / denom));
  })();
  return { point: add(A, mulScalar(AB, t)), t };
}

// Ray-cast point-in-polygon (nonzero winding / standard even-odd)
export function pointInPolygon(pt: Vec2, poly: Poly): boolean {
  const verts = poly.points;
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i].x, yi = verts[i].y;
    const xj = verts[j].x, yj = verts[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}


export function advanceAlongPath(
  path: Poly,
  startIndex: number,
  startPoint: Vec2,
  distance: number
): { point: Vec2; index: number } {
  let remaining = distance
  let index = startIndex % path.points.length
  let current = startPoint

  while (remaining > 0) {
    const nextIndex = (index + 1) % path.points.length
    if (nextIndex >= path.points.length) {
      return { point: current, index }
    }

    const next = path.points[nextIndex]
    const segment = sub(next, current)
    const len = length(segment)

    if (len >= remaining) {
      return {
        point: add(current, mulScalar(normalize(segment), remaining)),
        index
      }
    }

    remaining -= len
    current = next
    index = nextIndex
  }

  return { point: current, index }
}


export function lateralOffset(
  p: Vec2,
  a: Vec2,
  b: Vec2
): { offset: number; normal: Vec2; closest: Vec2 } {
  const ab = sub(b, a)
  const dir = normalize(ab)
  const normal = vec2(-dir.y, dir.x)

  const closest = closestPointOnSegment(p, a, b)
  const delta = sub(p, closest.point)

  return {
    offset: dot(delta, normal),
    normal,
    closest: closest.point
  }
}


export function findClosestSegmentIndex(
  p: Vec2,
  path: Poly,
  hint?: number
): number {
  let bestIndex = hint ?? 0
  let bestDistSq = Infinity

  const start = hint ? Math.max(0, hint - 1) : 0
  const end = hint ? Math.min(path.points.length - 2, hint + 1) : path.points.length - 1

  for (let i = start; i <= end; i++) {
    const a = path.points[i % path.points.length]
    const b = path.points[(i + 1) % path.points.length]
    const c = closestPointOnSegment(p, a, b)
    const d = len2(sub(p, c.point))

    if (d < bestDistSq) {
      bestDistSq = d
      bestIndex = i
    }
  }

  return bestIndex
}
