type XY = [number, number]

export type TouchMouseHooks = {
  on_up(n: XY): void
  on_down(n: XY): void
  on_move(n: XY): void
}

export function TouchMouse(el: HTMLElement, hooks: TouchMouseHooks) {

  let bounds = el.getBoundingClientRect()

  const eventPosition = (e: PointerEvent): XY => {
    return [e.clientX, e.clientY]
  }

  let epsilon = 1
  const normalized = (e: PointerEvent): XY => {
    const [x, y] = eventPosition(e)
    return [
      (x - bounds.left) / (bounds.width + epsilon),
      (y - bounds.top) / (bounds.height + epsilon)
    ]
  }

  function on_down(ev: PointerEvent) {
    el.setPointerCapture(ev.pointerId)
    hooks.on_down(normalized(ev))
  }

  function on_up(ev: PointerEvent) {
    // release capture
    try { el.releasePointerCapture(ev.pointerId) } catch {}
    hooks.on_up(normalized(ev))
  }

  function on_move(ev: PointerEvent) {
    hooks.on_move(normalized(ev))
  }

  function update_bounds() {
    bounds = el.getBoundingClientRect()
  }

  // --- Listeners ---
  el.addEventListener('pointerdown', on_down)
  el.addEventListener('pointermove', on_move)
  document.addEventListener('pointerup', on_up)

  let resize_observer = new ResizeObserver(() => update_bounds())
  resize_observer.observe(el)
  document.addEventListener('scroll', update_bounds, { passive: true, capture: true })
  window.addEventListener('resize', update_bounds, { passive: true })


  return () => {
    // --- Listeners ---
    el.removeEventListener('pointerdown', on_down)
    el.removeEventListener('pointermove', on_move)
    document.removeEventListener('pointerup', on_up)

    resize_observer.disconnect()
    document.removeEventListener('scroll', update_bounds)
    window.removeEventListener('resize', update_bounds)


  }
}
