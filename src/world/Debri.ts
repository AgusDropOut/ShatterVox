import { Engine } from "../core/Engine";
import type { Mesheable } from "../types/Mesheable";
import type { MeshData } from "./ChunkMesher"; 
import { mat4, vec3 } from "gl-matrix";
import type { PhysicsFacade } from "../physics/PhysicsFacade";
import { VoxelMesh } from "../renderer/VoxelMesh";
import { WebGPUUniformBuffer } from "../renderer/WebGPUUniformBuffer";
import { BlockRegistry } from "../block/BlockRegistry";
import { globalEventBus } from "../core/EventBus";

export class Debri implements Mesheable {
    public static readonly WIDTH = 32;
    public static readonly HEIGHT = 32;
    public static readonly DEPTH = 32;
    
  
    public static lifetimeMode: 'DEFAULT' | 'LONG' | 'PERSISTENT' = 'DEFAULT';

    public lifeTime: number = 0;

    private readonly blocks: Uint8Array;

    public readonly id: number;
    private readonly physicsFacade: PhysicsFacade;

    public offsetX: number = 0;
    public offsetY: number = 0;
    public offsetZ: number = 0;

    private mesh: VoxelMesh;
    private modelBuffer: WebGPUUniformBuffer;

    public isPersistent: boolean = false;
    
    constructor(device: GPUDevice, layout: GPUBindGroupLayout, id: number, physicsFacade: PhysicsFacade, blocks: number[][], cx: number, cy: number, cz: number, isPersistent: boolean = false) {
        this.id = id;
        this.physicsFacade = physicsFacade;
        this.isPersistent = isPersistent; 
        const volume = Debri.WIDTH * Debri.HEIGHT * Debri.DEPTH;
        this.blocks = new Uint8Array(volume);
        
        if (blocks.length > 0) {
            let minX = Infinity, minY = Infinity, minZ = Infinity;
            for (const [x, y, z] of blocks) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (z < minZ) minZ = z;
            }
            this.offsetX = cx - minX;
            this.offsetY = cy - minY;
            this.offsetZ = cz - minZ;
        }

        this.populateBlocks(blocks, cx, cy, cz);
        this.mesh = new VoxelMesh();
        this.modelBuffer = new WebGPUUniformBuffer(device, this.getModelMatrix() as Float32Array);
    }

    public getBlock(x: number, y: number, z: number): number {
        if (!this.inBounds(x, y, z)) return 0;
        return this.blocks[this.getIndex(x, y, z)];
    }

    public setBlock(x: number, y: number, z: number, id: number): void {
        if (!this.inBounds(x, y, z)) return;
        
        const oldId = this.blocks[this.getIndex(x, y, z)];
        if (oldId !== 0) {
            const oldDef = BlockRegistry.get(oldId);
            if (oldDef.lightEmissive) {
                const finalLocal = vec3.fromValues(
                    (x - this.offsetX) * Engine.voxelSize,
                    (y - this.offsetY) * Engine.voxelSize,
                    (z - this.offsetZ) * Engine.voxelSize
                );
                
                globalEventBus.emit('LIGHT_REMOVE', {
                    debriId: this.id,
                    position: { x: finalLocal[0], y: finalLocal[1], z: finalLocal[2] } 
                });
            }
        }

        const blockDef = BlockRegistry.get(id);
        if (blockDef.lightEmissive) {
            const finalLocal = vec3.fromValues(
                (x - this.offsetX) * Engine.voxelSize,
                (y - this.offsetY) * Engine.voxelSize,
                (z - this.offsetZ) * Engine.voxelSize
            );

            globalEventBus.emit('LIGHT_ADD', {
                position: { x: 0, y: 0, z: 0 },
                localPos: { x: finalLocal[0], y: finalLocal[1], z: finalLocal[2] },
                color: { r: blockDef.lightColor![0], g: blockDef.lightColor![1], b: blockDef.lightColor![2] },
                radius: blockDef.lightRadius!,
                debriId: this.id
            });
        }

        this.blocks[this.getIndex(x, y, z)] = id;
    }

    private populateBlocks(blocks: number[][], cx: number, cy: number, cz: number): void {
        if (blocks.length === 0) return;

        let minX = Infinity, minY = Infinity, minZ = Infinity;
        for (const [x, y, z] of blocks) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (z < minZ) minZ = z;
        }

        for (const [x, y, z, id] of blocks) {
            const gridX = x - minX;
            const gridY = y - minY;
            const gridZ = z - minZ;

            if (this.inBounds(gridX, gridY, gridZ)) {
                this.setBlock(gridX, gridY, gridZ, id);
            }
        }
    }
   
    public updateGraphics(device: GPUDevice, meshData: MeshData): void {
        this.mesh.updateGraphics(device, meshData);
    }

    public getModelMatrix(): mat4 {
        const modelMatrix = mat4.create();
        const transform = this.physicsFacade.transforms.get(this.id);
        
        if (transform) {
            mat4.fromRotationTranslation(modelMatrix, transform.rotation, transform.position);
        }

        mat4.translate(modelMatrix, modelMatrix, [
            -this.offsetX * Engine.voxelSize - (Engine.voxelSize / 2), 
            -this.offsetY * Engine.voxelSize - (Engine.voxelSize / 2), 
            -this.offsetZ * Engine.voxelSize - (Engine.voxelSize / 2)
        ]);

        return modelMatrix;
    }

    public deleteGraphics(): void {
        globalEventBus.emit('LIGHT_REMOVE', { debriId: this.id }); 
        this.mesh.deleteBuffers();
        this.modelBuffer.destroy();
    }

    public isSingleBlockMesh(): boolean {
        return this.mesh.isSingleBlockMesh();
    }

    public getUVOffsets(): Float32Array {
        return this.mesh.getUVOffset();
    }

    public draw(renderPass: GPURenderPassEncoder, instanceIndex: number): void {
        this.mesh.drawWithInstance(renderPass, instanceIndex);
    }
    
    private getIndex(x: number, y: number, z: number): number {
        return x + (y * Debri.WIDTH) + (z * Debri.WIDTH * Debri.HEIGHT);
    }

    private inBounds(x: number, y: number, z: number): boolean {
        return x >= 0 && x < Debri.WIDTH && y >= 0 && y < Debri.HEIGHT && z >= 0 && z < Debri.DEPTH;
    }
}