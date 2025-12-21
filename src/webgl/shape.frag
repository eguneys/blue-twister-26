#version 300 es
precision highp float;

in vec2 v_local;
in vec2 v_size;
in vec4 v_color;
in float v_type;
in float v_radius;
in float v_stroke;
in vec2 v_dash;
in float v_length;

out vec4 fragColor;

// ************** SDF UTILITIES ************** //

float sdRect(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return max(d.x, d.y);
}

float sdRoundRect(vec2 p, vec2 b, float r) {
    vec2 d = abs(p) - b + vec2(r);
    return length(max(d, 0.0)) - r;
}

float sdCapsule(vec2 p, float len, float r) {
    // Capsule along +X axis centered at origin
    vec2 a = vec2(-len * 0.5, 0.0);
    vec2 b = vec2( len * 0.5, 0.0);
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

float applyDash(float distAlongLine, float dash, float gap) {
    float total = dash + gap;
    float m = mod(distAlongLine, total);
    return (m < dash) ? 1.0 : 0.0;
}


void main() {

    // Normalize local coords to center
    vec2 p = v_local;

    float d = 0.0;

    //--------------------------------------------------
    // RECTANGLE
    //--------------------------------------------------
    if (v_type == 0.0) {
        d = sdRect(p, v_size * 0.5);
    }

    //--------------------------------------------------
    // ROUND RECTANGLE
    //--------------------------------------------------
    if (v_type == 1.0) {
        d = sdRoundRect(p, v_size * 0.5 - vec2(v_radius), v_radius);
    }

    //--------------------------------------------------
    // CAPSULE LINE (round caps)
    //--------------------------------------------------
    if (v_type == 2.0) {
        // line thickness = v_radius*2
        d = sdCapsule(p, v_length, v_radius);
    }

    if (v_type == 3.0) {
        d = sdCircle(p, v_radius);
    }

    //--------------------------------------------------
    // STROKE / FILL HANDLING
    //--------------------------------------------------
    float alpha = 0.0;

    if (v_stroke == 0.0) {
        // FILL SHAPE
        float edge = fwidth(d) * 1.2;
        alpha = 1.0 - smoothstep(0.0, edge, d);
    } else {
        // STROKE SHAPE
        float halfStroke = v_stroke * 0.5;
        float distToStroke = abs(d) - halfStroke;
    
        float edge = fwidth(distToStroke) * 1.2;
        alpha = 1.0 - smoothstep(0.0, edge, distToStroke);
    
        //--------------------------------------------------
        // DASHING (ANTI-ALIASED, STABLE)
        //--------------------------------------------------
        if (v_dash.x > 0.0 && alpha > 0.0) {
    
            // ---------------------------------------------
            // Arc-length approximation
            // ---------------------------------------------
            float s;
    
            if (v_type == 2.0) {
                // line / rect-like shapes: project along x
                s = p.x + v_length * 0.5;
            } else {
                // fallback: radial distance (better than Manhattan)
                s = length(p);
            }
    
            // ---------------------------------------------
            // Dash pattern
            // ---------------------------------------------
            float period = v_dash.x + v_dash.y;
            float phase  = mod(s, period);
    
            // derivative-aware AA for dash edges
            float dashEdge = fwidth(s);
    
            float dashMask =
                1.0 - smoothstep(
                    v_dash.x - dashEdge,
                    v_dash.x + dashEdge,
                    phase
                );
    
            alpha *= dashMask;
        }
    }

    float a= v_color.a * alpha;
    fragColor = vec4(v_color.rgb * a, a);
}
