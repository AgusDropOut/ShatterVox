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
import { ExplosiveManager } from "../entity/manager/ExplosiveManager";
import {EntityRepository} from "../entity/EntityRepository";
import { AssetManager } from "../renderer/AssetManager";
import { entityFragmentShaderSource, entityVertexShaderSource } from "../renderer/shaders/EntityShader";

export class Engine {
    private readonly canvas: HTMLCanvasElement;
    private readonly renderer: Renderer;
    private readonly shader: Shader;
    private readonly entityShader: Shader;
    private window: Window; 
    private world: World;
    private terrainPhysics: TerrainPhysics;
    private StructuralIntegrity: StructuralIntegrity;
    private debugRenderer: PhysicsDebugRenderer;
    private player: PlayerController;
    private isRunning: boolean = false;

    private lastTime: number = 0;
    private physicsFacade: PhysicsFacade;
    public static readonly voxelSize: number = 0.12;
    private showPhysicsDebug: boolean = false;
    private fpsElement: HTMLElement | null;
    private framesThisSecond: number = 0;
    private lastFpsTime: number = 0;

    private entityRepository: EntityRepository;
    private explosiveManager: ExplosiveManager;
   

    constructor(canvasId: string) {
        const canvasElement = document.getElementById(canvasId) as HTMLCanvasElement | null;
        if (!canvasElement) throw new Error(`Canvas with ID '${canvasId}' not found.`);
        this.canvas = canvasElement;
        
        this.renderer = new Renderer(this.canvas);
        this.shader = new Shader(this.renderer.gl, vertexShaderSource, fragmentShaderSource);
        this.entityShader = new Shader(this.renderer.gl, entityVertexShaderSource, entityFragmentShaderSource);
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

        this.entityRepository = new EntityRepository();
        this.explosiveManager = new ExplosiveManager(this.entityRepository, this.physicsFacade, this.world);

    }

    public async initResources(): Promise<void> {

     
        await AssetManager.loadAsset(
            "bomb", 
            "/assets/models/bomb.obj",     
            "/assets/textures/bomb.png", 
            this.renderer.gl
        );
    }

    public start(): void {
        if (this.isRunning) return;

        console.log("[Engine] Initializing resources...");
        this.initResources().then(() => {
            console.log("[Engine] Resources initialized. Starting main loop.");
        });
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
        this.explosiveManager.update(deltaTime);
    }

    private render(): void {
        this.renderer.clear();

        const projection = mat4.create();
        mat4.perspective(projection, Math.PI / 4, this.canvas.width / this.canvas.height, 0.1, 100.0);
        
        const view = this.player.camera.getViewMatrix(); 
        this.drawEntities(projection, view);
        this.drawChunks(projection, view);
        this.drawDebris(projection, view);
        this.drawPhysicsDebug(projection, view);

        
    }

    private drawEntities(projection: mat4, view: mat4): void {
        const gl = this.renderer.gl;
        this.entityShader.bind();


        for (const [entityId, renderComp] of this.entityRepository.renders.entries()) {
            const physComp = this.entityRepository.physics.get(entityId);
            if (!physComp) {
                console.warn(`No physics component found for entity ${entityId}`);
                continue;
            } 

            const transform = this.physicsFacade.transforms.get(physComp.bodyId);
            if (!transform){
                console.warn(`No transform found for entity ${entityId} with bodyId ${physComp.bodyId}`);
                continue;
            }
            const asset = AssetManager.getAsset(renderComp.modelId);
            if (!asset){
                console.warn(`No asset found for modelId ${renderComp.modelId} or VAO is null`);
                continue;
            } 
            
            if(!asset.mesh.vao ) {
                console.warn(`Asset for modelId ${renderComp.modelId} has no VAO.`);
                continue;
            }


            if (asset.mesh.vertexCount === 0) {
                console.warn(`Asset for modelId ${renderComp.modelId} has zero vertex count.`);
                continue;
            }

            console.log(`Rendering entity ${entityId} with model ${renderComp.modelId}`);

            const modelMatrix = mat4.create();
        
            mat4.translate(modelMatrix, modelMatrix, transform.position);
            
            
            const rotationMat = mat4.create();
            mat4.fromQuat(rotationMat, transform.rotation);
            mat4.multiply(modelMatrix, modelMatrix, rotationMat);
            mat4.translate(modelMatrix, modelMatrix, [0, -0.125, 0]);
            
            mat4.scale(modelMatrix, modelMatrix, renderComp.scale);

            const mvp = mat4.create();
            mat4.multiply(mvp, projection, view);
            mat4.multiply(mvp, mvp, modelMatrix);

       
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, asset.texture);
            
            this.entityShader.setMat4("u_MVP", mvp as Float32Array);
            this.entityShader.setInt("u_Texture", 0);

            this.renderer.draw(asset.mesh.vao, this.entityShader, asset.mesh.vertexCount);
        }
    }

    private drawChunks(projection: mat4, view: mat4): void {
        const mvp = mat4.create();
        mat4.multiply(mvp, projection, view); 

        this.shader.bind();
        this.renderer.textureAtlas.bind(0);
        this.shader.setInt("u_Texture", 0);
        this.shader.setInt("u_Texture", 0);
        this.shader.setMat4("u_MVP", mvp as Float32Array); 

        for (const chunk of this.world.chunks.values()) {
            if (!chunk.vao || chunk.vertexCount === 0) continue;
            this.renderer.draw(chunk.vao, this.shader, chunk.vertexCount);
        }
        this.renderer.textureAtlas.unbind();
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
        this.shader.bind();
        this.renderer.textureAtlas.bind(0);
        this.shader.setInt("u_Texture", 0);
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
        this.renderer.textureAtlas.unbind();
    }

    
}