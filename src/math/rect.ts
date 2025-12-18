import type { Vec2 } from "./vec2"

export type Rect = {
    xy: Vec2,
    wh: Vec2
}

export function box_intersect(a: Rect, b: Rect) {
    let { xy: { x: ax, y: ay } , wh: { x: aw, y: ah } } = a
    let { xy: { x: bx, y: by } , wh: { x: bw, y: bh } } = b

    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

export function box_intersect_ratio(a: Rect, b: Rect): number {
    const { xy: { x: ax, y: ay }, wh: { x: aw, y: ah } } = a;
    const { xy: { x: bx, y: by }, wh: { x: bw, y: bh } } = b;

    // Calculate intersection rectangle
    const x1 = Math.max(ax, bx);
    const y1 = Math.max(ay, by);
    const x2 = Math.min(ax + aw, bx + bw);
    const y2 = Math.min(ay + ah, by + bh);

    // If no intersection, return 0
    if (x2 <= x1 || y2 <= y1) {
        return 0;
    }

    // Calculate areas
    const intersectionArea = (x2 - x1) * (y2 - y1);
    //const unionArea = (aw * ah) + (bw * bh) - intersectionArea;

    // Return Intersection over Union (IoU)
    //return intersectionArea / unionArea;
    return intersectionArea / (aw * ah);
}