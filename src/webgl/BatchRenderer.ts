// BatchRenderer.ts
// Requires: Renderer (from Option A)

import type { Renderer } from "./renderer";

type Color = { r: number; g: number; b: number; a: number };

export class BatchRenderer {
  private renderer: Renderer;

  // Instance packing details (must match shader/Renderer.setupInstancing)
  // Attribute layout (floats):
  // a_translation.x, a_translation.y,         // 2
  // a_size.x, a_size.y,                       // 2
  // a_rotation,                               // 1
  // a_color.r,g,b,a                           // 4
  // a_type,                                   // 1
  // a_radius,                                 // 1
  // a_stroke,                                 // 1
  // a_dash.x, a_dash.y                        // 2
  // a_length                                  // 1
  // ---------------------------------------------------------
  // total = 15 floats per instance

  static readonly INSTANCE_STRIDE = 15;
  private maxInstances: number;
  private buffer: Float32Array;
  private cursor = 0; // number of instances in buffer

  // temporary to avoid allocations
  //private tmpColor: Color = { r: 1, g: 1, b: 1, a: 1 };

  constructor(renderer: Renderer, maxInstances = 8192) {
    this.renderer = renderer;
    this.maxInstances = maxInstances;

    // Ensure renderer has enough capacity; if not, it's user's responsibility to create with larger maxInstances
    this.buffer = new Float32Array(maxInstances * BatchRenderer.INSTANCE_STRIDE);
  }

  beginFrame() {
    this.cursor = 0;
    // Any per-frame state resets would go here
  }

  endFrame() {
    this.flush();
  }

  pushMask() {
    this.flush()
    this.renderer.pushMask()
  }

  popMask() {
    this.flush()
    this.renderer.popMask()
  }

  endMask() {
    this.flush()
    this.renderer.endMask()
  }

  private ensureCapacity(additional: number) {
    if (this.cursor + additional > this.maxInstances) {
      // flush existing data and continue
      this.flush();
      if (additional > this.maxInstances) {
        throw new Error("Requested instance count exceeds maxInstances");
      }
    }
  }

  private pushInstance(data: number[]) {
    // data length must equal stride
    const base = this.cursor * BatchRenderer.INSTANCE_STRIDE;
    for (let i = 0; i < BatchRenderer.INSTANCE_STRIDE; i++) {
      this.buffer[base + i] = data[i] ?? 0;
    }
    this.cursor++;
  }

  /** Fill rectangle (no stroke). rotation in radians. */
  fillRect(x: number, y: number, w: number, h: number, color: Color, rotation = 0) {
    this.ensureCapacity(1);
    const type = 0.0; // rect fill type
    const radius = 0.0;
    const stroke = 0.0;
    const dashX = 0.0, dashY = 0.0;
    const length = 0.0;

    this.pushInstance([
      x, y,
      w, h,
      rotation,
      color.r, color.g, color.b, color.a,
      type,
      radius,
      stroke,
      dashX, dashY,
      length
    ]);
  }

  /** Round rect fill */
  fillRoundRect(x: number, y: number, w: number, h: number, radiusPx: number, color: Color, rotation = 0) {
    this.ensureCapacity(1);
    const type = 1.0; // roundRect fill
    const stroke = 0.0;
    this.pushInstance([
      x, y,
      w, h,
      rotation,
      color.r, color.g, color.b, color.a,
      type,
      radiusPx,
      stroke,
      0.0, 0.0,
      0.0
    ]);
  }

  /** Stroke a rectangle (or any shape). strokeWidth is in px. dash: [dashLen,gapLen] */
  strokeRoundRect(x: number, y: number, w: number, h: number, radiusPx: number, strokeWidth: number, color: Color, dash: [number, number] = [0,0], rotation = 0) {
    this.ensureCapacity(1);
    const type = 1.0; // use roundRect SDF but with stroke>0
    this.pushInstance([
      x, y,
      w + strokeWidth, h + strokeWidth,
      rotation,
      color.r, color.g, color.b, color.a,
      type,
      radiusPx,
      strokeWidth,
      dash[0], dash[1],
      0.0
    ]);
  }

  /** Stroke rectangle without rounded corners using roundRect SDF with radius=0 */
  strokeRect(x: number, y: number, w: number, h: number, strokeWidth: number, color: Color, dash: [number, number] = [0,0], rotation = 0) {
    this.ensureCapacity(1);
    const type = 0.0; // rectangle type
    this.pushInstance([
      x, y,
      w + strokeWidth, h + strokeWidth,
      rotation,
      color.r, color.g, color.b, color.a,
      type,
      0.0,
      strokeWidth,
      dash[0], dash[1],
      0.0
    ]);
  }


  /** Stroke circle */
  fillCircle(x: number, y: number, radius: number, color: Color, dash: [number, number] = [0,0]) {
    this.ensureCapacity(1);
    const type = 3.0; // rectangle type
    let w = radius * 2
    let h = radius * 2
    this.pushInstance([
      x, y,
      w, h,
      0,
      color.r, color.g, color.b, color.a,
      type,
      radius,
      0.0,
      dash[0], dash[1],
      0.0
    ]);
  }

  /** Stroke circle */
  strokeCircle(x: number, y: number, radius: number, strokeWidth: number, color: Color, dash: [number, number] = [0,0]) {
    this.ensureCapacity(1);
    const type = 3.0; // rectangle type
    let w = radius * 2
    let h = radius * 2
    this.pushInstance([
      x, y,
      w + strokeWidth * 2, h + strokeWidth * 2,
      0,
      color.r, color.g, color.b, color.a,
      type,
      radius,
      strokeWidth,
      dash[0], dash[1],
      0.0
    ]);
  }



  /**
   * Stroke line with round caps (capsule).
   * (x1,y1) -> (x2,y2)
   * thickness = total pixel thickness
   * dash optional
   */
  strokeLine(x1: number, y1: number, x2: number, y2: number, thickness: number, color: Color, dash: [number, number] = [0,0]) {
    this.ensureCapacity(1);

    // compute length and rotation
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const rotation = Math.atan2(dy, dx);

    const quadW = len + thickness + 8
    const quadH = thickness + 8

    // For a capsule we position the instance center at midpoint
    const cx = (x1 + x2) * 0.5;
    const cy = (y1 + y2) * 0.5;

    const type = 2.0; // capsule line
    const radius = thickness * 0.5;
    const stroke = 0.0; // stroke=0 -> filled capsule (we consider line as filled capsule)
    this.pushInstance([
      cx, cy,
      quadW, quadH,
      rotation,
      color.r, color.g, color.b, color.a,
      type,
      radius,
      stroke,
      dash[0], dash[1],
      len // v_length used by capsule sdf
    ]);
  }

  // A utility that packs a colored circle (if you want later). For now we skip circle SDF in shader.
  // flush: pushes data into renderer and calls draw
  flush() {
    if (this.cursor === 0) return;
    // upload to renderer
    // renderer expects a Float32Array with consecutive instances in the same order
    // We will copy from our local buffer into renderer.instanceData and set the renderer.instanceCount then call renderer.flush

    const floatsToUpload = this.cursor * BatchRenderer.INSTANCE_STRIDE;
    const uploadArray = this.buffer.subarray(0, floatsToUpload);

    // The renderer in Option A had this.instanceData and a method to bufferSubData in flush().
    // We'll write directly into renderer.instanceData (if space) else fall back to bufferSubData via a temporary.
    if (this.renderer.instanceData.length >= floatsToUpload) {
      // fast path: copy into renderer's instanceData
      this.renderer.instanceData.set(uploadArray, 0);
    } else {
      // (unlikely) allocate a temporary and let renderer.bufferSubData handle it
      // (Renderer.flush() does bufferSubData on the amount of instances)
      // we will set renderer.instanceData to a new array — keep it simple
      this.renderer.instanceData = new Float32Array(uploadArray); // minor reallocation
    }

    // Set count then call renderer.flush()
    this.renderer.instanceCount = this.cursor;
    this.renderer.flush();

    // reset cursor
    this.cursor = 0;
  }
}
