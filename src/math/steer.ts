import { advanceAlongPath, closestPointOnSegment, collisionSurface, findClosestSegmentIndex, lateralOffset, type Poly } from "./polygon"
import { rect_bottom, rect_left, rect_right, rect_top, type Rect } from "./rect"
import { clamp, wrapAngle } from "./scalar"
import { add, clampLength, dot, fromAngle, len2, length, mulScalar, normalize, normalizeSafe, sub, vec2, type Vec2 } from "./vec2"

export interface Agent {
  position: Vec2
  velocity: Vec2

  rotation: number
  angularVelocity: number

  radius: number
  mass: number

  maxSpeed: number
  maxForce: number
  
  turnRate: number // radians per second

  accumulatedForce: Vec2

  bounds_force?: Vec2
}

export type AgentParams = {
    radius: number
    mass: number
    maxSpeed: number
    maxForce: number
    turnRate: number
}

export function agent(position: Vec2, params: AgentParams): Agent {
    return {
        position,
        velocity: vec2(),
        rotation: 0,
        angularVelocity: 0,
        ...params,
        accumulatedForce: vec2()
    }
}

export type SteeringForce = Vec2

export interface SteeringBehavior {
    weight: number
    compute(agent: Agent, dt: number): Vec2
}

type TargetProvider = () => Vec2 | undefined

export class Seek implements SteeringBehavior {

    weight: number
    speedFactor: number

    target: TargetProvider
    constructor(
        weight: number,
        speedFactor: number,
        target: TargetProvider,
    ) {
        this.weight = weight
        this.speedFactor = speedFactor

        this.target = target
    }

    compute(agent: Agent): Vec2 {

        let target = this.target()

        if (!target) {
            return vec2()
        }

        const toTarget = sub(target, agent.position)
        const dist = length(toTarget)

        // Epsilon to avoid floating point noise
        if (dist < 8) {
            return vec2()
        }

        const desired =
            mulScalar(normalize(toTarget), agent.maxSpeed * this.speedFactor)

        return mulScalar(sub(desired, agent.velocity), this.weight)
    }
}

export class Arrive implements SteeringBehavior {


    weight: number
    speedFactor: number

    target: TargetProvider
    slowRadius: number

  constructor(
    weight: number,
    speedFactor: number,
    slowRadius: number,
    target: TargetProvider,
  ) {
    this.weight = weight
    this.speedFactor = speedFactor
    this.target = target
    this.slowRadius = slowRadius
  }

  compute(agent: Agent): Vec2 {

    let target = this.target()
    if (!target) {
      return vec2()
    }

    const toTarget = sub(target, agent.position)
    const dist = length(toTarget)

    if (dist === 0) return vec2()

    const speed = agent.maxSpeed * this.speedFactor * Math.min(dist / this.slowRadius, 1)
    const desired = mulScalar(normalize(toTarget), speed)

    return mulScalar(sub(desired, agent.velocity), this.weight)
  }
}

export class SeparationBehavior implements SteeringBehavior {

    neighbors: () => Vec2[]
    desiredSeparation: number
    weight: number

    constructor(
        neighbors: () => Vec2[],
        desiredSeparation: number,
        weight = 1
    ) {
        this.neighbors = neighbors
        this.desiredSeparation = desiredSeparation
        this.weight = weight
    }

    compute(body: Agent): Vec2 {
        let force = vec2()
        let count = 0

        for (const pos of this.neighbors()) {
            const toAgent = sub(body.position, pos)
            const d = length(toAgent)

            if (d > 0 && d < this.desiredSeparation) {
                force = add(force,
                    mulScalar(normalize(toAgent), 1 / d)
                )
                count++
            }
        }

        if (count > 0) {
            force = mulScalar(force, 1 / count)
        }

        if (length(force) > 0) {
            force = mulScalar(normalize(force), body.maxSpeed)
            force = sub(force, body.velocity)
        }

        return force
    }
}


export class BoundaryAvoidance implements SteeringBehavior {

    bounds: Rect
    margin: number
    strength: number
    weight: number

  constructor(
    weight: number,
    bounds: Rect,
    margin: number,
    strength: number,
  ) {
    this.bounds = bounds
    this.margin = margin
    this.strength = strength
    this.weight = weight
  }

  compute(agent: Agent): Vec2 {
    let force = vec2()

    if (agent.position.x < rect_left(this.bounds) + this.margin)
      force.x += this.strength
    if (agent.position.x > rect_right(this.bounds) - this.margin)
      force.x -= this.strength

    if (agent.position.y < rect_top(this.bounds) + this.margin)
      force.y += this.strength
    if (agent.position.y > rect_bottom(this.bounds) - this.margin)
      force.y -= this.strength

    return mulScalar(force, this.weight)
  }
}

export function computeSteering(
  agent: Agent,
  behaviors: SteeringBehavior[],
  dt: number
): Vec2 {
  let force = vec2()

  for (const b of behaviors) {
    force = add(force, b.compute(agent, dt))
  }

  return clampLength(force, agent.maxForce)
}

export function integrate(agent: Agent, force: Vec2, dt: number) {
  agent.velocity = add(agent.velocity, mulScalar(force, dt))
  agent.velocity = clampLength(agent.velocity, agent.maxSpeed)
  agent.position = add(agent.position, mulScalar(agent.velocity, dt))
}

/*
function updateRotation(body: Agent, dt: number) {
    const speed = length(body.velocity)
    body.angularVelocity = speed / body.radius

    body.rotation += body.angularVelocity * dt
    body.angularVelocity *= 0.98
}
    */

function updateHeading(body: Agent, dt: number) {
    const speedSq = dot(body.velocity, body.velocity)
    const EPS = 1e-6

    if (speedSq < EPS) return // no movement → no heading change

    const desired = Math.atan2(body.velocity.y, body.velocity.x)
    const delta = wrapAngle(desired - body.rotation)

    const turnRate = body.turnRate
    const maxTurn = turnRate * dt

    body.rotation += clamp(delta, -maxTurn, maxTurn)
}



export function update_agent(body: Agent, behaviors: SteeringBehavior[], bounds: Boundary[], delta: number) {

    let force = vec2()

    force = add(force, body.accumulatedForce)
    body.accumulatedForce = vec2()

    force = add(force, computeSteering(body, behaviors, delta))

    let bounds_force = vec2()
    let k = 500
    let damping = 10
    // 2. Collision constraints (spring-based)
    for (const boundary of bounds) {
        bounds_force = add(bounds_force, 
            resolveBoundaryWithSpringForce(boundary, body, k, damping))
    }

    force = add(force, bounds_force)

    if (len2(bounds_force) > .01) {
        body.bounds_force = bounds_force
    } else {
        delete body.bounds_force
    }

    body.velocity = add(body.velocity, 
        mulScalar(force, delta / body.mass)
    )

    // Velocity damping (friction)
    //const linearDamping = 6;
    //body.velocity = mulScalar(body.velocity, Math.exp(-linearDamping * delta));

    if (length(body.velocity) < .1) {
        body.velocity = vec2();
    }


    body.velocity = clampLength(body.velocity, body.maxSpeed)

    body.position = add(body.position, mulScalar(body.velocity, delta))

    updateHeading(body, delta)
}

function resolveBoundaryWithSpringForce(boundary: Boundary, body: Agent, k: number, damping: number) {
    const penetration = boundary.penetration(body.position)
    let penetrationDepth = -(penetration.signedDistance - body.radius)

    if (penetrationDepth > 0) {
        let normal = penetration.normal
        const spring = mulScalar(normal, penetrationDepth * k)
        const vn = dot(body.velocity, normal)

        const dampingForce = vn < 0 ? mulScalar(normal, - vn * damping) : vec2()

        return add(spring, dampingForce)
    }
    return vec2()
}

export type Penetration = {
    // Signed distance to the boundary surface
    // > 0  => penetration
    // = 0  => exactly on surface
    // < 0  => outside / free
    signedDistance: number

    // Surface normal at closest point
    normal: Vec2
}

export interface Boundary {
    penetration(p: Vec2): Penetration
}

export class ConvexPolygonBoundary implements Boundary {

    poly: Poly

    constructor(poly: Poly) { 
        this.poly = poly
    }

    penetration(p: Vec2): Penetration {
        return collisionSurface(this.poly, p)
    }
}

export class WanderJitter implements SteeringBehavior {
    weight: number
    interval: number
    timer = 0
    wanderAngle = 0

    constructor(weight: number, interval = 0.25) {
        this.interval = interval
        this.weight = weight
        this.wanderAngle = Math.random() * Math.PI * 2
    }

    compute(agent: Agent, dt: number): Vec2 {
        this.timer -= dt

        if (this.timer <= 0) {
            const range = Math.PI
            this.wanderAngle += (Math.random() * 2 - 1) * range
            this.timer = this.interval
        }

        const dir = fromAngle(this.wanderAngle)
        return mulScalar(dir, agent.maxForce * this.weight)
    }
}



export class Wander implements SteeringBehavior {
    weight: number

    // Wander parameters
    circleDistance: number      // distance ahead of agent
    circleRadius: number        // radius of the wander circle
    jitter: number              // angular change per second (radians)

    private wanderAngle!: number

    constructor(
        weight: number,
        circleDistance = 40,
        circleRadius = 20,
        jitter = Math.PI / 2     // ~90° per second max
    ) {
        this.weight = weight
        this.circleDistance = circleDistance
        this.circleRadius = circleRadius
        this.jitter = jitter

        this.reset()
    }

    compute(agent: Agent, dt: number): Vec2 {
        // If agent is not moving, assume a forward direction
        const velocityDir = length(agent.velocity) > 0.0001
            ? normalize(agent.velocity)
            : vec2(1, 0)

        // Move the wander angle slightly (smooth randomness)
        const delta = (Math.random() * 2 - 1) * this.jitter * dt
        this.wanderAngle += delta

        // Center of wander circle
        const circleCenter = add(
            agent.position,
            mulScalar(velocityDir, this.circleDistance)
        )

        // Point on the circle
        const displacement = vec2(
            Math.cos(this.wanderAngle),
            Math.sin(this.wanderAngle)
        )

        const wanderTarget = add(
            circleCenter,
            mulScalar(displacement, this.circleRadius)
        )

        // Steering force toward the target
        const desired = sub(wanderTarget, agent.position)

        return mulScalar(normalizeSafe(desired), agent.maxForce * this.weight)
    }

    reset(directionHint?: Vec2) {
        if (directionHint && length(directionHint) > 0.0001) {
            this.wanderAngle = Math.atan2(directionHint.y, directionHint.x)
        } else {
            this.wanderAngle = Math.random() * Math.PI * 2
        }
    }
}

export class FlightAvoidance implements SteeringBehavior {
  weight: number
  obstacles: () => Obstacle[]
  radius: number
  falloff: number
  forwardBias: number

  constructor(
    weight: number,
    obstacles: () => Obstacle[],
    radius = 120,
    falloff = 2,
    forwardBias = 0.5
  ) {
    this.weight = weight
    this.obstacles = obstacles
    this.radius = radius
    this.falloff = falloff
    this.forwardBias = forwardBias
  }

  compute(agent: Agent): Vec2 {
    const speed = length(agent.velocity)
    if (speed === 0) return vec2()

    const fwd = normalize(agent.velocity)
    let force = vec2()

    for (const obs of this.obstacles()) {
      const offset = sub(agent.position, obs.position)
      const dist = length(offset)
      const R = this.radius + obs.radius

      if (dist >= R || dist === 0) continue

      let away = normalize(offset)

      // ---- Angular bias: remove backward component ----
      const backDot = dot(away, mulScalar(fwd, -1))
      if (backDot > 0) {
        away = sub(away, mulScalar(fwd, backDot))
      }

      // Fallback if numerically unstable
      if (len2(away) === 0) continue

      away = normalize(away)

      // Falloff strength
      const strength = Math.pow(1 - dist / R, this.falloff)

      // Forward bias keeps momentum
      const biased = add(
        mulScalar(away, 1 - this.forwardBias),
        mulScalar(fwd, this.forwardBias)
      )

      force = add(force, mulScalar(biased, strength))
    }

    if (len2(force) === 0) return vec2()

    force = normalize(force)
    force = mulScalar(force, agent.maxForce)

    return mulScalar(force, this.weight)
  }
}



export type Obstacle = {
  position: Vec2,
  radius: number
}

export class ObstacleAvoidance implements SteeringBehavior {
  weight: number
  obstacles: () => Obstacle[]
  lookAhead: number

  constructor(
    weight: number,
    obstacles: () => Obstacle[],
    lookAhead = 100,
  ) {
    this.weight = weight
    this.obstacles = obstacles
    this.lookAhead = lookAhead
  }

  compute(agent: Agent): Vec2 {
    const speed = length(agent.velocity)
    if (speed === 0) return vec2()

    const forward = normalize(agent.velocity)

    // Prevent lookAhead collapse at low speeds
    const dynamicLookAhead = Math.max(
      this.lookAhead * (speed / agent.maxSpeed),
      agent.radius * 2
    )

    let closestT = Infinity
    let threat: Obstacle | null = null
    let hitPoint = vec2()

    let penetration = 0

    for (const obs of this.obstacles()) {
      const R = agent.radius + obs.radius

      // Vector from agent to obstacle
      const toObs = sub(obs.position, agent.position)

      // Project onto forward vector
      const t = dot(toObs, forward)

      // Outside swept segment
      if (t < 0 || t > dynamicLookAhead) continue

      // Closest point on sweep segment
      const closest = add(agent.position, mulScalar(forward, t))

      // Distance from obstacle center to sweep axis
      const distSq = len2(sub(obs.position, closest))

      if (distSq > R * R) continue

      // Keep nearest intersection
      if (t < closestT) {
        closestT = t
        threat = obs
        hitPoint = closest
        penetration = 1 - Math.sqrt(distSq) / R
      }
    }

    if (!threat) return vec2()

    // Lateral avoidance force (push out of capsule)
    const avoidanceDir = normalize(
      sub(hitPoint, threat.position)
    )

    const force = mulScalar(avoidanceDir, agent.maxForce * penetration)

    return mulScalar(force, this.weight)
  }
}




export type Path = Poly

export class PathFollow implements SteeringBehavior {

  weight: number
  speedFactor: number

  path: Path
  lookAhead: number
  arriveRadius: number

  private segmentIndex = 0

  constructor(
    weight: number,
    speedFactor: number,
    path: Path,
    lookAhead = 40,
    arriveRadius = 8,
  ) {
    this.weight = weight
    this.speedFactor = speedFactor
    this.path = path
    this.lookAhead = lookAhead
    this.arriveRadius = arriveRadius
  }

  compute(agent: Agent): Vec2 {
    if (this.path.points.length < 2) {
      return vec2()
    }

    this.segmentIndex = findClosestSegmentIndex(agent.position, this.path)

    // 1. Find closest point on current segment
    const a = this.path.points[this.segmentIndex % this.path.points.length]
    const b = this.path.points[(this.segmentIndex + 1) % this.path.points.length]

    let closest = closestPointOnSegment(agent.position, a, b)

    /*
    // 2. If near end of segment, advance segment index
    if (distance(closest.point, b) < this.arriveRadius) {
      this.segmentIndex++
    }
      */

    // 3. Compute carrot point ahead on path
    const { point: target } = advanceAlongPath(
      this.path,
      this.segmentIndex,
      closest.point,
      this.lookAhead
    )

    // 4. Seek the carrot
    const desired = sub(target, agent.position)
    const dist = length(desired)

    if (dist < 0.0001) {
      return vec2()
    }

    const desiredVelocity = mulScalar(
      normalize(desired),
      agent.maxSpeed * this.speedFactor
    )

    const steering = sub(desiredVelocity, agent.velocity)

    return mulScalar(steering, this.weight)
  }
}


export class CorridorFollow implements SteeringBehavior {
  path: Path
  weight: number
  corridorRadius: number
  stiffness: number

  private segmentIndex = 0

  constructor(
    weight: number,
    path: Path,
    corridorRadius = 24,
    stiffness = 1,
  ) {
    this.path = path
    this.corridorRadius = corridorRadius
    this.stiffness = stiffness
    this.weight = weight
  }

  compute(agent: Agent): Vec2 {
    if (this.path.points.length < 2) {
      return vec2()
    }

    const a = this.path.points[this.segmentIndex % this.path.points.length]
    const b = this.path.points[(this.segmentIndex + 1) % this.path.points.length]

    const { offset, normal } =
      lateralOffset(agent.position, a, b)

    // Advance segment if agent passed it
    const segmentDir = normalize(sub(b, a))
    if (dot(sub(agent.position, b), segmentDir) > 0) {
      this.segmentIndex++
    }

    const absOffset = Math.abs(offset)

    // Inside corridor → no correction
    if (absOffset < this.corridorRadius) {
      return vec2()
    }

    // Outside corridor → push back toward centerline
    const penetration = absOffset - this.corridorRadius
    const direction = offset > 0 ? -1 : 1

    const correction = mulScalar(
      normal,
      penetration * direction * this.stiffness
    )

    return mulScalar(correction, this.weight)
  }
}
