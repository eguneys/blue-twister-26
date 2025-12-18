import { DragHandler } from "../drag"
import { BatchRenderer } from "./BatchRenderer"
import { Renderer } from "./renderer"

export type InitCanvas = {
    canvas: HTMLCanvasElement,
    cleanup: () => void
}

export let drag: DragHandler
export let batch: BatchRenderer

export function Init_canvas(): InitCanvas {

    let canvas = document.createElement('canvas')

    canvas.width = 1920
    canvas.height = 1080

    const renderer = new Renderer(canvas, 32_768)
    renderer.setupInstancing()

    batch = new BatchRenderer(renderer, 16_384)

    // TODO FIX initializing the canvas bounds before appending to DOM
    drag = DragHandler(canvas)

    return {
        canvas,
        cleanup() {
            renderer.cleanup()
            drag.cleanup()
        }
    }
}