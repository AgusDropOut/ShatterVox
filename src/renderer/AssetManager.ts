// src/renderer/AssetManager.ts
import { Model } from "./Model";
import { ObjLoader } from "./ObjLoader";

export interface ModelAsset {
    mesh: Model;
    texture: WebGLTexture;
}

export class AssetManager {
    private static assets = new Map<string, ModelAsset>();

   
   public static async loadAsset(id: string, objUrl: string, textureUrl: string, gl: WebGL2RenderingContext): Promise<void> {
        try {
            const objResponse = await fetch(objUrl);
            const objText = await objResponse.text();
            
            if (objText.trim().startsWith("<!DOCTYPE html>")) {
                throw new Error(`Ruta incorrecta. Vite devolvió HTML en lugar de ${objUrl}`);
            }

            const parsedData = ObjLoader.parse(objText);
            if (parsedData.vertexCount === 0) {
                 throw new Error(`El archivo OBJ en ${objUrl} está vacío o mal formateado.`);
            }
            
            const mesh = new Model(gl);
            mesh.uploadData(parsedData);

            const texture = await this.loadTexture(textureUrl, gl);

            this.assets.set(id, { mesh, texture });
            console.log(`[AssetManager] Asset '${id}' loaded successfully.`);
        } catch (error) {
            console.error(`[AssetManager] Error loading asset '${id}':`, error);
        }
    }

    public static getAsset(id: string): ModelAsset | undefined {
        return this.assets.get(id);
    }

    private static loadTexture(url: string, gl: WebGL2RenderingContext): Promise<WebGLTexture> {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                const texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, texture);
                
            
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                
             
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                
                gl.bindTexture(gl.TEXTURE_2D, null);
                resolve(texture as WebGLTexture);
            };
            image.onerror = () => reject(new Error(`No se pudo cargar la imagen: ${url}`));
            image.src = url;
        });
    }
}