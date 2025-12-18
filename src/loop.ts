export function Loop(update: (dt: number) => void, render: (alpha: number) => void, after_render?: () => void) {

  let is_running = true
  let animationFrameId: number
  const timestep = 1000/60
  let last_time = performance.now()
  let accumulator = 0

  function step(current_time: number) {
    if (!is_running) return
    animationFrameId = requestAnimationFrame(step)


    let delta_time = Math.min(current_time - last_time, 25)
    last_time = current_time

    accumulator += delta_time

    while (accumulator >= timestep) {
      update(timestep)
      accumulator -= timestep
    }

    render(accumulator / timestep)

    after_render?.()
  }
  animationFrameId = requestAnimationFrame(step)


  return () => {
    is_running = false
    cancelAnimationFrame(animationFrameId)
  }
}