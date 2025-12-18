type AnimMode = "hold" | "tween" | "spring" | "follow";

export interface TweenConfig {
    duration: number;
    easing?: (t: number) => number;
}

export interface SpringConfig {
    stiffness: number;
    damping: number;
}

export interface FollowConfig {
    speed: number; // 0–1 lerp factor per second
}

export interface SwayConfig {
    amplitude: number;
    frequency: number;
    bias: number;
}

const DefaultTween: TweenConfig = { duration: 0.2, easing: t => t };
const DefaultSpring: SpringConfig = { stiffness: 150, damping: 18 };
const DefaultFollow: FollowConfig = { speed: 1 - 0e+8 };
const DefaultSway: SwayConfig = { amplitude: 0, frequency: 3, bias: 0 };

export class AnimChannel {
    value: number;
    velocity = 0;

    // somewhere in AnimChannel
    private baseValue: number = 0;

    private mode: AnimMode = "hold";
    private time = 0;
    private timeInMode = 0;

    private tweenStart = 0;
    private tweenTarget = 0;
    private tweenConfig = DefaultTween;

    private springTarget = 0;
    private springConfig = DefaultSpring;

    private followTarget = 0;
    private followConfig = DefaultFollow;

    swayEnabled = false;
    private swayConfig = { ...DefaultSway };
    //private swayPhaseOffset = Math.random() * Math.PI * 2;
    //private swayPhaseOffset = 0
    private lastSwayValue = 0
    private swayFade = 0

    constructor(startValue = 0) {
        this.baseValue = startValue;
        this.value = this.baseValue
    }

    // -------------------
    // Public API
    // -------------------

    hold() {
        this.mode = "hold";
        this.timeInMode = 0;
        this.velocity = 0;
        return this;
    }

    tweenTo(target: number, config?: Partial<TweenConfig>) {
        this.mode = "tween";
        this.tweenConfig = { ...DefaultTween, ...config };
        this.tweenStart = this.value;
        this.tweenTarget = target;
        this.timeInMode = 0;
        return this;
    }

    springTo(target: number, config?: Partial<SpringConfig>) {
        this.mode = "spring";
        this.springConfig = { ...DefaultSpring, ...config };
        this.springTarget = target;
        this.timeInMode = 0;
        return this;
    }

    followTo(target: number, config?: Partial<FollowConfig>) {
        this.mode = 'follow'
        this.followConfig = { ...DefaultFollow, ...config };
        this.followTarget = target;
        return this;
    }

    swayTo(config?: Partial<SwayConfig>) {
        this.swayConfig = { ...this.swayConfig, ...config };
        this.swayEnabled = true;
        return this;
    }

    disableSway() {
        this.swayEnabled = false;
        return this;
    }

    // -------------------
    // Update
    // -------------------

    update(dt: number) {
        this.time += dt;
        this.timeInMode += dt;


        switch (this.mode) {
            case "hold":
                // do nothing
                break;

            case "tween": {
                const t = Math.min(this.timeInMode / this.tweenConfig.duration, 1);
                const eased = this.tweenConfig.easing!(t);
                this.baseValue = this.tweenStart + (this.tweenTarget - this.tweenStart) * eased;
                break;
            }

            case "spring": {
                const { stiffness, damping } = this.springConfig;
                const a = -stiffness * (this.baseValue - this.springTarget) - damping * this.velocity;
                this.velocity += a * dt;
                this.baseValue += this.velocity * dt;
                break;
            }

            case "follow": {
                let { speed } = this.followConfig
                const t = 1 - Math.pow(1 - speed, dt);
                this.baseValue += (this.followTarget - this.baseValue) * t;
                break;
            }
        }


        // -------------------
        // 3. Apply sway directly into baseValue
        // -------------------
        if (this.swayEnabled && this.swayConfig) {
            // smooth fade-in
            this.swayFade = Math.min(this.swayFade + dt * 8, 1);

            const targetSway = Math.sin(this.time * this.swayConfig.frequency! + 0) * this.swayConfig.amplitude!
                + this.swayConfig.bias!;

            const swayDelta = (targetSway - this.lastSwayValue) * this.swayFade;
            this.baseValue += swayDelta;
            this.lastSwayValue += swayDelta;

        } else {
            // sway disabled: freeze last value, no subtraction
            this.swayFade = 0;
        }

        // -------------------
        // 4. Update public value
        // -------------------
        this.value = this.baseValue;

    }
}

// Helper
export function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}
