import type { SceneName } from "./main"
import { colors, vibrant } from './colors_in_gl'
import { box_intersect, rect, type Rect } from "./math/rect"
import { AudioContent } from "./audio/audio"
import { add, fromAngle, mulScalar, rotateVec2, vec2, type Vec2 } from "./math/vec2"
import type { BatchRenderer } from "./webgl/BatchRenderer"
import { agent, Arrive, ConvexPolygonBoundary, FlightAvoidance, PathFollow, Seek, update_agent, Wander, WanderJitter, type Agent, type Boundary, type SteeringBehavior } from "./math/steer"
import type { DragHandler } from "./drag"
import { poly_from_rect, type Poly } from "./math/polygon"
import { AnimChannel } from "./anim"
import type { Mesh } from "./mesh"


let is_muted: boolean
export let audio = AudioContent()
export function play_sfx(name: string) {
    if (is_muted) {
        return
    }
    audio.play(name)
}


let COLLISIONS = false
//COLLISIONS = true

let time: number

type Car = {
    agent: Agent
    xy: Vec2
    theta: number
    behaviors: SteeringBehavior[]
    bounds: Boundary[]
    channels: {
        theta: AnimChannel
    }
}

let car: Car
let car2: Car


type Cursor = {
    xy: Vec2
}

let cursor: Cursor

let walls: Poly[]

let shapes: Poly[]

let path: Poly

const surface_box = rect(380, 40, 1150, 750)

const cursor_box = () => {
    return rect(cursor.xy.x, cursor.xy.y, 10, 10)
}

const cursor_hit = (box: Rect) => {
    return box_intersect(cursor_box(), box)
}

export function _init() {

    walls = [
        poly_from_rect(rect(150, 0, 1500, 70)),
        poly_from_rect(rect(150, 810, 1500, 70)),
        poly_from_rect(rect(340, 0, 70, 1500)),
        poly_from_rect(rect(1550, 0, 70, 1500)),
    ]



    path = poly_from_rect(rect(600, 200, 800, 500))

    shapes = [
        poly_from_rect(rect(800, 300, 200, 200))
    ]

    const cursor_inside_surface_target_provider = () => {
        if (!cursor_hit(surface_box)) {
            return undefined
        }
        return cursor.xy
    }

    time = 0
    is_muted = false


    car = {
        xy: vec2(),
        theta: 0,
        channels: {
            theta: new AnimChannel()
        },
        agent: agent(vec2(1000, 500), {
            radius: 10,
            mass: 1,
            maxSpeed: 1000,
            maxForce: 2000,
            turnRate: 10
        }),
        behaviors: [
            new WanderJitter(.8, .05),
            new Seek(8, 2, cursor_inside_surface_target_provider),
            new PathFollow(2, .7, path, 100, 10),
        ],
        bounds: [
            ...walls.map(_ => new ConvexPolygonBoundary(_)),
            ...shapes.map(_ => new ConvexPolygonBoundary(_)),
        ]
    }

    const car1_seek_target_provider = () => {
        return add(car.xy, add(
            mulScalar(fromAngle(Math.sin(time) * Math.PI), 10 + Math.random() * 10),
            rotateVec2(vec2(-200, 0), car.theta)
        ))
    }

    car2 = {
        xy: vec2(),
        theta: 0,
        channels: {
            theta: new AnimChannel()
        },
        agent: agent(vec2(1000, 500), {
            radius: 10,
            mass: .8,
            maxSpeed: 1000,
            maxForce: 2000,
            turnRate: 10
        }),
        behaviors: [
            new WanderJitter(.8, .05),
            new Arrive(1, 2, 10, car1_seek_target_provider),
            //new PathFollow(2, .7, path, 100, 10),
            new FlightAvoidance(100, () => [{position: cursor.xy, radius: 200}, { position: car.xy, radius: 100 }], 120, 1, 0.2)
        ],
        bounds: [
            ...walls.map(_ => new ConvexPolygonBoundary(_)),
            ...shapes.map(_ => new ConvexPolygonBoundary(_)),
        ]
    }



    cursor = {
        xy: vec2(500, 500)
    }
}


export function _update(delta: number) {
    time += delta / 1000

    cursor.xy = vec2(drag.is_hovering[0], drag.is_hovering[1])

    update_car(car, delta)
    update_car(car2, delta)

    drag.update(delta)
}

function update_car(car: Car, delta: number) {
    update_agent(car.agent, car.behaviors, car.bounds, delta / 1000)

    let w_behavior = car.behaviors.find(_ => _ instanceof Wander)
    if (w_behavior) {

        if (car.agent.bounds_force) {
            //w_behavior.reset(mulScalar(car.agent.bounds_force, -1))
            w_behavior.reset()
        }
    }


    car.xy = car.agent.position

    car.channels.theta.springTo(car.agent.rotation + Math.PI * 0.5, {
        stiffness: 1000,
        damping: 10
    })
    car.theta = car.channels.theta.value

    car.channels.theta.update(delta / 1000)
}


export const bull_mesh: Mesh = [
    {
        layer: 0,
        color: colors.darkblue,
        offset: vec2(0, 16),
        thicknessMul: 1.2,
        lines: [
            {
                A: vec2(30, -20),
                B: vec2(20, 60),
                thickness: 22 + 6
            },
            {
                A: vec2(-20, -30),
                B: vec2(-10, 40),
                thickness: 32 + 2
            },
        ]
    },
    {
        layer: 2,
        color: colors.darkblue,
        offset: vec2(0, 0),
        thicknessMul: 1.5,
        lines: [
            {
                A: vec2(30, -20),
                B: vec2(20, 60),
                thickness: 22 + 2
            },
            {
                A: vec2(-20, -30),
                B: vec2(-10, 40),
                thickness: 32
            },
        ]
    },
    {
        layer: 3,
        color: colors.orange,
        offset: vec2(0, 0),
        thicknessMul: 1,
        lines: [
            {
                A: vec2(30, -20),
                B: vec2(20, 60),
                thickness: 22
            },
            {
                A: vec2(-20, -30),
                B: vec2(-10, 40),
                thickness: 34
            },
        ]
    },
]

export function render_mesh(mesh: Mesh, x: number, y: number, theta: number) {

    for (let info of mesh) {
        let { color, offset, thicknessMul, lines } = info

        for (let line of lines) {
            let thickness = line.thickness * thicknessMul

            let a = vec2(offset.x + line.A.x, offset.y + line.A.y)
            let b = vec2(offset.x + line.B.x, offset.y + line.B.y)

            a = rotateVec2(a, theta)
            b = rotateVec2(b, theta)

            batch.strokeLine(x + a.x, y + a.y, x + b.x, y + b.y, thickness, color)
        }
    }
}

export function _render() {

    batch.beginFrame()

    //batch.fillRect(1920/2, 1080/2, 1920, 1080, colors.darkblue)
    batch.fillRect(1920/2, 1080/2, 1920, 1080, vibrant.darkblue)
    batch.fillRoundRect(1920/2, 420, 1220, 800, 20, colors.brown)

    //render_car(car.xy.x, car.xy.y, car.theta)
    render_car(500, 500, 0)

    render_mesh(bull_mesh, 1000, 500, 0)
    render_mesh(bull_mesh, car2.xy.x, car2.xy.y, car2.theta)
    render_mesh(bull_mesh, car.xy.x, car.xy.y, car.theta)


    render_cursor()



    render_debug()

    batch.endFrame()
}

function render_shapes() {
    for (let shape of shapes) {
        render_poly(shape)
    }
}

function render_cursor() {
    batch.fillCircle(cursor.xy.x, cursor.xy.y, 10, colors.black)
}

function render_car(x: number, y: number, theta: number) {

    let xy = vec2(x, y)
    let w = 55
    let h = 80

    //batch.fillRoundRect(1920/2 + xy.x, 420 + xy.y, w + 10, h + 20, 8, colors.darkred, theta)

    //let [shadow, color] = [colors.darkred, colors.pink]
    let [shadow, color] = [colors.darkblue, colors.orange]

    let mxy = vec2(w/4, -h/2 + 15)
    let mxy2 = vec2(w / 2, -h/2 + 10)
    let mxy2a = vec2(w / 2, -h/2 + 5)

    let mxy3 = vec2(-w/4, -h/2 + 15)
    let mxy4 = vec2(-w / 2, -h/2 + 10)
    let mxy4a = vec2(-w / 2, -h/2 + 5)

    let txy = vec2(0, h/2 - 2)
    let txy2 = vec2(Math.sin(time * 10) * 2, h/2)

    let bxy = vec2(0, -10)
    let bxy2 = vec2(2, 0)
    let bxy3 = vec2(2, 10)

    let shadow_off = 12
    let lthick = 7
    let thick = 9

    xy.y += shadow_off
    batch.fillRoundRect(xy.x, xy.y, w + thick / 2, h + thick/ 2, 8, shadow, theta)

    let lxy = mxy
    let lxy2 = mxy2
    lxy = rotateVec2(lxy, theta)
    lxy2 = rotateVec2(lxy2, theta)
    batch.strokeLine(xy.x + lxy.x, xy.y + lxy.y, xy.x + lxy2.x, xy.y + lxy2.y, thick / 2 + lthick, shadow)

    let lxy2a = mxy2a
    lxy2a = rotateVec2(lxy2a, theta)
    batch.strokeLine(xy.x + lxy2.x, xy.y + lxy2.y, xy.x + lxy2a.x, xy.y + lxy2a.y, thick / 2 + lthick / 3, shadow)

    lxy = mxy3
    lxy2 = mxy4
    lxy = rotateVec2(lxy, theta)
    lxy2 = rotateVec2(lxy2, theta)
    batch.strokeLine(xy.x + lxy.x, xy.y + lxy.y, xy.x + lxy2.x, xy.y + lxy2.y, thick / 2 + lthick, shadow)

    lxy2a = mxy4a
    lxy2a = rotateVec2(lxy2a, theta)
    batch.strokeLine(xy.x + lxy2.x, xy.y + lxy2.y, xy.x + lxy2a.x, xy.y + lxy2a.y, thick / 2 + lthick / 3, shadow)

    let ltxy = txy
    let ltxy2 = txy2
    ltxy = rotateVec2(ltxy, theta)
    ltxy2 = rotateVec2(ltxy2, theta)

    batch.strokeLine(xy.x + ltxy.x, xy.y + ltxy.y, xy.x + ltxy2.x, xy.y + ltxy2.y, thick + lthick / 2, shadow)


    xy.y -= shadow_off
    batch.fillRoundRect(xy.x, xy.y, w + thick, h + thick, 8, shadow, theta)

    // outline
    lxy = mxy
    lxy2 = mxy2
    lxy = rotateVec2(lxy, theta)
    lxy2 = rotateVec2(lxy2, theta)
    batch.strokeLine(xy.x + lxy.x, xy.y + lxy.y, xy.x + lxy2.x, xy.y + lxy2.y, lthick + thick, shadow)


    lxy2a = mxy2a
    lxy2a = rotateVec2(lxy2a, theta)
    batch.strokeLine(xy.x + lxy2.x, xy.y + lxy2.y, xy.x + lxy2a.x, xy.y + lxy2a.y, lthick / 3 + thick, shadow)


    lxy = mxy3
    lxy2 = mxy4
    lxy = rotateVec2(lxy, theta)
    lxy2 = rotateVec2(lxy2, theta)
    batch.strokeLine(xy.x + lxy.x, xy.y + lxy.y, xy.x + lxy2.x, xy.y + lxy2.y, lthick + thick, shadow)

    lxy2a = mxy4a
    lxy2a = rotateVec2(lxy2a, theta)
    batch.strokeLine(xy.x + lxy2.x, xy.y + lxy2.y, xy.x + lxy2a.x, xy.y + lxy2a.y, lthick / 3+ thick, shadow)

    ltxy = txy
    ltxy2 = txy2
    ltxy = rotateVec2(ltxy, theta)
    ltxy2 = rotateVec2(ltxy2, theta)

    batch.strokeLine(xy.x + ltxy.x, xy.y + ltxy.y, xy.x + ltxy2.x, xy.y + ltxy2.y, lthick + thick, shadow)


    // color
    let inset_spots = rotateVec2(vec2(3, 3), theta)
    batch.fillRoundRect(xy.x, xy.y, w, h, 8, colors.white, theta)
    batch.fillRoundRect(xy.x + inset_spots.x, xy.y + inset_spots.y, w - 5, h - 5, 8, color, theta)

    lxy = mxy
    lxy2 = mxy2
    lxy = rotateVec2(lxy, theta)
    lxy2 = rotateVec2(lxy2, theta)
    batch.strokeLine(xy.x + lxy.x, xy.y + lxy.y, xy.x + lxy2.x, xy.y + lxy2.y, lthick, color)

    lxy2a = mxy2a
    lxy2a = rotateVec2(lxy2a, theta)
    batch.strokeLine(xy.x + lxy2.x, xy.y + lxy2.y, xy.x + lxy2a.x, xy.y + lxy2a.y, lthick / 3, color)

    lxy = mxy3
    lxy2 = mxy4
    lxy = rotateVec2(lxy, theta)
    lxy2 = rotateVec2(lxy2, theta)
    batch.strokeLine(xy.x + lxy.x, xy.y + lxy.y, xy.x + lxy2.x, xy.y + lxy2.y, lthick, color)

    lxy2a = mxy4a
    lxy2a = rotateVec2(lxy2a, theta)
    batch.strokeLine(xy.x + lxy2.x, xy.y + lxy2.y, xy.x + lxy2a.x, xy.y + lxy2a.y, lthick / 3, color)

    ltxy = txy
    ltxy2 = txy2
    ltxy = rotateVec2(ltxy, theta)
    ltxy2 = rotateVec2(ltxy2, theta)
    batch.strokeLine(xy.x + ltxy.x, xy.y + ltxy.y, xy.x + ltxy2.x, xy.y + ltxy2.y, lthick, color)


    let lbxy = bxy
    let lbxy2 = bxy2
    let lbxy3 = bxy3
    lbxy = rotateVec2(lbxy, theta)
    lbxy2 = rotateVec2(lbxy2, theta)
    lbxy3 = rotateVec2(lbxy3, theta)
    batch.strokeLine(xy.x + lbxy.x, xy.y + lbxy.y, xy.x + lbxy2.x, xy.y + lbxy2.y, thick + lthick * 2, vibrant.white)
    batch.strokeLine(xy.x + lbxy2.x, xy.y + lbxy2.y, xy.x + lbxy3.x, xy.y + lbxy3.y, thick + lthick, vibrant.white)


}

function render_debug() {
    if (COLLISIONS) {
        walls.forEach(render_poly)
        render_rect(surface_box)
        render_rect(cursor_box())

        //batch.strokeCircle(obs1.position.x, obs1.position.y, obs1.radius, 1, colors.yellow)
        render_poly(path)

        render_shapes()
    }
}

function render_rect(rect: Rect) {
    batch.strokeRect(rect.xy.x + rect.wh.x / 2, rect.xy.y + rect.wh.y / 2, rect.wh.x, rect.wh.y, 1, colors.yellow)
}

function render_poly(poly: Poly) {
    for (let { A, B } of poly._edges) {
        batch.strokeLine(A.x, A.y, B.x, B.y, 1, colors.yellow)
    }
}

export function hitbox_rect(box: Rect) {
    let x = box.xy.x
    let y = box.xy.y
    let w = box.wh.x
    let h = box.wh.y

    batch.strokeRect(x + w / 2, y + h / 2, w, h, 7, colors.red)
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