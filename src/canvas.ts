import { DragHandler } from "./drag"

export let drag: DragHandler
export let cx: CanvasRenderingContext2D

export function init_canvas() {

    let canvas = document.createElement('canvas')

    canvas.width = 1080
    canvas.height = 1080

    cx = canvas.getContext('2d')!

    drag = DragHandler(canvas)

    return canvas
}