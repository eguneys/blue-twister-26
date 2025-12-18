import { Color } from "./webgl/color"
import { colors as pico_colors, vibrant as vibrant_colors } from './pico_colors'

export const colors: Record<string, Color> = {}
for (let key of Object.keys(pico_colors)) {
    colors[key] = Color.fromHexString(pico_colors[key as keyof typeof pico_colors])!
}

export const vibrant: Record<string, Color> = {}
for (let key of Object.keys(vibrant_colors)) {
    vibrant[key] = Color.fromHexString(vibrant_colors[key as keyof typeof vibrant_colors])!
}


