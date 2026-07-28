export class Shader {
    public readonly ID: WebGLProgram;
    private readonly gl: WebGL2RenderingContext;
    private readonly uniformLocationCache: Map<string, WebGLUniformLocation | null>;

    /**
     * Compiles and links a WebGL shader program.
     * @param gl WebGL2 rendering context.
     * @param vertexSource GLSL source code for the vertex shader.
     * @param fragmentSource GLSL source code for the fragment shader.
     */
    constructor(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string) {
        this.gl = gl;
        this.uniformLocationCache = new Map();

        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

        const program = gl.createProgram();
        if (!program) throw new Error("Failed to create shader program.");
        this.ID = program;

        gl.attachShader(this.ID, vertexShader);
        gl.attachShader(this.ID, fragmentShader);
        gl.linkProgram(this.ID);

        if (!gl.getProgramParameter(this.ID, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(this.ID);
            gl.deleteProgram(this.ID);
            throw new Error(`Shader linking failed: ${info}`);
        }

        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
    }

    public bind(): void {
        this.gl.useProgram(this.ID);
    }

    public unbind(): void {
        this.gl.useProgram(null);
    }

    public delete(): void {
        this.gl.deleteProgram(this.ID);
    }

    public setInt(name: string, value: number): void {
        const location = this.getUniformLocation(name);
        if (location !== null) this.gl.uniform1i(location, value);
    }

    public setFloat(name: string, value: number): void {
        const location = this.getUniformLocation(name);
        if (location !== null) this.gl.uniform1f(location, value);
    }

    public setVec2(name: string, x: number, y: number): void {
        const location = this.getUniformLocation(name);
        if (location !== null) this.gl.uniform2f(location, x, y);
    }

    public setVec3(name: string, x: number, y: number, z: number): void {
        const location = this.getUniformLocation(name);
        if (location !== null) this.gl.uniform3f(location, x, y, z);
    }

  
    public setMat4(name: string, matrix: Float32List): void {
        const location = this.getUniformLocation(name);
        if (location !== null) this.gl.uniformMatrix4fv(location, false, matrix);
    }

    private getUniformLocation(name: string): WebGLUniformLocation | null {
        if (this.uniformLocationCache.has(name)) {
            return this.uniformLocationCache.get(name)!;
        }

        const location = this.gl.getUniformLocation(this.ID, name);
        this.uniformLocationCache.set(name, location);

        if (location === null) {
            console.warn(`Warning: Uniform '${name}' doesn't exist or is not used.`);
        }

        return location;
    }

    private compileShader(type: number, source: string): WebGLShader {
        const shader = this.gl.createShader(type);
        if (!shader) throw new Error("Failed to create shader instance.");

        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const info = this.gl.getShaderInfoLog(shader);
            const typeName = type === this.gl.VERTEX_SHADER ? "VERTEX" : "FRAGMENT";
            this.gl.deleteShader(shader);
            throw new Error(`ERROR::SHADER::${typeName}::COMPILATION_FAILED\n${info}`);
        }

        return shader;
    }
}