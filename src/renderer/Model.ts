import { VAO } from "./buffers/VAO";
import { VBO } from "./buffers/VBO";

export class Model {
    public vao: VAO | null = null; 
    public vertexCount: number = 0;
    
    private gl: WebGL2RenderingContext;
    private positionVBO: VBO | null = null;
    private uvVBO: VBO | null = null;
    private normalVBO: VBO | null = null;

    constructor(gl: WebGL2RenderingContext) {
        this.gl = gl;
    }

    public uploadData(data: { positions: Float32Array, uvs: Float32Array, normals: Float32Array, vertexCount: number }): void {
        const gl = this.gl;
        this.vertexCount = data.vertexCount;

        if (!this.vao) {
            this.vao = new VAO(gl);
            
            this.positionVBO = new VBO(gl, data.positions);
            this.uvVBO = new VBO(gl, data.uvs);
            this.normalVBO = new VBO(gl, data.normals);

            this.vao.linkAttrib(this.positionVBO, 0, 3, gl.FLOAT, false, 0, 0);
            this.vao.linkAttrib(this.uvVBO, 1, 2, gl.FLOAT, false, 0, 0);
            this.vao.linkAttrib(this.normalVBO, 2, 3, gl.FLOAT, false, 0, 0);
        } else {
            this.positionVBO!.updateData(data.positions);
            this.uvVBO!.updateData(data.uvs);
            this.normalVBO!.updateData(data.normals);
        }
    }

    public deleteGraphics(): void {
        if (this.vao) this.vao.delete();
        if (this.positionVBO) this.positionVBO.delete();
        if (this.uvVBO) this.uvVBO.delete();
        if (this.normalVBO) this.normalVBO.delete();

        this.vao = null;
        this.positionVBO = null;
        this.uvVBO = null;
        this.normalVBO = null;
        this.vertexCount = 0;
    }
}