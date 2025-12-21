import { AnimChannel } from "./anim"
import { colors, vibrant } from "./colors_in_gl"
import type { DragHandler } from "./drag"
import type { SceneName } from "./main"
import { add, rotateVec2, sub, vec2, type Vec2 } from "./math/vec2"
import type { BatchRenderer } from "./webgl/BatchRenderer"
import { type Color as TetroColor, Grid, Utils, type Shape as TetroShape } from './tetro'
import { hitbox_rect, render_poly } from "./simulation2"
import { box_intersect_ratio, rect, type Rect  } from "./math/rect"
import { pointInPolygon, poly_from_rect } from "./math/polygon"
import { createDashedLineOptimized, line } from "./math/line"
import type { Color } from "./webgl/color"

let collisions = false
//collisions = true

let cursor: Cursor

type Cursor = {
    xy: Vec2
    follow: {
        x: AnimChannel
        y: AnimChannel
    }
}

type Shape = {
    xy: Vec2
    cells: Vec2[]
    size: AnimChannel,
    color: TetroColor,
    drag?: {
        x: AnimChannel,
        y: AnimChannel,
        decay: Vec2
    }
}

let shape: Shape

let shape_box = rect(1500, 200, 65 * 4 + 50, 65 * 4 + 50)
let shape_poly = poly_from_rect(shape_box, Math.PI * 0.25)

let cell_boxes: Rect[]

type Slot = 'a' | 'b' | 'c' | 'd'


type Grids = Record<Slot, Grid>

let grids: Grids

function find_cells_from_tetro(shape: TetroShape) {
    let cells = []
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            if (shape[i][j] === 'empty') {
                cells.push(vec2(i, j))
            }
        }
    }
    return cells
}

let grid_boxes: Record<Slot, Rect[][]>



function fill_grid_boxes(x: number, y: number, theta: number) {

    let res: Rect[][] = []

    for (let i = 0; i < 8; i++) {
        res[i] = []
        for (let j = 0; j < 8; j++) {
            let ab = vec2(i * 50, j * 50)
            ab = sub(ab, vec2(off_grid, off_grid))
            ab = sub(ab, vec2(12, 12))
            ab = rotateVec2(ab, theta)
            ab = add(ab, vec2(off_grid, off_grid))
            ab = add(ab, vec2(12, 12))
            ab = rotateVec2(ab, Math.PI * 0.25)
            res[i][j] = rect(x + ab.x, y + ab.y, 50, 50)
        }
    }

    return res
}

let time: number

function empty_grid_lines(grid: Grid) {
    let res = [
        [0, 0],
        [0, 1], [1, 0],
        [0, 2], [1, 1], [2, 0],
        [0, 3], [1, 2], [2, 1], [3, 0],
        [0, 4], [1, 3], [2, 2], [3, 1], [4, 0],
        [0, 5], [1, 4], [2, 3], [3, 2], [4, 1], [5, 0],
        [0, 6], [1, 5], [2, 4], [3, 3], [4, 2], [5, 1], [6, 0]
    ]

    for (let [i, j] of res) {
        grid.cells[i][j] = null
    }
}

let gx = 900
let gy = -8

export function _init() {

    grids = {
        a: new Grid(8, 8, 'empty'),
        b: new Grid(8, 8, 'empty'),
        c: new Grid(8, 8, 'empty'),
        d: new Grid(8, 8, 'empty'),
    }

    empty_grid_lines(grids.a)
    empty_grid_lines(grids.b)
    empty_grid_lines(grids.c)
    empty_grid_lines(grids.d)


    grid_boxes = {
        a: fill_grid_boxes(gx, gy, 0),
        b: fill_grid_boxes(gx, gy, Math.PI * 0.5),
        c: fill_grid_boxes(gx, gy, Math.PI),
        d: fill_grid_boxes(gx, gy, Math.PI * 1.5),
    }

    time = 0

    let tetro = Utils.random_shape()
    shape = {
        size: new AnimChannel(65),
        xy: vec2(shape_box.xy.x + shape_box.wh.x / 2, shape_box.xy.y + shape_box.wh.y / 2),
        cells: find_cells_from_tetro(tetro.shape),
        color: tetro.color
    }
    cursor = {
        xy: vec2(500, 500),
        follow: {
            x: new AnimChannel(),
            y: new AnimChannel(),
        }
    }
}

function fill_cell_boxes(shape: Shape) {

    let x = shape.xy.x
    let y = shape.xy.y


    if (shape.drag) {
        x = shape.drag.x.value
        y = shape.drag.y.value
    }

    y -= off

    let res = []

    let size =shape.size.value
    for (let cell of shape.cells) {
        let ab = vec2(cell.x * size, cell.y * size)
        ab = rotateVec2(ab, Math.PI * 0.25)
        res.push(rect(x + ab.x, y + ab.y, size, size))
    }

    return res
}

export function _update(delta: number) {

    time += delta / 1000
    cursor.follow.x.followTo(drag.is_hovering[0])
    cursor.follow.y.followTo(drag.is_hovering[1])

    cursor.xy.x = cursor.follow.x.value
    cursor.xy.y = cursor.follow.y.value

    cursor.follow.x.update(delta / 1000)
    cursor.follow.y.update(delta / 1000)

    let is_hit = pointInPolygon(cursor.xy, shape_poly)



    if (drag.is_just_down) {

        if (is_hit) {

            shape.size.springTo(50, { stiffness: 800, damping: 10 })
            shape.drag = {
                x: new AnimChannel(cursor.xy.x),
                y: new AnimChannel(cursor.xy.y),
                decay: vec2(0, 0)
            }
        }
    }


    if (shape.drag) {

        for (let slot of Slots) {
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    if (grids[slot].cells[i][j] === 'ghost') {
                        grids[slot].cells[i][j] = 'empty'
                    }
                }
            }
        }

        let hit_slot
        let hit_grid: [number, number, number, number][] = []
        for (let slot of Slots) {
            if (hit_slot !== undefined) {
                break
            }
            for (let k = 0; k < 8; k++) {
                for (let l = 0; l < 8; l++) {

                    for (let i = 0; i < 4; i++) {
                        let box = cell_boxes[i]
                        let grid_box = grid_boxes[slot][k][l]
                        let ratio = box_intersect_ratio(grid_box, box)

                        if (ratio > 0) {
                            let e = hit_grid.findIndex(_ => _[0] === i)

                            if (e !== -1) {

                                if (hit_grid[e][3] > ratio) {
                                    continue
                                } else {
                                    hit_grid.splice(e, 1)
                                }
                            }
                            hit_slot = slot
                            hit_grid.push([i, k, l, ratio])
                        }
                    }
                }
            }
        }

        if (hit_slot) {

            let valid_hits = []
            for (let hit of hit_grid) {
                let [, k, l] = hit
                if (grids[hit_slot].cells[k][l] === 'empty') {
                    valid_hits.push(hit)
                }
            }


            if (valid_hits.length === 4) {
                for (let hit of valid_hits) {
                    let [, k, l] = hit
                    grids[hit_slot].cells[k][l] = 'ghost'
                }
            }
        }

        if (drag.has_moved_after_last_down) {
            shape.drag.x.followTo(cursor.xy.x)
            shape.drag.y.followTo(cursor.xy.y)
        }


        shape.drag.x.update(delta / 1000)
        shape.drag.y.update(delta / 1000)
    }

    shape.size.update(delta / 1000)

    if (drag.is_up) {
        if (shape.drag) {
            shape.size.springTo(65, { stiffness: 800, damping: 8 })
            shape.drag = undefined
        }


        let hit = false
        for (let slot of Slots) {
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    if (grids[slot].cells[i][j] === 'ghost') {
                        grids[slot].cells[i][j] = 'fall'
                        hit = true
                    }
                }
            }
        }

        if (hit) {

            fall_cooldown = 0

            let tetro = Utils.random_shape()
            shape = {
                size: new AnimChannel(65),
                xy: vec2(shape_box.xy.x + shape_box.wh.x / 2, shape_box.xy.y + shape_box.wh.y / 2),
                cells: find_cells_from_tetro(tetro.shape),
                color: tetro.color
            }
        }
    }

    update_grid(delta)

    drag.update(delta)


    cell_boxes = fill_cell_boxes(shape)

}


let fall_cooldown: number = 0
function update_grid(delta: number) {

    fall_cooldown += delta / 1000

    if (fall_cooldown > .2) {
        fall_logic()
        fall_cooldown = 0
    }
}

function fall_logic() {
    for (let slot of Slots) {
        let falls = []
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (grids[slot].cells[i][j] === 'fall') {
                    falls.push(vec2(i, j))
                }
            }
        }

        if (falls.length === 4) {

            let nexts: Vec2[] = []
            let valids: Vec2[] = []

            let dirs = [vec2(1, 1), vec2(1, 0), vec2(0, 1)]

            for (let dir of dirs) {
                nexts = falls.map(_ => add(_, dir))

                for (let v of falls) {
                    grids[slot].cells[v.x][v.y] = 'empty'
                }

                valids = nexts.filter(_ => _.x < 8 && _.y < 8)


                valids = valids.filter(_ => grids[slot].cells[_.x][_.y] === 'empty')

                if (valids.length === 4) {
                    break
                }
            }

            if (valids.length < 4) {

                for (let i = 0; i < 4; i++) {
                    let v = falls[i]
                    grids[slot].cells[v.x][v.y] = shape.color
                }

                continue
            }

            for (let v of valids) {
                grids[slot].cells[v.x][v.y] = 'fall'
            }
        }
    }
}


export function _render() {

    batch.beginFrame()

    batch.fillRect(1920/2, 1080/2, 1920, 1080, vibrant.darkblue)


    batch.strokeLine(400, 40, 1400, 1040, 1, vibrant.white)
    batch.strokeLine(1400, 40, 400, 1040, 3, vibrant.white, [10, 8])


    render_cover()


    render_grid(grids.a, gx, gy, 0)
    render_grid(grids.b, gx, gy, Math.PI * 0.5)
    render_grid(grids.c, gx, gy, Math.PI)
    render_grid(grids.d, gx, gy, Math.PI * 1.5)

    render_shape(shape)


    render_cursor()

    render_debug()

    batch.endFrame()
}

let off_grid = 50 * 7 + 50 / 2
function render_grid(grid: Grid, x: number, y: number, theta: number) {

    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            if (grid.cells[i][j] === null) {
                continue
            }
            let ab = vec2(i * 50, j * 50)
            ab = sub(ab, vec2(off_grid, off_grid))
            ab = sub(ab, vec2(12 , 12))
            ab = rotateVec2(ab, theta)
            ab = add(ab, vec2(off_grid, off_grid))
            ab = add(ab, vec2(12, 12))
            ab = rotateVec2(ab, Math.PI * 0.25)

            batch.strokeRect(x + ab.x, y + ab.y, 50, 50, 1, colors.white, undefined, theta + Math.PI * 0.25)

            if (grid.cells[i][j] === 'ghost') {
                batch.fillRect(x + ab.x, y + ab.y, 40, 40, colors.white, theta + Math.PI * 0.25)
            }

            if (grid.cells[i][j] === 'fall') {
                batch.fillRect(x + ab.x, y + ab.y, 30, 30, colors.white, theta + Math.PI * 0.25)
            }
            if (grid.cells[i][j] !== 'empty') {
                batch.fillRect(x + ab.x, y + ab.y, 30, 30, colors.yellow, theta + Math.PI * 0.25)
            }
        }
    }
}

function render_cursor() {
    let x = cursor.xy.x
    let y = cursor.xy.y
    batch.fillRect(x, y, 24, 24, colors.white, Math.PI * 0.25)
}

function render_debug() {
    if (collisions) {
        hitbox_rect(shape_box)
        batch.strokeRect(shape_box.xy.x, shape_box.xy.y, shape_box.wh.x + 50, shape_box.wh.y + 50, 1, colors.red, undefined, Math.PI * 0.25)
        render_poly(shape_poly)


        for (let box of cell_boxes) {
            batch.strokeRect(box.xy.x, box.xy.y, box.wh.x, box.wh.y, 1, colors.blue, undefined, Math.PI * 0.25)
        }

        for (let slot of Slots) {
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    let box = grid_boxes[slot][i][j]
                    batch.strokeRect(box.xy.x, box.xy.y, box.wh.x, box.wh.y, 1, colors.blue, undefined, Math.PI * 0.25)
                }
            }
        }
    }
}

const Slots: Slot[] = ['a', 'b', 'c', 'd']

function render_cover() {
    let poly = shape_poly
    for (let { A, B } of poly._edges) {
        //batch.strokeLine(A.x, A.y, B.x, B.y, 1, vibrant.white)
        dashed_line(A.x, A.y, B.x, B.y, 1, vibrant.white)
    }
}

export function dashed_line(x: number, y: number, x2: number, y2: number, thickness: number, color: Color) {

    let t = 10

    let dash = 50 + Math.abs(Math.sin(t) * 10)
    let gap = Math.abs(Math.sin(t) * 50)
    let lines = createDashedLineOptimized(line(x, y, x2, y2), dash, gap, 0)
    //batch.strokeLine(l.x1, l.y1, l.x2, l.y2, thickness, color)
    for (let line of lines) {
        batch.strokeLine(line.x1, line.y1, line.x2, line.y2, thickness, color)
    }

}

const off = 
Math.sqrt(65 * 4 * 65 * 4 + 65 * 4 * 65 * 4) / 2
- Math.sqrt(65 * 65 + 65 * 65) / 2
function render_shape(shape: Shape) {
    let x = shape.xy.x
    let y = shape.xy.y

    if (shape.drag) {
        x = shape.drag.x.value
        y = shape.drag.y.value
    }

    let size = shape.size.value
    y -= off
    for (let cell of shape.cells) {
        let ab = vec2(cell.x * size, cell.y * size)
        ab = rotateVec2(ab, Math.PI * 0.25)

        batch.fillRoundRect(x + ab.x, y + ab.y, size, size, 3, vibrant.white, Math.PI * 0.25)
    }
}

let batch: BatchRenderer
let drag: DragHandler
export function _set_ctx(set_batch: BatchRenderer, set_drag: DragHandler) {
    batch = set_batch
    drag = set_drag
}

let set_next_scene: SceneName | undefined = undefined
export function next_scene() {
    let res =  set_next_scene
    if (res !== undefined){
        set_next_scene = undefined
        return res
    }
}

export function _cleanup() {

}