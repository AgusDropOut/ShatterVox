
// this shit is for typescript stfo 
export type VBOTypedArray = Float32Array | Int8Array | Uint8Array | Uint16Array | Uint32Array;

export class VBO {
    public readonly ID: WebGLBuffer;
    private readonly gl: WebGL2RenderingContext;

   
    constructor(gl: WebGL2RenderingContext, data: VBOTypedArray, usage: number = gl.STATIC_DRAW) {
        this.gl = gl;
        const buffer = gl.createBuffer();
        
        if (!buffer) throw new Error("Failed to create VBO.");
        this.ID = buffer;

        this.bind();
        this.gl.bufferData(this.gl.ARRAY_BUFFER, data, usage);
    }

    
    public updateData(data: VBOTypedArray, usage: number = this.gl.STATIC_DRAW): void {
        this.bind();
        this.gl.bufferData(this.gl.ARRAY_BUFFER, data, usage);
    }

    public bind(): void {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.ID);
    }

    public unbind(): void {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    }

    public delete(): void {
        this.gl.deleteBuffer(this.ID);
    }
}