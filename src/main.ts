import './style.css'
import { Loop } from "./loop"
import * as simulate from './simulation2'
import { audio } from "./simulation2"
import { Init_canvas } from './webgl/canvas'
import { DragHandler } from './drag'

type Scene = {
    _init(): void
    _update(delta: number): void
    _render(): void
    _after_render?: () => void
    _cleanup: () => void
    next_scene(): SceneName | undefined
}

const default_scene = {
    _init() {},
    _update(_delta: number) {},
    _render() {},
    _cleanup() {},
    next_scene() { return undefined }
}

let current_scene: Scene
let next_scene: Scene

function switch_to_scene(scene: Scene) {
    next_scene._cleanup?.()
    next_scene = scene
}

let Scenes: Record<string, Scene> = {
    'simulate': simulate
} as const

export type SceneName = keyof typeof Scenes;


function _init() {

    current_scene = default_scene
    next_scene = current_scene

    switch_to_scene(simulate)
}

function _update(delta: number) {

    if (next_scene !== current_scene) {
        current_scene = next_scene
        current_scene._init()
    }

    current_scene._update(delta)

    let next = current_scene.next_scene()

    if (next !== undefined) {
        switch_to_scene(Scenes[next])
    }
}

function _render() {
    current_scene._render()
}



function _after_render() {
    current_scene._after_render?.()
}

function _cleanup() {
    current_scene._cleanup()
}

export async function main(el: HTMLElement) {

    let { batch, canvas } = Init_canvas(el, _render)

    let drag = DragHandler(canvas)

    await audio.load()

    simulate._set_ctx(batch, drag)

    _init()

    let cleanup_loop = Loop(_update, _render, _after_render)


    return () => {
        cleanup_loop()
        _cleanup()
    }
}


main(document.getElementById('app')!)