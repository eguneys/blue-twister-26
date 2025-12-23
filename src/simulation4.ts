import { AnimChannel } from "./anim"
import { colors, invaders, vibrant } from "./colors_in_gl"
import { Delay } from "./delay"
import type { DragHandler } from "./drag"
import type { SceneName } from "./main"
import { hash_i, rnd_float, rnd_int } from "./math/random"
import { box_intersect_ratio, rect, type Rect } from "./math/rect"
import { add, distance, mul, mulScalar, vec2, type Vec2 } from "./math/vec2"
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

//const Very_High_Spring = { stiffness: 2800, damping: 0 }
const High_Spring = { stiffness: 800, damping: 10 }
const Low_Spring = { stiffness: 800, damping: 60 }

const Fast_Spring = { stiffness: 1800, damping: 80 }
const Slow_Spring = { stiffness: 400, damping: 60 }

class Flash {

    static flashes: Flash[] = []

    static flash = (xy: Vec2, wh: Vec2, delay: number = 50) => {
        Flash.flashes.push(new Flash(xy, wh, delay))
    }

    static render = () => {
        for (let flash of Flash.flashes) {
            draw_flash(flash)
        }
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

type Direction = 'left' | 'right' | 'up' | 'down'

const All_Directions: Direction[] = ['left', 'right', 'up', 'down']

const n_direction = (a: Vec2, b: Vec2): Direction => {
    if (a.x === b.x) {
        return a.y < b.y ? 'down' : 'up'
    } else {
        return a.x < b.x ? 'right' : 'left'
    }
}

class Split {

    static fire = (xy: Vec2, wh: Vec2, color: Color, iteration: number, omit_dirs: Direction[]) => {
        if (iteration === 0) {
            return
        }
        if (!omit_dirs.includes('right')) {
            Split.splits.push(new Split(xy, wh, color, iteration, 'right').springX(vec2(wh.x * 1.5, 0)))
        }
        if (!omit_dirs.includes('left')) {
            Split.splits.push(new Split(xy, wh, color, iteration, 'left').springX(vec2(-wh.x * 1.5, 0)))
        }
        if (!omit_dirs.includes('down')) {
            Split.splits.push(new Split(xy, wh, color, iteration, 'down').springX(vec2(0, wh.y * 1.5)))
        }
        if (!omit_dirs.includes('up')) {
            Split.splits.push(new Split(xy, wh, color, iteration, 'up').springX(vec2(0, -wh.y * 1.5)))
        }
    }

    static render = () => {
        for (let split of Split.splits) {
            draw_split(split)
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

    dir: Direction

    constructor(xy: Vec2, wh: Vec2, color: Color, iteration: number, dir: Direction) {
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
            let wh = mul(this.wh, this.wh.x > this.wh.y ? vec2(1.2, 0.3) : vec2(0.3, 1.2))
            Flash.flash(this.xy, wh, 10)
        } 
        
        if (this.fire_delay.action === 'fire') {
            let dirs = All_Directions.filter(_ => _ !== this.dir)
            Split.fire(this.base_xy, mulScalar(this.base_wh, 0.5), this.color, this.iteration - 1, dirs)
        }



        this.x.update(delta / 1000)
        this.y.update(delta / 1000)
        this.w.update(delta / 1000)
        this.h.update(delta / 1000)

    }
}

type TetroColor = 'yellow' | 'red' | 'green' | 'blue'

const Tetro_Colors: TetroColor[] = ['yellow', 'red', 'green', 'blue']

const color_by_tetro_colors = {
    yellow: colors.yellow,
    red: colors.red,
    green: colors.green,
    blue: colors.blue,
}

const fill_empty_cells = () => {
    let res = []
    for (let i = 0; i < 16; i++) {
        for (let j =0; j < 10; j++) {
            res.push(vec2(i,j))
        }
    }
    return res
}


class Cell {

    static _init() {
        Cell.empty_cells = fill_empty_cells()
        Cell.cells = []
        Cell.popped_cells = []
        Cell.fall_cells = []
        Cell.is_dirty = true
        Cell.delay = new Delay().set_line('500 fall')


        //Ice.freeze(vec2(500, 500), vec2(500, 0), 20)
        //Ice.freeze(vec2(100, 100), vec2(100, 0), 20)

        let xy = Cell.XY
        let wh = Cell.WH
        for (let i = 0; i < 16; i++) {
            for (let j = 0; j < 10; j++) {
                Ice.freeze(vec2(xy.x + i * wh.x, xy.y + j * wh.y - wh.y / 2), wh, (hash_i([i, j, 8]) % 21 / 20) * 20)
            }
        }

    }

    static render() {
        for (let cell of Cell.cells) {
            draw_cell(cell)
        }
        for (let v of Cell.empty_cells) {
            draw_empty_cell(v)
        }
    }

    static update(delta: number) {
        if (Cell.is_dirty) {
            Cell.is_dirty = false
        }

        if (Cell.delay.action === 'fall') {

        }

        Cell.delay.update(delta)
    }

    static XY: Vec2 = vec2(100, 200)
    static WH: Vec2 = vec2(80, 80)

    static delay: Delay

    static empty_cells: Vec2[]

    static is_dirty: boolean
    static cells: Cell[]
    static same_cells: Cell[][]
    static popped_cells: Cell[]
    static fall_cells: Cell[]

    static Pop_Hover_Timeout = 1000

    xy: Vec2
    wh: Vec2

    ij: Vec2
    kl: Vec2
    tetro_color: TetroColor

    a: AnimChannel

    x: AnimChannel
    y: AnimChannel

    delay: Delay

    constructor(ij: Vec2, kl: Vec2, xy: Vec2, wh: Vec2, tetro_color: TetroColor) {
        this.ij = ij
        this.kl = kl
        this.xy = xy
        this.wh = wh
        this.tetro_color = tetro_color
        this.a = new AnimChannel(10)
        this.x = new AnimChannel(xy.x)
        this.y = new AnimChannel(xy.y)
        this.delay = new Delay()
    }

    get color() {
        return color_by_tetro_colors[this.tetro_color]
    }

    get is_popped_or_falling() {
        return Cell.fall_cells.includes(this) || this.is_popped
    }

    get is_popped() {
        return Cell.popped_cells.includes(this)
    }

    set is_popped(_: boolean) {
        if (_) {
            Cell.popped_cells.push(this)
        } else {
            Cell.popped_cells.splice(Cell.popped_cells.indexOf(this), 1)
        }
    }

    fall_x() {
        this.x.springTo(this.x.value + 133, Low_Spring)
    }
    fall_y() {
        this.y.springTo(this.y.value + 133, High_Spring)
    }



    match() {
        if (this.is_popped_or_falling) {
            return
        }
        this.a.springTo(0, this.a.value > 50 ? Fast_Spring : High_Spring)
    }

    release() {
        if (this.is_popped_or_falling) {
            return
        }
        this.a.springTo(10, Low_Spring)
    }

    pop() {
        if (this.is_popped_or_falling) {
            return
        }
        this.is_popped = true


        let omit_dirs: Direction[] = []

        let ij = this.ij
        for (let n_cell of Cell.same_cells.find(_ => _.includes(this))!) {

            let n_ij = n_cell.ij

            if (distance(ij, n_ij) === 1) {
                omit_dirs.push(n_direction(ij, n_ij))
            }
        }

        let xy = this.xy
        let wh = vec2(100, 100)
        Split.fire(xy, wh, this.color, 2, omit_dirs)

        Flash.flash(xy, vec2(200, 200), 60)

        this.a.springTo(50, High_Spring)

        this.delay.set_line('200')

        Cell.is_dirty = true
    }

    update(delta: number) {
        this.delay.update(delta)

        this.a.update(delta / 1000)

        this.x.update(delta / 1000)
        this.y.update(delta / 1000)

        this.xy = vec2(this.x.value, this.y.value)

        if (this.delay.action === 'end') {
            this.a.springTo(200, Slow_Spring)
        }
    }
}

export function _init() {

    cursor = {
        xy: vec2()
    }

    Ice._init()
    Cell._init()
}

function cell_box(cell: Cell) {
    let w = cell.wh.x
    let h = cell.wh.y
    return rect(cell.xy.x - w / 2, cell.xy.y - h / 2, w, h)
}

let cursor_box: Rect

export function _update(delta: number) {

    Cell.update(delta)

    cursor.xy = vec2(drag.is_hovering[0], drag.is_hovering[1])

    cursor_box = rect(cursor.xy.x - 16, cursor.xy.y - 16, 32, 32)

    let hit_cell
    for (let cell of Cell.cells) {
        if (box_intersect_ratio(cursor_box, cell_box(cell)) > 0.1) {
            hit_cell = cell
            break
        }
    }


    let cursor_hover_cell = cursor.hover_cell
    if (hit_cell) {
        if (cursor.hover_cell !== hit_cell) {
            let sames = Cell.same_cells.find(_ => _.includes(hit_cell))
            sames?.forEach(_ => _.match())
        }
        cursor.hover_cell = hit_cell
    } else {
        delete cursor.hover_cell
    }

    if (cursor_hover_cell) {
        if (hit_cell !== cursor_hover_cell) {

            let sames = Cell.same_cells.find(_ => _.includes(cursor_hover_cell!))!
            sames.forEach(_ => _.release())

            delete cursor.hover_cell
        }
    }


    if (drag.is_just_down) {
        if (cursor.hover_cell) {
            let sames = Cell.same_cells.find(_ => _.includes(cursor.hover_cell!))
            sames?.forEach(_ => _.pop())
            delete cursor.hover_cell
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

    for (let ice of Ice.ices) {
        ice.update(delta)
    }

    drag.update(delta)
}

export function _render() {

    batch.beginFrame()
    batch.fillRect(1920/2, 1080/2, 1920, 1080, vibrant.darkblue)

    Cell.render()
    Split.render()
    Flash.render()
    Ice.render()

    let x = cursor.xy.x
    let y = cursor.xy.y

    batch.fillRect(x, y, 20, 20, vibrant.white, Math.PI * 0.25)

    render_debug()

    batch.endFrame()

}

class Ice {

    static ices: Ice[]

    static _init = () => {
        Ice.ices = []
    }

    static freeze = (xy: Vec2, wh: Vec2, gaps: number) => {
        Ice.ices.push(new Ice(xy, wh, gaps))
    }

    static render = () => {
        for (let ice of Ice.ices) {
            draw_ice(ice)
        }
    }

    xy: Vec2
    wh: Vec2

    nb_gaps: number[]
    nb2_sicles: AnimChannel[]
    delay: Delay

    constructor(xy: Vec2, wh: Vec2, gaps: number) {
        this.xy = xy
        this.wh = wh
        this.nb_gaps = []
        this.nb2_sicles = []

        let budget = this.wh.x
        for (let i = 0; i < gaps; i++) {
            let gap = budget * 0.1 + rnd_int(0, 10)
            budget -= gap
            if (budget < 0) {
                break
            }
            this.nb_gaps[i] = gap
            this.nb2_sicles[i * 2] = new AnimChannel()
            this.nb2_sicles[i * 2 + 1] = new AnimChannel()
        }

        this.delay = new Delay().set_line('1000 lick')
    }

    update(delta: number) {
        this.delay.update(delta)

        for (let sicle of this.nb2_sicles) {
            sicle.update(delta / 1000)
        }

        if (this.delay.action === 'lick') {
            for (let i = 0; i < this.nb2_sicles.length; i++) {
                this.nb2_sicles[i].springTo(rnd_float(0, 30), Slow_Spring)
            }
        }

    }

}


// Liquid Ice
function draw_empty_cell(v: Vec2) {

    let x = Cell.XY.x
    let y = Cell.XY.y
    let w = Cell.WH.x
    let h = Cell.WH.y

    batch.strokeRect(x + v.x * w, y + v.y * h, w, h, 1, invaders.sand1)
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

function draw_ice(ice: Ice) {
    let xy = ice.xy
    let wh = ice.wh
    let color = colors.white

    batch.fillRect(xy.x, xy.y, wh.x, 1, vibrant.white)

    let off = 0
    let i = 0
    for (let sicle of ice.nb2_sicles) {
        off += ice.nb_gaps[i++]
        batch.fillRect(off + xy.x - wh.x / 2, xy.y + sicle.value / 2, 2, sicle.value, color)
    }
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

    let w = cell.wh.x
    let h = cell.wh.y

    let a = cell.a.value
    let color = cell.color

    batch.strokeRect(x, y, w, h, 1, vibrant.black)
    batch.fillRect(x, y, w - a, h - a, color)
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