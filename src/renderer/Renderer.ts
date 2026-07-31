import { VAO } from "./buffers/VAO";
import { Shader } from "./Shader";
import { Texture } from "./Texture";

export class Renderer {
    public readonly gl: WebGL2RenderingContext;
    public readonly textureAtlas: Texture;

    constructor(canvas: HTMLCanvasElement) {
        const gl = canvas.getContext("webgl2", { antialias: false });
        if (!gl) throw new Error("WebGL2 is not supported by your browser.");
        
        this.gl = gl;

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.BACK);
        this.gl.frontFace(this.gl.CCW);

        this.textureAtlas = new Texture(this.gl, "/assets/atlas.png");
    }

    public setViewport(width: number, height: number): void {
        this.gl.viewport(0, 0, width, height);
    }

    public setClearColor(r: number, g: number, b: number, a: number = 1.0): void {
        this.gl.clearColor(r, g, b, a);
    }

    public clear(): void {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }

    public draw(vao: VAO, shader: Shader, vertexCount: number): void {
        this.textureAtlas.bind(0);
        shader.bind();
        vao.bind();
        this.gl.drawArrays(this.gl.TRIANGLES, 0, vertexCount);
        vao.unbind();
        this.textureAtlas.unbind();
    }

    public drawInstanced(vao: VAO, shader: Shader, vertexCount: number, instanceCount: number): void {
        this.textureAtlas.bind(0);
        shader.bind();
        vao.bind();
        this.gl.drawArraysInstanced(this.gl.TRIANGLES, 0, vertexCount, instanceCount);
        vao.unbind();
        this.textureAtlas.unbind();
    }
}