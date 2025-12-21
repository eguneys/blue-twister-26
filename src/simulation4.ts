import { vibrant } from "./colors_in_gl"
import type { DragHandler } from "./drag"
import type { SceneName } from "./main"
import type { BatchRenderer } from "./webgl/BatchRenderer"

export function _init() {

}

export function _update(_delta: number) {

}

export function _render() {

    batch.beginFrame()
    batch.fillRect(1920/2, 1080/2, 1920, 1080, vibrant.darkblue)

    batch.endFrame()

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