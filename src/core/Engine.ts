import { Renderer } from "../renderer/Renderer";
import { Shader } from "../renderer/Shader";
import { vertexShaderSource, fragmentShaderSource } from "../renderer/shaders/ChunkShader";
import { World } from "../world/World";
import { Camera } from "./Camera";
import { Input } from "./Input";
import { mat4, vec3 } from "gl-matrix";
import { VoxelRaycaster } from "../physics/VoxelRaycaster";
import { StructuralIntegrity } from "../physics/StructuralIntegrity";

export class Engine {
    private readonly canvas: HTMLCanvasElement;
    private readonly renderer: Renderer;
    
    private isRunning: boolean = false;
    private lastTime: number = 0;

    private shader: Shader;
    private world: World;

    private camera: Camera;
    private input: Input;

    private structuralIntegrity: StructuralIntegrity;

    constructor(canvasId: string) {
        const canvasElement = document.getElementById(canvasId) as HTMLCanvasElement | null;
        if (!canvasElement) throw new Error(`Canvas with ID '${canvasId}' not found.`);
        
        this.canvas = canvasElement;
        this.renderer = new Renderer(this.canvas);

        this.shader = new Shader(this.renderer.gl, vertexShaderSource, fragmentShaderSource);
        this.world = new World(this.renderer.gl);

        this.input = new Input(this.canvas);
        this.camera = new Camera(vec3.fromValues(4, 4, 10));

        this.structuralIntegrity = new StructuralIntegrity(this.world);
        

        window.addEventListener("resize", () => this.onResize());
        this.canvas.addEventListener("mousedown", (e) => {
            if (this.input.isLocked && e.button === 0) {
                this.handleLeftClick();
            }
        });

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
        this.update(deltaTime);
        this.render();
        requestAnimationFrame((time) => this.loop(time));
    }

    private update(deltaTime: number): void {
        if (!this.input.isLocked) return;

        const mouse = this.input.consumeMouseDeltas();
        if (mouse.x !== 0 || mouse.y !== 0) {
            this.camera.processMouseMovement(mouse.x, mouse.y);
        }

        if (this.input.isKeyPressed("KeyW")) this.camera.processKeyboard("FORWARD", deltaTime);
        if (this.input.isKeyPressed("KeyS")) this.camera.processKeyboard("BACKWARD", deltaTime);
        if (this.input.isKeyPressed("KeyA")) this.camera.processKeyboard("LEFT", deltaTime);
        if (this.input.isKeyPressed("KeyD")) this.camera.processKeyboard("RIGHT", deltaTime);
        
        if (this.input.isKeyPressed("Space")) this.camera.processKeyboard("UP", deltaTime);
        if (this.input.isKeyPressed("ShiftLeft")) this.camera.processKeyboard("DOWN", deltaTime);
    }

    private render(): void {
        this.renderer.clear();
        
        const chunkVAO = this.world.chunk.vao;
        if (!chunkVAO || this.world.chunk.vertexCount === 0) return;

        const projection = mat4.create();
        mat4.perspective(projection, Math.PI / 4, this.canvas.width / this.canvas.height, 0.1, 100.0);

        const view = this.camera.getViewMatrix(); 

        const mvp = mat4.create();
        mat4.multiply(mvp, projection, view);

        this.shader.bind();
        this.shader.setMat4("u_MVP", mvp as Float32Array); 

        this.renderer.draw(chunkVAO, this.shader, this.world.chunk.vertexCount);
    }

    private handleLeftClick(): void {
        const reach = 5.0; 
        
        const result = VoxelRaycaster.raycast(
            this.camera.position,
            this.camera.front,
            reach,
            this.world
        );

        if (result.hit) {
            const [x, y, z] = result.blockPos;
            this.world.chunk.setBlock(x, y, z, 0);
            this.structuralIntegrity.checkSupport(x, y, z);
            
            this.world.updateMesh();
        }
    }


}