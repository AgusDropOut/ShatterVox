import { Renderer } from "../renderer/Renderer";
import { Shader } from "../renderer/Shader";
import { vertexShaderSource, fragmentShaderSource } from "../renderer/shaders/ChunkShader";
import { World } from "../world/World";
import { mat4 } from "gl-matrix";

export class Engine {
    private readonly canvas: HTMLCanvasElement;
    private readonly renderer: Renderer;
    
    private isRunning: boolean = false;
    private lastTime: number = 0;

    private shader: Shader;
    private world: World;

    constructor(canvasId: string) {
        const canvasElement = document.getElementById(canvasId) as HTMLCanvasElement | null;
        if (!canvasElement) throw new Error(`Canvas with ID '${canvasId}' not found.`);
        
        this.canvas = canvasElement;
        this.renderer = new Renderer(this.canvas);

        this.shader = new Shader(this.renderer.gl, vertexShaderSource, fragmentShaderSource);
        this.world = new World(this.renderer.gl);

        window.addEventListener("resize", () => this.onResize());
        this.onResize();
    }

    public start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        this.renderer.setClearColor(0.1, 0.1, 0.1, 1.0);
        requestAnimationFrame((time) => this.loop(time));
    }

    private onResize(): void {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.renderer.setViewport(this.canvas.width, this.canvas.height);
    }

    private loop(time: number): void {
        if (!this.isRunning) return;

        const deltaTime = (time - this.lastTime) * 0.001;
        this.lastTime = time;

        this.render();
        requestAnimationFrame((time) => this.loop(time));
    }

    private render(): void {
        this.renderer.clear();
        
        const chunkVAO = this.world.chunk.vao;
        if (!chunkVAO || this.world.chunk.vertexCount === 0) return;

        const projection = mat4.create();
        mat4.perspective(projection, Math.PI / 4, this.canvas.width / this.canvas.height, 0.1, 100.0);

        const view = mat4.create();
        mat4.lookAt(view, [8, 8, 12], [1.5, 1.5, 1.5], [0, 1, 0]);

        const mvp = mat4.create();
        mat4.multiply(mvp, projection, view);


        this.shader.bind();
        this.shader.setMat4("u_MVP", mvp as Float32Array); 

        this.renderer.draw(chunkVAO, this.shader, this.world.chunk.vertexCount);
    }
}