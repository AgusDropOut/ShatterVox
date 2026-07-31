export class Texture {
    public readonly gl: WebGL2RenderingContext;
    public readonly textureId: WebGLTexture;

    constructor(gl: WebGL2RenderingContext, imageSrc: string) {
        this.gl = gl;
        
        const tex = this.gl.createTexture();
        if (!tex) throw new Error("No se pudo crear la textura WebGL.");
        this.textureId = tex;

        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textureId);


        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 255, 255]));

        const image = new Image();
        image.src = imageSrc;
        
        image.onload = () => {
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textureId);
            
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.bindTexture(this.gl.TEXTURE_2D, null);

        };
    }

    public bind(slot: number = 0): void {
        this.gl.activeTexture(this.gl.TEXTURE0 + slot);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textureId);
    }

    public unbind(): void {
        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    }

    public delete(): void {
        this.gl.deleteTexture(this.textureId);
    }
}