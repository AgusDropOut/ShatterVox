import RAPIER from "@dimforge/rapier3d-compat";
import { mat4 } from "gl-matrix";

const vsSource = `
    attribute vec3 a_position;
    attribute vec4 a_color;
    uniform mat4 u_MVP;
    varying vec4 v_color;
    
    void main() {
        gl_Position = u_MVP * vec4(a_position, 1.0);
        v_color = a_color;
    }
`;

const fsSource = `
    precision mediump float;
    varying vec4 v_color;
    
    void main() {
        gl_FragColor = v_color;
    }
`;

export class PhysicsDebugRenderer {
    private gl: WebGL2RenderingContext;
    private program: WebGLProgram;
    
    private vao: WebGLVertexArrayObject;
    private posBuffer: WebGLBuffer;
    private colBuffer: WebGLBuffer;
    
    private aPositionLoc: number;
    private aColorLoc: number;
    private uMvpLoc: WebGLUniformLocation;

    constructor(gl: WebGL2RenderingContext) {
        this.gl = gl;
        this.program = this.createProgram(vsSource, fsSource);

        this.aPositionLoc = this.gl.getAttribLocation(this.program, "a_position");
        this.aColorLoc = this.gl.getAttribLocation(this.program, "a_color");
        this.uMvpLoc = this.gl.getUniformLocation(this.program, "u_MVP")!;

        this.vao = this.gl.createVertexArray()!;
        this.gl.bindVertexArray(this.vao);

        this.posBuffer = this.gl.createBuffer()!;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.posBuffer);
        this.gl.enableVertexAttribArray(this.aPositionLoc);
        this.gl.vertexAttribPointer(this.aPositionLoc, 3, this.gl.FLOAT, false, 0, 0);

        this.colBuffer = this.gl.createBuffer()!;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colBuffer);
        this.gl.enableVertexAttribArray(this.aColorLoc);
        this.gl.vertexAttribPointer(this.aColorLoc, 4, this.gl.FLOAT, false, 0, 0);

        this.gl.bindVertexArray(null);
    }

    public render(vertices: Float32Array | null, colors: Float32Array | null, mvpMatrix: mat4): void {
        if (!vertices || !colors || vertices.length === 0) return;

        this.gl.useProgram(this.program);
        this.gl.bindVertexArray(this.vao);

        this.gl.uniformMatrix4fv(this.uMvpLoc, false, mvpMatrix as Float32Array);


        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.posBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.DYNAMIC_DRAW);
        
    
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, colors, this.gl.DYNAMIC_DRAW);


        this.gl.drawArrays(this.gl.LINES, 0, vertices.length / 3);

        this.gl.bindVertexArray(null);
    }


    private createProgram(vs: string, fs: string): WebGLProgram {
        const vShader = this.compileShader(this.gl.VERTEX_SHADER, vs);
        const fShader = this.compileShader(this.gl.FRAGMENT_SHADER, fs);
        const prog = this.gl.createProgram()!;
        this.gl.attachShader(prog, vShader);
        this.gl.attachShader(prog, fShader);
        this.gl.linkProgram(prog);
        if (!this.gl.getProgramParameter(prog, this.gl.LINK_STATUS)) {
            throw new Error(this.gl.getProgramInfoLog(prog) || "Error linking shader");
        }
        return prog;
    }

    private compileShader(type: number, source: string): WebGLShader {
        const shader = this.gl.createShader(type)!;
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            throw new Error(this.gl.getShaderInfoLog(shader) || "Error compiling shader");
        }
        return shader;
    }
}