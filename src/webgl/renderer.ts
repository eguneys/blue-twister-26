import VERT_SRC from './shape.vert'
import FRAG_SRC from './shape.frag'


export class Renderer {
    gl: WebGL2RenderingContext;
    program: WebGLProgram;
    vao: WebGLVertexArrayObject;
    quadVBO: WebGLBuffer;
    instanceVBO: WebGLBuffer;

    maxInstances: number;
    instanceStride: number;
    instanceData: Float32Array;
    instanceCount: number = 0;

    uResolution: WebGLUniformLocation | null;

    constructor(canvas: HTMLCanvasElement, maxInstances = 10_000) {
        const gl = canvas.getContext("webgl2", { antialias: true });
        if (!gl) throw new Error("WebGL2 not supported");
        this.gl = gl;

        this.maxInstances = maxInstances;

        // 1 quad = 4 vertices
        this.quadVBO = gl.createBuffer()!;
        this.instanceVBO = gl.createBuffer()!;

        this.program = this.createProgram(
            VERT_SRC,
            FRAG_SRC
        );

        this.uResolution = gl.getUniformLocation(this.program, "u_resolution");


        // 36 floats per instance example (we will align later)
        this.instanceStride = 15; // You will expand this later
        this.instanceData = new Float32Array(this.maxInstances * this.instanceStride);

        this.vao = this.createVAO();

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    }

        private createVAO(): WebGLVertexArrayObject {
        const gl = this.gl;
        const vao = gl.createVertexArray()!;
        gl.bindVertexArray(vao);

        // --- Quad geometry (0..1) ---
        const quadVerts = new Float32Array([
            0, 0,
            1, 0,
            0, 1,
            1, 1
        ]);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
        gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

        // a_pos (vec2)
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
        gl.vertexAttribDivisor(0, 0); // per-vertex, not instanced

        // --- Instance buffer ---
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            this.instanceData.byteLength,
            gl.DYNAMIC_DRAW
        );

        // Leave attribute pointers uninitialized for now.
        // We will define them in the "setupInstancing()" method.

        return vao;
    }

        setupInstancing() {
        const gl = this.gl;
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);

        const stride = this.instanceStride * 4;

        let offset = 0;
        let attribLoc = 1;

        const attrib = (size: number) => {
            gl.enableVertexAttribArray(attribLoc);
            gl.vertexAttribPointer(attribLoc, size, gl.FLOAT, false, stride, offset);
            gl.vertexAttribDivisor(attribLoc, 1);
            offset += size * 4;
            attribLoc++;
        };

        // These correspond exactly to shader attributes:
        attrib(2); // a_translation
        attrib(2); // a_size
        attrib(1); // a_rotation
        attrib(4); // a_color
        attrib(1); // a_type
        attrib(1); // a_radius
        attrib(1); // a_stroke
        attrib(2); // a_dash
        attrib(1); // a_length
    }

    addInstance(data: Float32Array) {
        const base = this.instanceCount * this.instanceStride;

        this.instanceData.set(data, base);
        this.instanceCount++;

        if (this.instanceCount >= this.maxInstances) {
            console.warn("Instance buffer full");
        }
    }

        flush() {
        const gl = this.gl;
        if (this.instanceCount === 0) return;

        gl.useProgram(this.program);
        gl.bindVertexArray(this.vao);

        gl.uniform2f(this.uResolution, gl.canvas.width, gl.canvas.height);

        // Upload only the needed part of the buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
        gl.bufferSubData(
            gl.ARRAY_BUFFER,
            0,
            this.instanceData.subarray(0, this.instanceCount * this.instanceStride)
        );

        gl.drawArraysInstanced(
            gl.TRIANGLE_STRIP,
            0,
            4,
            this.instanceCount
        );

        this.instanceCount = 0;
    }

        private createProgram(vertSrc: string, fragSrc: string): WebGLProgram {
        const gl = this.gl;

        const vs = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vs, vertSrc);
        gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(vs)!);
        }

        const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fs, fragSrc);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(fs)!);
        }

        const prog = gl.createProgram()!;
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);

        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(prog)!);
        }

        gl.deleteShader(vs);
        gl.deleteShader(fs);

        return prog;
    }


    cleanup() {
        const gl = this.gl;

        // 1. Unbind VAO
        gl.bindVertexArray(null);

        // 2. Delete VAO
        if (this.vao) {
            gl.deleteVertexArray(this.vao);
        }

        // 3. Unbind VBOs
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

        // 4. Delete VBOs
        if (this.quadVBO) {
            gl.deleteBuffer(this.quadVBO);
        }

        if (this.instanceVBO) {
            gl.deleteBuffer(this.instanceVBO);
        }

        // 5. Delete shader program
        if (this.program) {
            gl.useProgram(null);
            gl.deleteProgram(this.program);
        }

        // 6. Delete any textures if you add them later
        /*
        if (this.texture) {
            gl.deleteTexture(this.texture);
            this.texture = null;
        }
        */

        // 7. Optional: Clear GL state
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // Renderer object is now safe to be GC’d
    }


}