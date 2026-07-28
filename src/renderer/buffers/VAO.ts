import { VBO } from "./VBO";

export class VAO {
    public readonly ID: WebGLVertexArrayObject;
    private readonly gl: WebGL2RenderingContext;

    /**
     * Creates a Vertex Array Object to store attribute state.
     * @param gl WebGL2 rendering context.
     */
    constructor(gl: WebGL2RenderingContext) {
        this.gl = gl;
        const vao = gl.createVertexArray();
        
        if (!vao) throw new Error("Failed to create VAO.");
        this.ID = vao;
    }

    public bind(): void {
        this.gl.bindVertexArray(this.ID);
    }

    public unbind(): void {
        this.gl.bindVertexArray(null);
    }

    /**
     * Links a VBO to a specific shader attribute layout location.
     * @param vbo The target Vertex Buffer Object.
     * @param layout Attribute location index (e.g., layout(location = 0)).
     * @param numComponents Number of components per vertex attribute.
     * @param type Data type (e.g., gl.FLOAT, gl.BYTE).
     * @param normalized Whether integer values should be normalized.
     * @param stride Byte offset between consecutive attributes.
     * @param offset Offset of the first component in bytes.
     */
    public linkAttrib(
        vbo: VBO, 
        layout: number, 
        numComponents: number, 
        type: number, 
        normalized: boolean, 
        stride: number, 
        offset: number
    ): void {
        this.bind();
        vbo.bind();
        
        this.gl.vertexAttribPointer(layout, numComponents, type, normalized, stride, offset);
        this.gl.enableVertexAttribArray(layout);
        
        vbo.unbind();
        this.unbind();
    }

    public delete(): void {
        this.gl.deleteVertexArray(this.ID);
    }
}