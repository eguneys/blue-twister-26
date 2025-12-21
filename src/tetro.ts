import { arr_rnd } from "./math/random";

export type Color = 'white' | 'yellow' | 'green' | 'red' | 'black' | 'empty' | 'ghost' | 'fall' | null;


// A shape is a 2D array of Color where null means empty cell
export type Shape = Color[][];

export interface Piece {
    id: string
    color: Color
    shape: Shape
}



export class Utils {

  static random_shape(n: number = Math.random() * 8): { shape: Shape, color: Color } {
    let tetro = arr_rnd(Shapes)
    let shape = Utils.cloneShape(tetro.shape)
    //shape = Utils.cloneShape(Shapes[2].shape)
    for (let i = 0; i < n; i++) {
        shape = Utils.rotateCCW(shape)
    }
    return { shape, color: tetro.color } 
  }

  static cloneShape(shape: Shape): Shape {
    return shape.map(row => row.slice());
  }

  // rotate clockwise: NxM becomes MxN
  static rotateCW(shape: Shape): Shape {
    const h = shape.length;
    const w = shape[0].length;
    const out: Shape = Array.from({ length: w }, () => Array(w ? h : 0).fill(null));
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        out[c][h - 1 - r] = shape[r][c];
      }
    }
    return out;
  }

  static rotateCCW(shape: Shape): Shape {
    // 3xCW == CCW but we implement directly for clarity
    const h = shape.length;
    const w = shape[0].length;
    const out: Shape = Array.from({ length: w }, () => Array(h).fill(null));
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        out[w - 1 - c][r] = shape[r][c];
      }
    }
    return out;
  }

  static ij(shape: Shape): [number, number][] {
    let res: [number, number][] = []

    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        if (shape[i][j] === null) {
          continue
        }
        res.push([i, j])
      }
    }
    return res
  }

  static grid_ij(shape: Shape, gridX: number, gridY: number): [number, number][] | null {
    let res: [number, number][] = []

    let off_xy
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        if (shape[i][j] === null) {
          continue
        }
        if (off_xy === undefined) {
          off_xy = [i, j]
        }
        let gridXi = gridX + i - off_xy[0]
        let gridYj = gridY + j - off_xy[1]
        if (gridXi < 0 || gridXi >= 8 || gridYj < 0 || gridYj >= 8) {
          return null
        }
        res.push([gridXi, gridYj])
      }
    }

    return res
  }
}

export class Palette {
  private readonly cols: number;
  private readonly rows: number;
  cells: Color[][];

  constructor(cols: number, rows: number, cells: Color[][]) {
    this.cols = cols;
    this.rows = rows;
    this.cells = cells
  }

  private inside(x: number, y: number) {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
  }

  private get(x: number, y: number) {
    if (!this.inside(x, y)) return null;
    return this.cells[y][x];
  }

  place(shape: Shape, gridX: number, gridY: number): void {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[0].length; c++) {
        const cell = shape[r][c];
        if (cell === null) continue;
        let grid_color = this.get(gridX + c, gridY + r)
        if (grid_color !== null) {
            shape[r][c] = grid_color;
        }
      }
    }
  }
}

// Grid storage: each cell holds a Color or null
export class Grid {
  private readonly cols: number;
  private readonly rows: number;
  cells: Color[][];

  constructor(cols: number, rows: number, fill: Color = null) {
    this.cols = cols;
    this.rows = rows;
    this.cells = Array.from({ length: rows }, () => Array(cols).fill(fill));
  }

  private inside(x: number, y: number) {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
  }

  get(x: number, y: number) {
    if (!this.inside(x, y)) return null;
    return this.cells[y][x];
  }

  private set(x: number, y: number, color: Color) {
    if (!this.inside(x, y)) return;
    this.cells[y][x] = color;
  }

  // check if a shape (with top-left at gridX,gridY) can be placed (non-overlapping + inside bounds)
  canPlace(shape: Shape, gridX: number, gridY: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[0].length; c++) {
        const cell = shape[r][c];
        if (cell === null) continue;
        const gx = gridX + c;
        const gy = gridY + r;
        if (!this.inside(gx, gy)) return false;
        if (this.get(gx, gy) !== null) return false;
      }
    }
    return true;
  }

  // place shape (assumes canPlace was checked); writes colors into the grid
  place(shape: Shape, gridX: number, gridY: number): void {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[0].length; c++) {
        const cell = shape[r][c];
        if (cell === null) continue;
        this.set(gridX + c, gridY + r, cell);
      }
    }
  }
}

export const Shapes: Piece[] = [
  {
    id: 's',
    color: 'green',
    shape: [
      ['empty', null, null, null],
      ['empty', 'empty', null, null],
      [null,  'empty', null, null],
      [null, null, null, null],
    ]
  },
  {
    id: 't',
    color: 'yellow',
    shape: [
      ['empty', null, null, null],
      ['empty', 'empty', null, null],
      ['empty', null,  null, null],
      [null, null, null, null],
    ]
  },
  {
    id: 'o',
    color: 'white',
    shape: [
      ['empty', 'empty', null, null],
      ['empty', 'empty', null, null],
      [null,  null,  null, null],
      [null, null, null, null],
    ]
  },
  {
    id: 'l',
    color: 'red',
    shape: [
      ['empty', null, null, null],
      ['empty', null, null, null],
      ['empty', 'empty', null, null],
      [null, null, null, null],
    ]
  },
  {
    id: 'i',
    color: 'black',
    shape: [
      ['empty', null, null, null],
      ['empty', null, null, null],
      ['empty', null, null, null],
      ['empty', null, null, null],
    ]
  },
]