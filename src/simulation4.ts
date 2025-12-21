import { AnimChannel } from "./anim"
import { vibrant } from "./colors_in_gl"
import { Delay } from "./delay"
import type { DragHandler } from "./drag"
import type { SceneName } from "./main"
import { box_intersect_ratio, rect, type Rect } from "./math/rect"
import { add, mul, mulScalar, normalize, vec2, type Vec2 } from "./math/vec2"
import { hitbox_rect } from "./simulation2"
import type { BatchRenderer } from "./webgl/BatchRenderer"
import { Color } from "./webgl/color"

let collisions = false
//collisions = true

type Cursor = {
    xy: Vec2

    hover_cell?: Cell
}

let cursor: Cursor

const Very_High_Spring = { stiffness: 2800, damping: 0 }
const High_Spring = { stiffness: 800, damping: 8 }
const Low_Spring = { stiffness: 800, damping: 24 }

const Fast_Spring = { stiffness: 1800, damping: 80 }


class Flash {

    static flashes: Flash[] = []

    static flash = (xy: Vec2, wh: Vec2, delay: number = 50) => {
        Flash.flashes.push(new Flash(xy, wh, delay))
    }

    a: AnimChannel

    xy: Vec2
    wh: Vec2

    delay: Delay

    constructor(xy: Vec2, wh: Vec2, delay: number) {
        this.xy = xy
        this.wh = wh
        this.a = new AnimChannel()
        this.delay = new Delay().set_line(`${delay}`)
    }

    update(delta: number) {
        this.a.update(delta / 1000)
        this.delay.update(delta)

        if (this.delay.action === 'end') {
            Flash.flashes.splice(Flash.flashes.indexOf(this), 1)
        }
    }
}


class Split {

    static fire = (xy: Vec2, wh: Vec2, color: Color, iteration: number, omit_dir: Vec2 = vec2()) => {
        if (iteration === 0) {
            return
        }
        if (omit_dir.x !== 1) {
            Split.splits.push(new Split(xy, wh, color, iteration, vec2(1, 0)).springX(vec2(wh.x * 1.5, 0)))
        }
        if (omit_dir.x !== -1) {
            Split.splits.push(new Split(xy, wh, color, iteration, vec2(-1, 0)).springX(vec2(-wh.x * 1.5, 0)))
        }
        if (omit_dir.y !== 1) {
            Split.splits.push(new Split(xy, wh, color, iteration, vec2(0, 1)).springX(vec2(0, wh.y * 1.5)))
        }
        if (omit_dir.y !== -1) {
            Split.splits.push(new Split(xy, wh, color, iteration, vec2(0, -1)).springX(vec2(0, -wh.y * 1.5)))
        }
    }

    static splits: Split[] = []

    get xy() {
        return vec2(this.x.value, this.y.value)
    }

    get wh() {
        return vec2(this.w.value, this.h.value)
    }

    x: AnimChannel
    y: AnimChannel
    w: AnimChannel
    h: AnimChannel

    color: Color

    iteration: number

    delay: Delay
    fire_delay: Delay

    base_xy: Vec2
    base_wh: Vec2

    dir: Vec2

    constructor(xy: Vec2, wh: Vec2, color: Color, iteration: number, dir: Vec2) {
        this.dir = dir
        this.base_xy = xy
        this.base_wh = wh
        this.color = color
        this.x = new AnimChannel(xy.x)
        this.y = new AnimChannel(xy.y)
        this.w = new AnimChannel(wh.x)
        this.h = new AnimChannel(wh.y)
        this.iteration = iteration
        this.delay = new Delay()
        this.fire_delay = new Delay().set_line(`234 fire`)
    }

    springX(xy: Vec2) {
        this.base_xy = add(this.base_xy, xy)
        this.x.springTo(this.x.value + xy.x, Fast_Spring)
        this.y.springTo(this.y.value + xy.y, Fast_Spring)

        if (xy.x === 0) {
            this.delay.set_line(`123 shrink_height 127 shrink_width elongate_height 66`)
        } else {
            this.delay.set_line(`123 shrink_width 127 shrink_height elongate_width 66`)
        }

        Flash.flash(this.base_xy, mulScalar(this.wh, 1.12))

        return this
    }

    update(delta: number) {

        this.delay.update(delta)
        this.fire_delay.update(delta)

        if (this.delay.action === 'elongate_width') {
            this.w.springTo(70, Low_Spring)
        } else if (this.delay.action === 'elongate_height') {
            this.h.springTo(70, Low_Spring)
        }
        if (this.delay.action === 'shrink_height') {
            this.h.springTo(20, Low_Spring)
        } else if (this.delay.action === 'shrink_width') {
            this.w.springTo(20, Low_Spring)
        } else if (this.delay.action === 'end') {
            Split.splits.splice(Split.splits.indexOf(this), 1)
            let wh = mul(this.wh, this.wh.x > this.wh.y ? vec2(1, 0.3) : vec2(0.3, 1))
            Flash.flash(this.xy, wh, 10)
        } 
        
        if (this.fire_delay.action === 'fire') {
            Split.fire(this.base_xy, mulScalar(this.base_wh, 0.5), this.color, this.iteration - 1, mulScalar(this.dir, -1))
        }



        this.x.update(delta / 1000)
        this.y.update(delta / 1000)
        this.w.update(delta / 1000)
        this.h.update(delta / 1000)

    }
}

class Cell {

    static cells: Cell[]

    static Pop_Hover_Timeout = 1000

    xy: Vec2
    color: Color

    a: AnimChannel

    b: AnimChannel

    delay: Delay

    constructor(xy: Vec2, color: Color) {
        this.xy = xy
        this.color = color
        this.a = new AnimChannel(10)
        this.b = new AnimChannel(0)
        this.delay = new Delay()
    }

    match() {
        this.a.springTo(0, High_Spring)
    }

    release() {
        this.a.springTo(10, Low_Spring)
    }

    pop() {
        let xy = this.xy
        let wh = vec2(100, 100)
        Split.fire(xy, wh, this.color, 2)

        Flash.flash(xy, vec2(200, 200), 50)

        this.a.springTo(60, Very_High_Spring)
    }

    update(delta: number) {
        this.delay.update(delta)

        this.a.update(delta / 1000)
        this.b.update(delta / 1000)
    }
}


export function _init() {

    cursor = {
        xy: vec2()
    }

    Cell.cells = [
        new Cell(vec2(800, 500), vibrant.yellow)
    ]

}

function cell_box(cell: Cell) {
    let w = 200
    return rect(cell.xy.x - w / 2, cell.xy.y - w / 2, w, w)
}

let cursor_box: Rect

export function _update(delta: number) {

    cursor.xy = vec2(drag.is_hovering[0], drag.is_hovering[1])

    cursor_box = rect(cursor.xy.x - 16, cursor.xy.y - 16, 32, 32)

    let hit_cell
    for (let cell of Cell.cells) {
        if (box_intersect_ratio(cursor_box, cell_box(cell)) > 0.1) {
            hit_cell = cell
            break
        }
    }

    if (cursor.hover_cell) {
        if (hit_cell !== cursor.hover_cell) {
            cursor.hover_cell?.release()
            delete cursor.hover_cell
        }
    }

    if (hit_cell) {
        cursor.hover_cell = hit_cell
        cursor.hover_cell.match()
    }

    if (drag.is_just_down) {
        if (cursor.hover_cell) {
            cursor.hover_cell.pop()
        }
    }

    for (let cell of Cell.cells) {
        cell.update(delta)
    }

    for (let split of Split.splits) {
        split.update(delta)
    }

    for (let flash of Flash.flashes) {
        flash.update(delta)
    }


    drag.update(delta)
}

export function _render() {

    batch.beginFrame()
    batch.fillRect(1920/2, 1080/2, 1920, 1080, vibrant.darkblue)



    for (let cell of Cell.cells) {
        draw_cell(cell)
    }

    for (let split of Split.splits) {
        draw_split(split)
    }

    for (let flash of Flash.flashes) {
        draw_flash(flash)
    }



    let x = cursor.xy.x
    let y = cursor.xy.y

    batch.fillRect(x, y, 20, 20, vibrant.white, Math.PI * 0.25)

    render_debug()

    batch.endFrame()

}

function draw_flash(flash: Flash) {
    let xy = flash.xy
    let wh = flash.wh
    let color = vibrant.white
    batch.fillRect(xy.x, xy.y, wh.x, wh.y, color)
}

function draw_split(split: Split) {
    let xy = split.xy
    let wh = split.wh
    let color = split.color

    batch.fillRect(xy.x, xy.y, wh.x, wh.y, color)
}

function render_debug() {
    if (collisions) {
        hitbox_rect(cursor_box)
        for (let cell of Cell.cells) {

            hitbox_rect(cell_box(cell))
        }
    }
}

function draw_cell(cell: Cell) {
    let x = cell.xy.x
    let y = cell.xy.y

    let a = cell.a.value
    let color = cell.color

    batch.strokeRect(x, y, 200, 200, 1, color)
    batch.fillRect(x, y, 200 - a, 200 - a, color)
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