import type { Vec2 } from './math/vec2'
import { Color } from './webgl/color'

export type Mesh = LayeredLines[]

export type LayeredLines = {
    layer: number
    color: Color
    offset: Vec2
    thicknessMul: number
    lines: LineToDraw[]
}


export type LineToDraw = {
    A: Vec2
    B: Vec2
    thickness: number
}