import { Renderer } from "../renderer/Renderer";
import { Shader } from "../renderer/Shader";
import { vertexShaderSource, fragmentShaderSource } from "../renderer/shaders/ChunkShader";
import { World } from "../world/World";
import { mat4 } from "gl-matrix";
import { TerrainPhysics } from "../physics/TerrainPhysics";
import RAPIER from "@dimforge/rapier3d-compat";
import { PhysicsDebugRenderer } from "../physics/PhysicsDebugRenderet";
import { PlayerController } from "./PlayerController";
import { StructuralIntegrity } from "../physics/StructuralIntegrity";
import { Window } from "./Window";
import { globalEventBus } from "./EventBus";

export class Engine {
    private readonly canvas: HTMLCanvasElement;
    private readonly renderer: Renderer;
    private readonly shader: Shader;
    private window: Window; 
    private world: World;
    public physicsWorld: RAPIER.World;
    
    private terrainPhysics: TerrainPhysics;
    private structuralIntegrity: StructuralIntegrity;
    
    private player: PlayerController;
    
    
    private physicsDebugRenderer: PhysicsDebugRenderer;
    private showPhysicsDebug: boolean = false;
    public static readonly gravity = { x: 0.0, y: -9.81, z: 0.0 };
    public static readonly voxelSize = 0.30;
    
    private isRunning: boolean = false;
    private lastTime: number = 0;

    constructor(canvasId: string) {
        const canvasElement = document.getElementById(canvasId) as HTMLCanvasElement | null;
        if (!canvasElement) throw new Error(`Canvas with ID '${canvasId}' not found.`);
        this.canvas = canvasElement;
        
        this.renderer = new Renderer(this.canvas);
        this.shader = new Shader(this.renderer.gl, vertexShaderSource, fragmentShaderSource);
        this.physicsDebugRenderer = new PhysicsDebugRenderer(this.renderer.gl);
        
        this.physicsWorld = new RAPIER.World(Engine.gravity);

        this.physicsWorld.integrationParameters.numSolverIterations = 1; 

        this.physicsWorld.integrationParameters.maxCcdSubsteps = 1;

        this.world = new World(this.renderer.gl);
        this.terrainPhysics = new TerrainPhysics(this.physicsWorld);
        this.terrainPhysics.buildColliders(this.world);
        
        this.structuralIntegrity = new StructuralIntegrity(this.renderer.gl, this.world, this.physicsWorld, this.terrainPhysics);
        this.player = new PlayerController(this.canvas, this.world, this.physicsWorld);
        
        


        globalEventBus.on("WINDOW_RESIZE", (data) => {
            this.renderer.setViewport(data.width, data.height);
        });

        globalEventBus.on("TOGGLE_PHYSICS_DEBUG", () => {
            this.showPhysicsDebug = !this.showPhysicsDebug;
            console.log(`Physics Debug: ${this.showPhysicsDebug ? 'ON' : 'OFF'}`);
        });

        this.window = new Window(this.canvas);
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
        
        requestAnimationFrame((time) => this.loop(time));
    }

    private update(deltaTime: number): void {
        this.player.update(deltaTime);
        this.physicsWorld.step();
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
        this.shader.setMat4("u_MVP", mvp as Float32Array); 

      
        for (const chunk of this.world.chunks.values()) {
            if (!chunk.vao || chunk.vertexCount === 0) continue;
            this.renderer.draw(chunk.vao, this.shader, chunk.vertexCount);
        }
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
            this.renderer.draw(debriVAO, this.shader, debri.vertexCount);
        }
    }

    private drawPhysicsDebug(projection: mat4, view: mat4): void {
        if (!this.showPhysicsDebug) return;

        const mvp = mat4.create();
        mat4.multiply(mvp, projection, view);

        const gl = this.renderer.gl;
        gl.disable(gl.DEPTH_TEST);
        this.physicsDebugRenderer.render(this.physicsWorld, mvp);
        gl.enable(gl.DEPTH_TEST);
    }
}