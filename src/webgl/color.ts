type RGBA = { r: number, g: number, b: number, a: number }

export class Color {
  // Store internal components as normalized values (0.0 to 1.0)
  r: number
  g: number
  b: number
  a: number

  /**
   * Private constructor: Use static factory methods to create colors.
   * Assumes r, g, b, a are already normalized (0.0 - 1.0).
   */
  private constructor(r: number, g: number, b: number, a: number) {
    this.r = r
    this.g = g
    this.b = b
    this.a = a
  }

  // --- Static Factory Methods ---

  /**
   * Creates a Color from standard 0-255 range components.
   */
  static fromRgba255(r: number, g: number, b: number, a: number = 255): Color {
    // Convert 0-255 inputs to 0-1 normalized components
    return new Color(r / 255, g / 255, b / 255, a / 255)
  }

  /**
   * Creates a Color from an integer hex value (e.g., 0xaa00ff).
   */
  static fromHex(rgb: number): Color {
    // Your original logic, now calling the correct factory method
    return Color.fromRgba255(
      (rgb & 0xff0000) >> 16, // R
      (rgb & 0x00ff00) >> 8,  // G
      (rgb & 0x0000ff),       // B
      255                      // A
    )
  }

  /**
   * Creates a Color from a hex string (e.g., '#aaaaaa' or '0xaaaaaa').
   * Supports 3-digit, 6-digit, 8-digit hex.
   */
  static fromHexString(hex: string): Color | null {
    // 1. Clean the input string: remove '#' and convert to upper case
    let colorString = hex.startsWith('#') ? hex.slice(1) : hex
    colorString = colorString.startsWith('0x') ? colorString.slice(2) : colorString
    
    // 2. Expand 3-digit hex (e.g., 'abc' -> 'aabbcc')
    if (colorString.length === 3) {
      colorString = colorString.split('').map(char => char + char).join('')
    }

    // 3. Parse the hex string to an integer
    const num = parseInt(colorString, 16)

    if (isNaN(num)) {
      console.error(`Invalid color hex string: ${hex}`)
      return null // Return null or a default color on failure
    }

    // 4. Handle 6-digit (RRGGBB) and 8-digit (RRGGBBAA) formats
    if (colorString.length === 6) {
      // 6-digit: RRGGBB (assumes full alpha 255)
      return Color.fromRgba255(
        (num >> 16) & 0xFF, // R
        (num >> 8) & 0xFF,  // G
        num & 0xFF,         // B
        255                 // A
      )
    } else if (colorString.length === 8) {
      // 8-digit: RRGGBBAA
      return Color.fromRgba255(
        (num >> 24) & 0xFF, // R
        (num >> 16) & 0xFF, // G
        (num >> 8) & 0xFF,  // B
        num & 0xFF          // A
      )
    }

    console.error(`Unsupported hex string length: ${hex}`)
    return null
  }

  // --- Static Presets ---

  static white = Color.fromRgba255(255, 255, 255, 255)
  static black = Color.fromRgba255(0, 0, 0, 255)
  static red = Color.fromRgba255(255, 0, 0, 255)

  // --- Static Utility Methods ---

  /**
   * Linearly interpolates between two colors.
   */
  static lerp(a: Color, b: Color, t: number): Color {
    // Clamping t is handled by Math.min/max, which is cleaner than if statements
    t = Math.max(0, Math.min(1, t))

    // Uses normalized values (0-1) for interpolation
    return new Color(a.r + (b.r - a.r) * t,
                     a.g + (b.g - a.g) * t,
                     a.b + (b.b - a.b) * t,
                     a.a + (b.a - a.a) * t)
  }

  // --- Instance Getters ---

  /**
   * Returns the color as a 24-bit integer (0xRRGGBB).
   */
  get rgb24(): number {
    // Convert normalized (0-1) components back to 0-255 range for bit shifting
    const r255 = Math.round(this.r * 255)
    const g255 = Math.round(this.g * 255)
    const b255 = Math.round(this.b * 255)
    return (r255 << 16) | (g255 << 8) | b255
  }

  /**
   * Returns the color as an array of normalized components [r, g, b, a] (0.0 to 1.0).
   */
  get rgbaNormalized(): RGBA {
    return {
      r: this.r,
      g: this.g,
      b: this.b,
      a: this.a
    }
  }

  /**
   * Returns the color as an array of 0-255 components [r, g, b, a].
   */
  get rgba255(): RGBA {
    return {
      r: Math.round(this.r * 255),
      g: Math.round(this.g * 255),
      b: Math.round(this.b * 255),
      a: Math.round(this.a * 255),
    }
  }
}