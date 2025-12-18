import './style.css'
import { Loop } from "./loop"
import * as simulate from './simulation2'
import { audio } from "./simulation2"
import { drag, Init_canvas, type InitCanvas } from './webgl/canvas'

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

    drag.update(delta)
}

function _render() {
    current_scene._render()
}



function _after_render() {
    current_scene._after_render?.()
}

function _cleanup() {
    current_scene._cleanup()
    init_canvas.cleanup()
}

let init_canvas: InitCanvas

export async function main(el: HTMLElement) {

    init_canvas  = Init_canvas()
    let canvas = init_canvas.canvas
    canvas.classList.add('interactive')
    let $content = document.createElement('div')
    $content.classList.add('content')
    $content.appendChild(canvas)
    el.appendChild($content)

    await audio.load()
    _init()

    let cleanup_loop = Loop(_update, _render, _after_render)


    return () => {
        cleanup_loop()
        _cleanup()
    }
}


main(document.getElementById('app')!)