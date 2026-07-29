import { VAO } from "../renderer/buffers/VAO";
import { VBO } from "../renderer/buffers/VBO";
import type { Mesheable } from "../types/Mesheable";
import type { MeshData } from "./ChunkMesher"; 
import type {RigidBody} from "@dimforge/rapier3d-compat";
import { mat4 } from "gl-matrix";

export class Debri implements Mesheable {
    public static readonly WIDTH = 16;
    public static readonly HEIGHT = 16;
    public static readonly DEPTH = 16;

    public vao: VAO | null = null;
    public vertexCount: number = 0;

    private readonly gl: WebGL2RenderingContext;
    private readonly blocks: Uint8Array;
    
    private vboPositions: VBO | null = null;
    private vboNormals: VBO | null = null;
    private vboColors: VBO | null = null;

    private rigidBody: RigidBody;

    private offsetX: number = 0;
    private offsetY: number = 0;
    private offsetZ: number = 0;

    constructor(gl: WebGL2RenderingContext, rigidBody: RigidBody, blocks: number[][], cx: number, cy: number, cz: number) {
        this.gl = gl;
        this.rigidBody = rigidBody;
        const volume = Debri.WIDTH * Debri.HEIGHT * Debri.DEPTH;
        this.blocks = new Uint8Array(volume);
        this.populateBlocks(blocks, cx, cy, cz);
    }

    public getBlock(x: number, y: number, z: number): number {
        if (!this.inBounds(x, y, z)) return 0;
        return this.blocks[this.getIndex(x, y, z)];
    }

    public setBlock(x: number, y: number, z: number, id: number): void {
        if (!this.inBounds(x, y, z)) return;
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

      
        

        this.offsetX = cx - minX;
        this.offsetY = cy - minY;
        this.offsetZ = cz - minZ;


        for (const [x, y, z] of blocks) {
            const gridX = x - minX;
            const gridY = y - minY;
            const gridZ = z - minZ;

            if (this.inBounds(gridX, gridY, gridZ)) {
                this.setBlock(gridX, gridY, gridZ, 1);
            }
        }
    }
   
    public updateGraphics(meshData: MeshData): void {
        if (meshData.vertexCount === 0) {
            this.deleteGraphics();
            return;
        }

        if (!this.vao) {
            this.vboPositions = new VBO(this.gl, meshData.positions, this.gl.DYNAMIC_DRAW);
            this.vboNormals = new VBO(this.gl, meshData.normals, this.gl.DYNAMIC_DRAW);
            this.vboColors = new VBO(this.gl, meshData.colors, this.gl.DYNAMIC_DRAW);

            this.vao = new VAO(this.gl);
            this.vao.linkAttrib(this.vboPositions, 0, 3, this.gl.FLOAT, false, 0, 0);
            this.vao.linkAttrib(this.vboNormals, 1, 3, this.gl.FLOAT, false, 0, 0);
            this.vao.linkAttrib(this.vboColors, 2, 3, this.gl.FLOAT, false, 0, 0);
        } else {
            this.vboPositions!.updateData(meshData.positions, this.gl.DYNAMIC_DRAW);
            this.vboNormals!.updateData(meshData.normals, this.gl.DYNAMIC_DRAW);
            this.vboColors!.updateData(meshData.colors, this.gl.DYNAMIC_DRAW);
        }
        
        this.vertexCount = meshData.vertexCount;
    }

    public getModelMatrix(): mat4 {
        const translation = this.rigidBody.translation();
        const rotation = this.rigidBody.rotation();
        const modelMatrix = mat4.create();
        mat4.fromRotationTranslation(modelMatrix, [rotation.x, rotation.y, rotation.z, rotation.w], [translation.x, translation.y, translation.z]);

        mat4.translate(modelMatrix, modelMatrix, [-this.offsetX, -this.offsetY, -this.offsetZ]);

        return modelMatrix;
    }

    public deleteGraphics(): void {
        if (this.vao) this.vao.delete();
        if (this.vboPositions) this.vboPositions.delete();
        if (this.vboNormals) this.vboNormals.delete();
        if (this.vboColors) this.vboColors.delete();
        
        this.vao = null;
        this.vboPositions = null;
        this.vboNormals = null;
        this.vboColors = null;
        this.vertexCount = 0;
    }

    private getIndex(x: number, y: number, z: number): number {
        return x + (y * Debri.WIDTH) + (z * Debri.WIDTH * Debri.HEIGHT);
    }

    private inBounds(x: number, y: number, z: number): boolean {
        return x >= 0 && x < Debri.WIDTH && 
               y >= 0 && y < Debri.HEIGHT && 
               z >= 0 && z < Debri.DEPTH;
    }
}