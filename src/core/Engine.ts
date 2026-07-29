import { Renderer } from "../renderer/Renderer";
import { Shader } from "../renderer/Shader";
import { vertexShaderSource, fragmentShaderSource } from "../renderer/shaders/ChunkShader";
import { World } from "../world/World";
import { Camera } from "./Camera";
import { Input } from "./Input";
import { mat4, vec3 } from "gl-matrix";
import { VoxelRaycaster } from "../physics/VoxelRaycaster";
import { StructuralIntegrity } from "../physics/StructuralIntegrity";
import { TerrainPhysics } from "../physics/TerrainPhysics";
import RAPIER from "@dimforge/rapier3d-compat";
import { PhysicsDebugRenderer } from "../physics/PhysicsDebugRenderet";
import { ColliderRegistry } from "../physics/ColliderRegistry";

export class Engine {
    private readonly canvas: HTMLCanvasElement;
    private readonly renderer: Renderer;
    private physicsDebugRenderer: PhysicsDebugRenderer;
    private showPhysicsDebug: boolean = false;
    public static readonly gravity = { x: 0.0, y: -9.81, z: 0.0 };
    

    private isRunning: boolean = false;
    private lastTime: number = 0;

    private shader: Shader;
    private world: World;

    private camera: Camera;
    private input: Input;

    public physicsWorld: RAPIER.World;

    private structuralIntegrity: StructuralIntegrity;
    private terrainPhysics: TerrainPhysics;

    

    constructor(canvasId: string) {
        const canvasElement = document.getElementById(canvasId) as HTMLCanvasElement | null;
        if (!canvasElement) throw new Error(`Canvas with ID '${canvasId}' not found.`);
        
        this.canvas = canvasElement;
        this.renderer = new Renderer(this.canvas);
        this.physicsDebugRenderer = new PhysicsDebugRenderer(this.renderer.gl);

        this.shader = new Shader(this.renderer.gl, vertexShaderSource, fragmentShaderSource);
        this.world = new World(this.renderer.gl);
        

        this.input = new Input(this.canvas);
        this.camera = new Camera(vec3.fromValues(4, 4, 10));

        this.physicsWorld = new RAPIER.World(Engine.gravity);

        

        this.terrainPhysics = new TerrainPhysics(this.physicsWorld);

        this.structuralIntegrity = new StructuralIntegrity(this.renderer.gl,this.world, this.physicsWorld, this.terrainPhysics);

        this.terrainPhysics.buildColliders(this.world.chunk);
        

        window.addEventListener("resize", () => this.onResize());
        this.canvas.addEventListener("mousedown", (e) => {
            if (this.input.isLocked && e.button === 0) {
                this.handleLeftClick();
            }
        });
        window.addEventListener("keydown", (e) => {
            if (e.code === "KeyP") {
                this.showPhysicsDebug = !this.showPhysicsDebug;
                console.log(`Physics Debug: ${this.showPhysicsDebug ? 'ON' : 'OFF'}`);
            }
        });

        this.onResize();
    }

    public start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        this.renderer.setClearColor(0.0, 0.4, 1.0, 1.0);
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
        this.world.debri.forEach(debri => {
           console.log(`[Engine] Debris block count: ${debri.getBlockCount()}`);
        });
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

        this.physicsWorld.step();
    }

    private render(): void {
        this.renderer.clear();

        const projection = mat4.create();
        mat4.perspective(projection, Math.PI / 4, this.canvas.width / this.canvas.height, 0.1, 100.0);
        const view = this.camera.getViewMatrix(); 
        this.drawChunks(projection, view);
        this.drawDebris(projection, view);
        this.drawPhysicsDebug(projection, view);

        
        
    }

    private drawChunks(projection: mat4, view: mat4): void {
        const chunkVAO = this.world.chunk.vao;
        if (!chunkVAO || this.world.chunk.vertexCount === 0) return;

        

        const mvp = mat4.create();
        mat4.multiply(mvp, projection, view);

        this.shader.bind();
        this.shader.setMat4("u_MVP", mvp as Float32Array); 

        this.renderer.draw(chunkVAO, this.shader, this.world.chunk.vertexCount);
    }

    private drawDebris(projection: mat4, view: mat4): void {
        for (const debri of this.world.debri) {
            console.log(`[Render] Rendering debris with ${debri.vertexCount} vertices.`);
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

    private handleLeftClick(): void {
        const reach = 5.0; 
        
        const gridHit = VoxelRaycaster.raycastGrid(this.camera.position, this.camera.front, reach, this.world);
        const physicsHit = VoxelRaycaster.raycastPhysics(this.camera.position, this.camera.front, reach, this.physicsWorld);

        if (!gridHit.hit && !physicsHit.hit) return;

        if (gridHit.distance < physicsHit.distance) {

            const [x, y, z] = gridHit.blockPos;
            
            this.world.chunk.setBlock(x, y, z, 0);
            this.terrainPhysics.removeColliderAt(x, y, z);
            this.structuralIntegrity.checkSupport(x, y, z);
            
            this.world.updateMesh();
        } else {

            const handle = physicsHit.colliderHandle!;
            const voxelData = ColliderRegistry.get(handle);

            if (voxelData) {
                
                voxelData.debri.setBlock(voxelData.localX, voxelData.localY, voxelData.localZ, 0);
                
                const colliderToDestroy = this.physicsWorld.getCollider(handle);
                if (colliderToDestroy) {
                    this.physicsWorld.removeCollider(colliderToDestroy, true);
                }
                

                ColliderRegistry.delete(handle);
                
              
                this.world.updateDebriMesh(voxelData.debri);
                
                


                console.log(`[Physics] Removed block from debris at local position (${voxelData.localX}, ${voxelData.localY}, ${voxelData.localZ})`);
            }
        }
    }


}