#version 300 es
precision highp float;

layout(location = 0) in vec2 a_pos;            // quad vertex (0-1 space)
layout(location = 1) in vec2 a_translation;    // world position
layout(location = 2) in vec2 a_size;           // width, height
layout(location = 3) in float a_rotation;      // radians
layout(location = 4) in vec4 a_color;          // RGBA
layout(location = 5) in float a_type;          // shape type
layout(location = 6) in float a_radius;        // roundRect radius or line thickness*0.5
layout(location = 7) in float a_stroke;        // stroke width (0 = fill)
layout(location = 8) in vec2 a_dash;           // (dashLength, gapLength)
layout(location = 9) in float a_length;        // shape length for lines (distance between A→B)

out vec2 v_local;
out vec2 v_size;
out vec4 v_color;
out float v_type;
out float v_radius;
out float v_stroke;
out vec2 v_dash;
out float v_length;

uniform mat4 u_projection; // 1920x1080 Orto Matrix

void main() {
    // Convert quad coordinates (0..1) to local space (-0.5..0.5)
    vec2 local = (a_pos - 0.5) * a_size;
    v_local = local;
    v_size = a_size;

    // Pass instance data to fragment shader
    v_color = a_color;
    v_type = a_type;
    v_radius = a_radius;
    v_stroke = a_stroke;
    v_dash = a_dash;
    v_length = a_length;

    // Rotation
    float s = sin(a_rotation);
    float c = cos(a_rotation);
    vec2 rotated = vec2(
        local.x * c - local.y * s,
        local.x * s + local.y * c
    );

    // Final world position
    vec2 world = rotated + a_translation;

    // convert pixel pos to NDC
    //vec2 ndc = (world / u_resolution) * 2.0 - 1.0;
    vec4 ndc = u_projection * vec4(world, 0.0, 1.0);
    //gl_Position = vec4(ndc * vec2(1, -1), 0.0, 1.0);
    gl_Position = ndc;
}
