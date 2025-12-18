import type { SceneName } from "./main"
import { batch } from "./webgl/canvas"
//import { hitbox_rect } from "./simulation"
import { colors } from './colors_in_gl'
import type { Rect } from "./math/rect"
import { AudioContent } from "./audio/audio"
import { rotateVec2, vec2, type Vec2 } from "./math/vec2"
import type { AnimChannel } from "./anim"


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


let balls = []

type Ball = {
    xy: Vec2
    follow: { x: AnimChannel, y: AnimChannel }
}

let time: number

export function _init() {

    time = 0
    is_muted = false
}


export function _update(delta: number) {
    time += delta / 1000
}

export function _render() {

    batch.beginFrame()

    batch.fillRect(1920/2, 1080/2, 1920, 1080, colors.darkblue)

    batch.fillRect(1920/2, 420, 1200 - 18, 800 - 18, colors.red)
    batch.strokeRect(1920/2, 420, 1200 - 18, 800 - 18, 8, colors.darkred)


    let xy = vec2(0, 0)
    let w = 55
    let h = 80

    let theta = Math.sin(time)


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
    batch.fillRoundRect(1920/2 + xy.x, 420 + xy.y, w + thick / 2, h + thick/ 2, 8, shadow, theta)

    let lxy = mxy
    let lxy2 = mxy2
    lxy = rotateVec2(lxy, theta)
    lxy2 = rotateVec2(lxy2, theta)
    batch.strokeLine(1920/2 + xy.x + lxy.x, 420 + xy.y + lxy.y, 1920/2 + xy.x + + lxy2.x, 420 + xy.y + lxy2.y, thick / 2 + lthick, shadow)

    lxy = mxy3
    lxy2 = mxy4
    lxy = rotateVec2(lxy, theta)
    lxy2 = rotateVec2(lxy2, theta)
    batch.strokeLine(1920/2 + xy.x + lxy.x, 420 + xy.y + lxy.y, 1920/2 + xy.x + lxy2.x, 420 + xy.y + lxy2.y, thick / 2 + lthick, shadow)


    xy.y -= shadow_off
    batch.fillRoundRect(1920/2 + xy.x, 420 + xy.y, w + thick, h + thick, 8, shadow, theta)

    lxy = mxy
    lxy2 = mxy2
    lxy = rotateVec2(lxy, theta)
    lxy2 = rotateVec2(lxy2, theta)
    batch.strokeLine(1920/2 + xy.x + lxy.x, 420 + xy.y + lxy.y, 1920/2 + xy.x + lxy2.x, 420 + xy.y + lxy2.y, lthick + thick, shadow)

    lxy = mxy3
    lxy2 = mxy4
    lxy = rotateVec2(lxy, theta)
    lxy2 = rotateVec2(lxy2, theta)
    batch.strokeLine(1920/2 + xy.x + lxy.x, 420 + xy.y + lxy.y, 1920/2 + xy.x + lxy2.x, 420 + xy.y + lxy2.y, lthick + thick, shadow)


    batch.fillRoundRect(1920/2 + xy.x, 420 + xy.y, w, h, 8, color, theta)

    lxy = mxy
    lxy2 = mxy2
    lxy = rotateVec2(lxy, theta)
    lxy2 = rotateVec2(lxy2, theta)
    batch.strokeLine(1920/2 + xy.x + lxy.x, 420 + xy.y + lxy.y, 1920/2 + xy.x + lxy2.x, 420 + xy.y + lxy2.y, lthick, color)

    lxy = mxy3
    lxy2 = mxy4
    lxy = rotateVec2(lxy, theta)
    lxy2 = rotateVec2(lxy2, theta)
    batch.strokeLine(1920/2 + xy.x + lxy.x, 420 + xy.y + lxy.y, 1920/2 + xy.x + lxy2.x, 420 + xy.y + lxy2.y, lthick, color)

    render_debug()

    batch.endFrame()
}

function render_debug() {
    if (COLLISIONS) {

    }
}

export function hitbox_rect(box: Rect) {
    let x = box.xy.x
    let y = box.xy.y
    let w = box.wh.x
    let h = box.wh.y

    batch.strokeRect(x + w / 2, y + h / 2, w, h, 7, colors.red)
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