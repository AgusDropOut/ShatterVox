import { VAO } from "../renderer/buffers/VAO";
import { VBO } from "../renderer/buffers/VBO";
import type { Mesheable } from "../types/Mesheable";
import type { MeshData } from "./ChunkMesher"; 
import { mat4 } from "gl-matrix";

export class Chunk implements Mesheable {
    public static readonly WIDTH = 32;
    public static readonly HEIGHT = 32;
    public static readonly DEPTH = 32;

    public vao: VAO | null = null;
    public vertexCount: number = 0;

    public readonly chunkX: number;
    public readonly chunkY: number;
    public readonly chunkZ: number;

    private readonly gl: WebGL2RenderingContext;
    private readonly blocks: Uint8Array;
    
    private vboPositions: VBO | null = null;
    private vboNormals: VBO | null = null;
    private vboColors: VBO | null = null;
    private vboUvs: VBO | null = null;

    constructor(gl: WebGL2RenderingContext, chunkX: number, chunkY: number, chunkZ: number) {
        this.gl = gl;
        this.chunkX = chunkX;
        this.chunkY = chunkY;
        this.chunkZ = chunkZ;
        const volume = Chunk.WIDTH * Chunk.HEIGHT * Chunk.DEPTH;
        this.blocks = new Uint8Array(volume);
    }

    public getBlock(x: number, y: number, z: number): number {
        if (!this.inBounds(x, y, z)) return 0;
        return this.blocks[this.getIndex(x, y, z)];
    }

    public setBlock(x: number, y: number, z: number, id: number): void {
        if (!this.inBounds(x, y, z)) return;
        this.blocks[this.getIndex(x, y, z)] = id;
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
            this.vboUvs = new VBO(this.gl, meshData.uvs, this.gl.DYNAMIC_DRAW);

            this.vao = new VAO(this.gl);
            this.vao.linkAttrib(this.vboPositions, 0, 3, this.gl.FLOAT, false, 0, 0);
            this.vao.linkAttrib(this.vboNormals, 1, 3, this.gl.FLOAT, false, 0, 0);
            this.vao.linkAttrib(this.vboColors, 2, 3, this.gl.FLOAT, false, 0, 0);
            this.vao.linkAttrib(this.vboUvs, 3, 2, this.gl.FLOAT, false, 0, 0);
        } else {
            this.vboPositions!.updateData(meshData.positions, this.gl.DYNAMIC_DRAW);
            this.vboNormals!.updateData(meshData.normals, this.gl.DYNAMIC_DRAW);
            this.vboColors!.updateData(meshData.colors, this.gl.DYNAMIC_DRAW);
            this.vboUvs!.updateData(meshData.uvs, this.gl.DYNAMIC_DRAW);
        }
        
        this.vertexCount = meshData.vertexCount;
    }

    public getModelMatrix(): mat4 {
        const modelMatrix = mat4.create();
        mat4.translate(modelMatrix, modelMatrix, [
            this.chunkX * Chunk.WIDTH,
            this.chunkY * Chunk.HEIGHT,
            this.chunkZ * Chunk.DEPTH
        ]);
        return modelMatrix;
    }

    public deleteGraphics(): void {
        if (this.vao) this.vao.delete();
        if (this.vboPositions) this.vboPositions.delete();
        if (this.vboNormals) this.vboNormals.delete();
        if (this.vboColors) this.vboColors.delete();
        if (this.vboUvs) this.vboUvs.delete();
        
        this.vao = null;
        this.vboPositions = null;
        this.vboNormals = null;
        this.vboColors = null;
        this.vboUvs = null;
        this.vertexCount = 0;
    }

    private getIndex(x: number, y: number, z: number): number {
        return x + (y * Chunk.WIDTH) + (z * Chunk.WIDTH * Chunk.HEIGHT);
    }

    private inBounds(x: number, y: number, z: number): boolean {
        return x >= 0 && x < Chunk.WIDTH && 
               y >= 0 && y < Chunk.HEIGHT && 
               z >= 0 && z < Chunk.DEPTH;
    }
}