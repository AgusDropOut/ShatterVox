import { WebGPURenderer } from "../renderer/WebGPURenderer";
import { World } from "../world/World";
import { mat4 } from "gl-matrix";
import { TerrainPhysics } from "../physics/TerrainPhysics";
import { PlayerController } from "./PlayerController";
import { Window } from "./Window";
import { globalEventBus } from "./EventBus";
import { PhysicsFacade } from "../physics/PhysicsFacade";
import { StructuralIntegrity } from "../physics/StructuralIntegrity";
import { ExplosiveManager } from "../entity/manager/ExplosiveManager";
import { EntityRepository } from "../entity/EntityRepository";
import { BlockRegistry } from "../block/BlockRegistry";
import { DebugGui } from "./DebugGui";
import { SoundManager } from "../audio/SoundManager";
import { ParticleEffectsController } from "../particle/ParticleEffectController";
import { BillBoardManager } from "../entity/manager/BillBoardManager";
import { BuildManager } from "./BuildManager";

export class Engine {
    private readonly canvas: HTMLCanvasElement;
    private readonly renderer: WebGPURenderer;
    private window: Window; 
    private world!: World;
    private terrainPhysics!: TerrainPhysics;
    private structuralIntegrity!: StructuralIntegrity;
    
    private player!: PlayerController;
    private isRunning: boolean = false;
    private lastTime: number = 0;
    private physicsFacade: PhysicsFacade;
    public static readonly voxelSize: number = 0.12;
    private soundManager: SoundManager;
    private particleController!: ParticleEffectsController;

  
    private showPhysicsDebug: boolean = false;
    private currentDebugView: string = 'None';

    private fpsElement: HTMLElement | null;
    private framesThisSecond: number = 0;
    private totalFrames: number = 0;
    private lastFpsTime: number = 0;

    private entityRepository: EntityRepository;
    private explosiveManager!: ExplosiveManager;
    private billboardManager!: BillBoardManager;
    private debugGui!: DebugGui;

    private buildManager!: BuildManager;

    public static projectionMatrix: mat4 = mat4.create();
    public static zNear: number = 0.1;
    public static zFar: number = 100.0;
    public static screenWidth: number = 0;
    public static screenHeight: number = 0;

    constructor(canvasId: string) {
        const canvasElement = document.getElementById(canvasId) as HTMLCanvasElement | null;
        if (!canvasElement) throw new Error(`Canvas with ID '${canvasId}' not found.`);
        this.canvas = canvasElement;
        
        this.renderer = new WebGPURenderer(this.canvas);
        this.fpsElement = document.getElementById("fps-counter");
        this.soundManager = new SoundManager();
        
        this.physicsFacade = new PhysicsFacade();
        globalEventBus.emit("PHYSICS_COMMAND", { 
            type: 'INIT', 
            gravity: { x: 0.0, y: -9.81, z: 0.0 },
            blockDefs: BlockRegistry.exportPhysicsConfig()
        });

        globalEventBus.on("WINDOW_RESIZE", (data) => {
            Engine.projectionMatrix = mat4.create();
            mat4.perspectiveZO(Engine.projectionMatrix, Math.PI / 4, data.width / data.height, Engine.zNear, Engine.zFar);
            Engine.screenWidth = data.width;
            Engine.screenHeight = data.height;
            this.renderer.resize(data.width, data.height);
        });

        globalEventBus.on("TOGGLE_PHYSICS_DEBUG", (data) => {
            this.showPhysicsDebug = data.enabled !== undefined ? data.enabled : !this.showPhysicsDebug;
        });

        globalEventBus.on("CHANGE_DEBUG_VIEW", (data) => {
            this.currentDebugView = data.view;
        });

        this.window = new Window(this.canvas);
        this.entityRepository = new EntityRepository();
        ParticleEffectsController.initialize();

        Engine.projectionMatrix = mat4.create();
        mat4.perspectiveZO(Engine.projectionMatrix, Math.PI / 4, this.canvas.width / this.canvas.height, Engine.zNear, Engine.zFar);
        Engine.screenWidth = this.canvas.width;
        Engine.screenHeight = this.canvas.height;
    }

    public async start(): Promise<void> {
        if (this.isRunning) return;

        console.log("[Engine] Initializing WebGPU...");
        const success = await this.renderer.init();
        if (!success) {
            console.error("[Engine] Failed to initialize graphics engine.");
            return;
        }

        this.debugGui = new DebugGui(this.renderer);

        this.world = new World(this.renderer.device, this.renderer.getModelLayout());

        this.structuralIntegrity = new StructuralIntegrity(
            this.renderer.device, 
            this.renderer.getModelLayout(), 
            this.world, 
            this.physicsFacade
        );
        
        this.terrainPhysics = new TerrainPhysics();
        this.terrainPhysics.buildColliders(this.world);
        this.world.terrainPhysics = this.terrainPhysics;
        this.soundManager.loadSound("stone_collision", "/assets/sounds/stone_collision.ogg");
        this.soundManager.loadSound("wood_collision", "/assets/sounds/wood_collision.ogg");
        this.soundManager.loadSound("glass_collision", "/assets/sounds/glass_collision.ogg");
        this.soundManager.loadSound("grass_collision", "/assets/sounds/grass_collision.ogg");
        this.soundManager.loadSound("leaves_collision", "/assets/sounds/leaves_collision.ogg");
        this.soundManager.loadSound("nade_explosion", "/assets/sounds/nade_explosion.ogg");
        this.soundManager.loadSound("slime_squish", "/assets/sounds/slime_squish.ogg");
        this.soundManager.loadImpulseResponse("/assets/sounds/cave_ir.ogg"),
        this.buildManager = new BuildManager(this.world);
        this.player = new PlayerController(this.canvas, this.world, this.physicsFacade, this.soundManager, this.buildManager);
        this.explosiveManager = new ExplosiveManager(this.entityRepository, this.physicsFacade, this.world);
        this.billboardManager = new BillBoardManager(this.entityRepository, this.physicsFacade, this.world);
        

        await this.renderer.loadEntityAsset(
            "bomb", 
            "/assets/models/bomb.obj", 
            "/assets/textures/bomb.png"
        );

        await this.renderer.loadEntityAsset(
            "billboard", 
            "/assets/models/billboard.obj", 
            "/assets/textures/billboard.png"
        );

        console.log("[Engine] Initialization complete. Starting main loop.");
        this.isRunning = true;
        requestAnimationFrame((time) => this.loop(time));
    }

    private loop(time: number): void {
        if (!this.isRunning) return;
        this.totalFrames++;
        if (this.lastTime === 0) {
            this.lastTime = time;
            this.lastFpsTime = time;
        }

        const deltaTime = (time - this.lastTime) * 0.001;
        this.lastTime = time;
        
        this.update(deltaTime);
        this.render();

        this.framesThisSecond++;
        if (time - this.lastFpsTime >= 1000) {
            if (this.fpsElement) this.fpsElement.innerText = `FPS: ${this.framesThisSecond}`;
            this.framesThisSecond = 0; 
            this.lastFpsTime = time;  
        }
        
        requestAnimationFrame((time) => this.loop(time));
    }

    private update(deltaTime: number): void {
        if (!this.physicsFacade || this.physicsFacade.transforms.size === 0) {
            return;
        }

       

        this.player.update(deltaTime);
        this.explosiveManager.update(deltaTime);
        this.world.update(deltaTime);
    }

    private render(): void {
        const view = this.player.camera.getViewMatrix(); 
        const invViewProj = mat4.create();
        const viewProj = mat4.create();
        mat4.multiply(viewProj, Engine.projectionMatrix, view);
        mat4.invert(invViewProj, viewProj);

        this.renderer.beginFrame(viewProj as Float32Array, invViewProj as Float32Array, view as Float32Array, this.totalFrames);
        
        
        
        this.renderer.drawGeometry(this.world, this.entityRepository, this.physicsFacade);
        this.renderer.computeParticles();
        this.renderer.drawParticles();
        this.renderer.computeGTAO();
        this.renderer.drawDeferred(this.physicsFacade);
        this.renderer.computeSSGI();
        this.renderer.drawComposition();
        this.renderer.drawTAA(this.totalFrames);

      
        switch (this.currentDebugView) {
            case 'Depth':
                this.renderer.debugDrawTexture(this.renderer.depthView, true);
                break;
            case 'Normals':
                this.renderer.debugDrawTexture(this.renderer.normalView);
                break;
            case 'Albedo':
                this.renderer.debugDrawTexture(this.renderer.albedoView);
                break;
            case 'Deferred':
                this.renderer.debugDrawTexture(this.renderer.deferredView);
                break;
            case 'GTAO (Noisy)':
                this.renderer.debugDrawTexture(this.renderer.noisyGTAOView);
                break;
            case 'GTAO (Blurred)':
                this.renderer.debugDrawTexture(this.renderer.blurredGTAOView);
                break;
            case 'SSGI (Noisy)':
                this.renderer.debugDrawTexture(this.renderer.noisySSGIView);
                break;
            case 'SSGI (Blurred)':
                this.renderer.debugDrawTexture(this.renderer.blurredSSGIView);
                break;
        }

        if (this.showPhysicsDebug) {
            this.renderer.drawPhysicsDebug(this.physicsFacade.debugVertices, this.physicsFacade.debugColors);
        }

        this.renderer.endFrame();
    }
}