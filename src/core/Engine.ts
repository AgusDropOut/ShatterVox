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
        this.populateChunks();
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

    private populateChunks(): void {
        const CHUNKS_X = 4;
        const CHUNKS_Y = 2;
        const CHUNKS_Z = 4;

        for (let cx = 0; cx < CHUNKS_X; cx++) {
            for (let cy = 0; cy < CHUNKS_Y; cy++) {
                for (let cz = 0; cz < CHUNKS_Z; cz++) {
                    const chunk = new Chunk(this.renderer.gl, cx, cy, cz);
                    this.world.chunks.set(`${cx},${cy},${cz}`, chunk);
                }
            }
        }

        const WORLD_WIDTH = CHUNKS_X * Chunk.WIDTH;
        const WORLD_DEPTH = CHUNKS_Z * Chunk.DEPTH;

        for (let x = 0; x < WORLD_WIDTH; x++) {
            for (let z = 0; z < WORLD_DEPTH; z++) {
                this.world.setBlock(x, 0, z, 1);
                if (Math.random() > 0.99) {
                    this.world.setBlock(x, 1, z, 1);
                }
            }
        }

        const templeX = 40, templeZ = 40, templeY = 1; 
        const templeWidth = 40, templeDepth = 26;

        for (let x = templeX; x < templeX + templeWidth; x++) {
            for (let z = templeZ; z < templeZ + templeDepth; z++) {
                this.world.setBlock(x, templeY, z, 1);
                this.world.setBlock(x, templeY + 1, z, 1);
                this.world.setBlock(x, templeY + 2, z, 1); 
            }
        }

        const columnSpacing = 8;
        for (let x = templeX + 3; x < templeX + templeWidth - 3; x += columnSpacing) {
            for (let z of [templeZ + 3, templeZ + templeDepth - 6]) {
                for (let y = templeY + 3; y < templeY + 18; y++) {
                    for(let cx = 0; cx < 3; cx++) {
                        for(let cz = 0; cz < 3; cz++) {
                            this.world.setBlock(x + cx, y, z + cz, 1);
                        }
                    }
                }
            }
        }

        for (let x = templeX - 2; x < templeX + templeWidth + 2; x++) {
            for (let z = templeZ - 2; z < templeZ + templeDepth + 2; z++) {
                this.world.setBlock(x, templeY + 18, z, 1);
                this.world.setBlock(x, templeY + 19, z, 1);
                this.world.setBlock(x, templeY + 20, z, 1);
                
                if (x > templeX + 2 && x < templeX + templeWidth - 2) {
                    this.world.setBlock(x, templeY + 21, z, 1);
                    this.world.setBlock(x, templeY + 22, z, 1);
                    if (z > templeZ + 6 && z < templeZ + templeDepth - 6) {
                        this.world.setBlock(x, templeY + 23, z, 1);
                    }
                }
            }
        }

        const treeX = 90, treeZ = 90;
        const treeBaseY = 1; 

        for (let y = treeBaseY; y < treeBaseY + 20; y++) {
            for (let x = treeX - 2; x <= treeX + 2; x++) {
                for (let z = treeZ - 2; z <= treeZ + 2; z++) {
                    if (Math.random() > 0.05) this.world.setBlock(x, y, z, 1);
                }
            }
        }

        const radius = 12;
        const canopyCenterY = treeBaseY + 22;
        for (let x = treeX - radius; x <= treeX + radius; x++) {
            for (let y = canopyCenterY - radius; y <= canopyCenterY + radius; y++) {
                for (let z = treeZ - radius; z <= treeZ + radius; z++) {
                    const dx = x - treeX;
                    const dy = y - canopyCenterY;
                    const dz = z - treeZ;
                    if (dx*dx + dy*dy + dz*dz <= radius*radius - Math.random() * 8) {
                        this.world.setBlock(x, y, z, 1);
                    }
                }
            }
        }

        const archX = 15, archZ = 90, archY = 1;
        for (let i = 0; i < 15; i++) { 
            this.world.setBlock(archX, archY + i, archZ, 1);
            this.world.setBlock(archX + 1, archY + i, archZ, 1);
        }
        for (let i = 0; i < 15; i++) { 
            this.world.setBlock(archX + 16, archY + i, archZ, 1);
            this.world.setBlock(archX + 17, archY + i, archZ, 1);
        }
        for (let i = 0; i <= 16; i++) { 
            if (i < 6 || i > 10) { 
                this.world.setBlock(archX + i, archY + 14, archZ, 1);
                this.world.setBlock(archX + i, archY + 15, archZ, 1);
            }
        }

        this.world.updateAllMeshes();
    }
}