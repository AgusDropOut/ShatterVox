import { Renderer } from "../renderer/Renderer";
import { Shader } from "../renderer/Shader";
import { vertexShaderSource, fragmentShaderSource } from "../renderer/shaders/ChunkShader";
import { World } from "../world/World";
import { mat4 } from "gl-matrix";
import { TerrainPhysics } from "../physics/TerrainPhysics";
import { PlayerController } from "./PlayerController";
import { Window } from "./Window";
import { globalEventBus } from "./EventBus";
import { PhysicsFacade } from "../physics/PhysicsFacade";
import { Chunk } from "../world/Chunk";
import { PhysicsDebugRenderer } from "../physics/PhysicsDebugRenderet";
import { StructuralIntegrity } from "../physics/StructuralIntegrity";
import { TerrainGenerator } from "../world/TerrainGenerator";

export class Engine {
    private readonly canvas: HTMLCanvasElement;
    private readonly renderer: Renderer;
    private readonly shader: Shader;
    private window: Window; 
    private world: World;
    private terrainPhysics: TerrainPhysics;
    private StructuralIntegrity: StructuralIntegrity;
    private debugRenderer: PhysicsDebugRenderer;
    private player: PlayerController;
    private isRunning: boolean = false;

    private lastTime: number = 0;
    private physicsFacade: PhysicsFacade;
    public static readonly voxelSize: number = 0.30;
    private showPhysicsDebug: boolean = false;
    private fpsElement: HTMLElement | null;
    private framesThisSecond: number = 0;
    private lastFpsTime: number = 0;
   

    constructor(canvasId: string) {
        const canvasElement = document.getElementById(canvasId) as HTMLCanvasElement | null;
        if (!canvasElement) throw new Error(`Canvas with ID '${canvasId}' not found.`);
        this.canvas = canvasElement;
        
        this.renderer = new Renderer(this.canvas);
        this.shader = new Shader(this.renderer.gl, vertexShaderSource, fragmentShaderSource);
        this.debugRenderer = new PhysicsDebugRenderer(this.renderer.gl);
        this.fpsElement = document.getElementById("fps-counter");
        
        this.physicsFacade = new PhysicsFacade();
        globalEventBus.emit("PHYSICS_COMMAND", { 
            type: 'INIT', 
            gravity: { x: 0.0, y: -9.81, z: 0.0 } 
        });

        this.world = new World(this.renderer.gl);

    
        
        this.terrainPhysics = new TerrainPhysics();
        this.terrainPhysics.buildColliders(this.world);
        this.StructuralIntegrity = new StructuralIntegrity(this.renderer.gl, this.world, this.physicsFacade);
        

        globalEventBus.on("WINDOW_RESIZE", (data) => {
            this.renderer.setViewport(data.width, data.height);
        });

        globalEventBus.on("TOGGLE_PHYSICS_DEBUG", () => {
            this.showPhysicsDebug = !this.showPhysicsDebug;
        });

        this.window = new Window(this.canvas);

        this.player = new PlayerController(this.canvas, this.world, this.physicsFacade);

    }

    public start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        this.renderer.setClearColor(0.0, 0.4, 1.0, 1.0);
        requestAnimationFrame((time) => this.loop(time));
    }

    private loop(time: number): void {
        if (!this.isRunning) return;

        const deltaTime = (time - this.lastTime) * 0.001;
        this.lastTime = time;
        
        this.update(deltaTime);
        this.render();

  
        this.framesThisSecond++;
        if (time - this.lastFpsTime >= 1000) {
            if (this.fpsElement) {
                this.fpsElement.innerText = `FPS: ${this.framesThisSecond}`;
            }
            this.framesThisSecond = 0; 
            this.lastFpsTime = time;  
        }
        
        
        requestAnimationFrame((time) => this.loop(time));
    }

    private update(deltaTime: number): void {
        this.player.update(deltaTime);
    }

    private render(): void {
        this.renderer.clear();

        const projection = mat4.create();
        mat4.perspective(projection, Math.PI / 4, this.canvas.width / this.canvas.height, 0.1, 100.0);
        
        const view = this.player.camera.getViewMatrix(); 
        
        this.drawChunks(projection, view);
        this.drawDebris(projection, view);
        this.drawPhysicsDebug(projection, view);

        
    }

    private drawChunks(projection: mat4, view: mat4): void {
        const mvp = mat4.create();
        mat4.multiply(mvp, projection, view); 

        this.shader.bind();
        this.shader.setInt("u_Texture", 0);
        this.shader.setMat4("u_MVP", mvp as Float32Array); 

        for (const chunk of this.world.chunks.values()) {
            if (!chunk.vao || chunk.vertexCount === 0) continue;
            this.renderer.draw(chunk.vao, this.shader, chunk.vertexCount);
        }
    }

     private drawPhysicsDebug(projection: mat4, view: mat4): void {
        if (!this.showPhysicsDebug) return;

        const mvp = mat4.create();
        mat4.multiply(mvp, projection, view);

        const gl = this.renderer.gl;
        gl.disable(gl.DEPTH_TEST);
        
        this.debugRenderer.render(this.physicsFacade.debugVertices, this.physicsFacade.debugColors, mvp);
        
        gl.enable(gl.DEPTH_TEST);
    }

    private drawDebris(projection: mat4, view: mat4): void {
        for (const debri of this.world.debri) {
            const debriVAO = debri.vao;
            if (!debriVAO || debri.vertexCount === 0) continue;
            
            const modelMatrix = debri.getModelMatrix();
            const mvp = mat4.create();

            mat4.multiply(mvp, projection, view);
            mat4.multiply(mvp, mvp, modelMatrix);

            this.shader.bind();
            this.shader.setMat4("u_MVP", mvp as Float32Array);
            this.shader.setInt("u_Texture", 0);
            this.renderer.draw(debriVAO, this.shader, debri.vertexCount);
        }
    }

    
}