import { Model } from "./Model";
import { ObjLoader } from "./ObjLoader";
import { WebGPUTexture } from "./WebGPUTexture";

export interface ModelAsset {
    mesh: Model;
    texture: WebGPUTexture;
    materialBindGroup: GPUBindGroup; 
}

export class AssetManager {
    private static assets = new Map<string, ModelAsset>();

    public static async loadAsset(
        id: string, 
        objUrl: string, 
        textureUrl: string, 
        device: GPUDevice, 
        materialLayout: GPUBindGroupLayout
    ): Promise<void> {
        try {
            const objResponse = await fetch(objUrl);
            const objText = await objResponse.text();
            
            const parsedData = ObjLoader.parse(objText);
            
            const mesh = new Model(device);
            mesh.uploadData(parsedData);

            const texture = await WebGPUTexture.create(device, textureUrl);

            const materialBindGroup = device.createBindGroup({
                layout: materialLayout,
                entries: [
                    { binding: 0, resource: texture.sampler },
                    { binding: 1, resource: texture.view }
                ]
            });

            this.assets.set(id, { mesh, texture, materialBindGroup });
        } catch (error) {
            console.error(`Error loading asset '${id}':`, error);
        }
    }

    public static getAsset(id: string): ModelAsset | undefined {
        return this.assets.get(id);
    }
}