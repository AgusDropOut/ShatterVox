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
    private showPhysicsDebug: boolean = false;
    private showDepthDebug: boolean = false;
    private showNormalsDebug: boolean = false;
    private showAlbedoDebug: boolean = false;
    private showGTAODebug: boolean = false;
    private showBlurGTAODebug: boolean = false;
    private showNoisySSGIDebug: boolean = false;
    private showBlurredSSGIDebug: boolean = false;
    private showDeferredDebug: boolean = false;
    private fpsElement: HTMLElement | null;
    private framesThisSecond: number = 0;
    private totalFrames: number = 0;
    private lastFpsTime: number = 0;

    private entityRepository: EntityRepository;
    private explosiveManager!: ExplosiveManager;
    private debugGui!: DebugGui;

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

        globalEventBus.on("TOGGLE_PHYSICS_DEBUG", () => {
            this.showPhysicsDebug = !this.showPhysicsDebug;
        });

        globalEventBus.on("DEBUG_DEPTH", () => {
            this.showDepthDebug = !this.showDepthDebug; 
            this.showAlbedoDebug = false;
            this.showNormalsDebug = false;
            this.showGTAODebug = false;
            this.showBlurGTAODebug = false;
        });

        globalEventBus.on("DEBUG_NORMALS", () => {
            this.showNormalsDebug = !this.showNormalsDebug; 
            this.showAlbedoDebug = false;
            this.showDepthDebug = false;
            this.showGTAODebug = false;
            this.showBlurGTAODebug = false;
        });

        globalEventBus.on("DEBUG_ALBEDO", () => {
            this.showAlbedoDebug = !this.showAlbedoDebug; 
            this.showDepthDebug = false;
            this.showNormalsDebug = false;
            this.showGTAODebug = false;
            this.showBlurGTAODebug = false;
        });

        globalEventBus.on("DEBUG_GTAO", () => {
            this.showGTAODebug = !this.showGTAODebug;
            this.showAlbedoDebug = false;
            this.showDepthDebug = false;
            this.showNormalsDebug = false;
            this.showBlurGTAODebug = false;
        });

        globalEventBus.on("DEBUG_BLUR_GTAO", () => {
            this.showBlurGTAODebug = !this.showBlurGTAODebug;
            this.showAlbedoDebug = false;
            this.showDepthDebug = false;
            this.showNormalsDebug = false;
            this.showGTAODebug = false;
        });

        globalEventBus.on("DEBUG_NOISY_SSGI", () => {
            this.showNoisySSGIDebug = !this.showNoisySSGIDebug;
            this.showAlbedoDebug = false;
            this.showDepthDebug = false;
            this.showNormalsDebug = false;
            this.showGTAODebug = false;
            this.showBlurGTAODebug = false;
        });

        globalEventBus.on("DEBUG_BLUR_SSGI", () => {
            this.showBlurredSSGIDebug = !this.showBlurredSSGIDebug;
            this.showAlbedoDebug = false;
            this.showDepthDebug = false;
            this.showNormalsDebug = false;
            this.showGTAODebug = false;
            this.showBlurGTAODebug = false;
            this.showNoisySSGIDebug = false;
        });

         globalEventBus.on("DEBUG_DEFERRED", () => {
            this.showDeferredDebug = !this.showDeferredDebug;
            this.showAlbedoDebug = false;
            this.showDepthDebug = false;
            this.showNormalsDebug = false;
            this.showGTAODebug = false;
            this.showBlurGTAODebug = false;
            this.showNoisySSGIDebug = false;
            this.showBlurredSSGIDebug = false;
        });

        this.window = new Window(this.canvas);
        this.entityRepository = new EntityRepository();

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

        this.player = new PlayerController(this.canvas, this.world, this.physicsFacade);
        this.explosiveManager = new ExplosiveManager(this.entityRepository, this.physicsFacade, this.world);

        await this.renderer.loadEntityAsset(
            "bomb", 
            "/assets/models/bomb.obj", 
            "/assets/textures/bomb.png"
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
        this.world.updateDirtyMeshes();
    }

    private render(): void {
        const view = this.player.camera.getViewMatrix(); 
        const invViewProj = mat4.create();
        const viewProj = mat4.create();
        mat4.multiply(viewProj, Engine.projectionMatrix, view);
        mat4.invert(invViewProj, viewProj);

        this.renderer.beginFrame(viewProj as Float32Array, invViewProj as Float32Array, view as Float32Array, this.totalFrames);
        if(this.showPhysicsDebug) {
            this.renderer.drawPhysicsDebug(this.physicsFacade.debugVertices, this.physicsFacade.debugColors);
        }
        
        this.renderer.drawGeometry(this.world, this.entityRepository,this.physicsFacade);


        this.renderer.computeGTAO();

        this.renderer.drawDeferred(this.physicsFacade);

        this.renderer.computeSSGI();

        this.renderer.drawComposition();

        this.renderer.drawTAA(this.totalFrames);

        if(this.showDepthDebug) {
            this.renderer.debugDrawTexture(this.renderer.depthView, true);
        }
        if(this.showNormalsDebug) {
            this.renderer.debugDrawTexture(this.renderer.normalView);
        }
        if(this.showAlbedoDebug) {
            this.renderer.debugDrawTexture(this.renderer.albedoView);
        }
        if(this.showGTAODebug) {
            this.renderer.debugDrawTexture(this.renderer.noisyGTAOView);
        }

        if(this.showBlurGTAODebug) {
            this.renderer.debugDrawTexture(this.renderer.blurredGTAOView);
        }

        if(this.showNoisySSGIDebug) {
            this.renderer.debugDrawTexture(this.renderer.noisySSGIView);
        }

        if(this.showBlurredSSGIDebug) {
            this.renderer.debugDrawTexture(this.renderer.blurredSSGIView);
        }

        if(this.showDeferredDebug) {
            this.renderer.debugDrawTexture(this.renderer.deferredView);
        }

        this.renderer.endFrame();
    }
}