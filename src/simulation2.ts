import type { SceneName } from "./main"
import { colors } from './colors_in_gl'
import { box_intersect, rect, type Rect } from "./math/rect"
import { AudioContent } from "./audio/audio"
import { rotateVec2, vec2, type Vec2 } from "./math/vec2"
import type { BatchRenderer } from "./webgl/BatchRenderer"
import { agent, ConvexPolygonBoundary, CorridorFollow, PathFollow, Seek, update_agent, Wander, type Agent, type Boundary, type SteeringBehavior } from "./math/steer"
import type { DragHandler } from "./drag"
import { poly_from_rect, type Poly } from "./math/polygon"
import { AnimChannel } from "./anim"


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
        poly_from_rect(rect(150, 0, 1500, 30)),
        poly_from_rect(rect(150, 810, 1500, 30)),
        poly_from_rect(rect(340, 0, 30, 1500)),
        poly_from_rect(rect(1550, 0, 30, 1500)),
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
            maxSpeed: 500,
            maxForce: 1000,
            turnRate: 10
        }),
        behaviors: [
            //new Wander(1, 50, 500, Math.PI),
            new Seek(8, cursor_inside_surface_target_provider),
            new PathFollow(2, path, 100, 10),
            new CorridorFollow(1, path, 1, 1),
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

export function _render() {

    batch.beginFrame()

    batch.fillRect(1920/2, 1080/2, 1920, 1080, colors.darkblue)
    batch.fillRect(1920/2, 420, 1200 - 18, 800 - 18, colors.red)

    render_car(car.xy.x, car.xy.y, car.theta)

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

    let [shadow, color] = [colors.darkred, colors.pink]

    let mxy = vec2(w/4, -h/2 + 15)
    let mxy2 = vec2(w / 2, -h/2 + 24)

    let mxy3 = vec2(-w/4, -h/2 + 15)
    let mxy4 = vec2(-w / 2, -h/2 + 24)

    let shadow_off = 12
    let lthick = 7
    let thick = 9

    xy.y += shadow_off
    batch.fillRoundRect(xy.x, xy.y, w + thick / 2, h + thick/ 2, 8, shadow, theta)

    let lxy = mxy
    let lxy2 = mxy2
    lxy = rotateVec2(lxy, theta)
    lxy2 = rotateVec2(lxy2, theta)
    batch.strokeLine(xy.x + lxy.x, xy.y + lxy.y, xy.x + + lxy2.x, xy.y + lxy2.y, thick / 2 + lthick, shadow)

    lxy = mxy3
    lxy2 = mxy4
    lxy = rotateVec2(lxy, theta)
    lxy2 = rotateVec2(lxy2, theta)
    batch.strokeLine(xy.x + lxy.x, xy.y + lxy.y, xy.x + lxy2.x, xy.y + lxy2.y, thick / 2 + lthick, shadow)


    xy.y -= shadow_off
    batch.fillRoundRect(xy.x, xy.y, w + thick, h + thick, 8, shadow, theta)

    lxy = mxy
    lxy2 = mxy2
    lxy = rotateVec2(lxy, theta)
    lxy2 = rotateVec2(lxy2, theta)
    batch.strokeLine(xy.x + lxy.x, xy.y + lxy.y, xy.x + lxy2.x, xy.y + lxy2.y, lthick + thick, shadow)

    lxy = mxy3
    lxy2 = mxy4
    lxy = rotateVec2(lxy, theta)
    lxy2 = rotateVec2(lxy2, theta)
    batch.strokeLine(xy.x + lxy.x, xy.y + lxy.y, xy.x + lxy2.x, xy.y + lxy2.y, lthick + thick, shadow)


    batch.fillRoundRect(xy.x, xy.y, w, h, 8, color, theta)

    lxy = mxy
    lxy2 = mxy2
    lxy = rotateVec2(lxy, theta)
    lxy2 = rotateVec2(lxy2, theta)
    batch.strokeLine(xy.x + lxy.x, xy.y + lxy.y, xy.x + lxy2.x, xy.y + lxy2.y, lthick, color)

    lxy = mxy3
    lxy2 = mxy4
    lxy = rotateVec2(lxy, theta)
    lxy2 = rotateVec2(lxy2, theta)
    batch.strokeLine(xy.x + lxy.x, xy.y + lxy.y, xy.x + lxy2.x, xy.y + lxy2.y, lthick, color)


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