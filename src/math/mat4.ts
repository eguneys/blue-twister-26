/**
 * A 4x4 Matrix represented as a flat array of 16 floats. 
 * This is the standard format for WebGL uniformMatrix4fv.
 */
type Matrix4x4 = Float32Array & { length: 16 };

/**
 * Creates an Orthographic Projection Matrix.
 * Maps a logical coordinate system (like 1920x1080) to WebGL Clip Space (-1 to 1).
 */
function createOrthoMatrix(
    left: number, 
    right: number, 
    bottom: number, 
    top: number
): Matrix4x4 {
    const mat = new Float32Array(16) as Matrix4x4;

    // Standard Orthographic Projection Math
    // Column-major order (standard for WebGL/OpenGL)
    
    mat[0]  = 2 / (right - left);
    mat[1]  = 0;
    mat[2]  = 0;
    mat[3]  = 0;

    mat[4]  = 0;
    mat[5]  = 2 / (top - bottom); // Flipped Y: 0 is top, 1080 is bottom
    mat[6]  = 0;
    mat[7]  = 0;

    mat[8]  = 0;
    mat[9]  = 0;
    mat[10] = -1; // Z-near/far mapping (2D focus)
    mat[11] = 0;

    mat[12] = -(right + left) / (right - left);
    mat[13] = -(top + bottom) / (top - bottom);
    mat[14] = 0;
    mat[15] = 1;

    return mat;
}


// Usage for your 1920x1080 logical space:
export const projectionMatrix: Matrix4x4 = createOrthoMatrix(0, 1920, 1080, 0);