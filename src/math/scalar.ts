export function wrapAngle(a: number): number {
    return Math.atan2(Math.sin(a), Math.cos(a))
}

export function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
}