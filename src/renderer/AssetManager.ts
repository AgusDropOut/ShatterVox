import { Model } from "./Model";
import { ObjLoader } from "./ObjLoader";
import { WebGPUTexture } from "./WebGPUTexture";

export interface ModelAsset {
    mesh: Model;
    materialBindGroups: Map<string, GPUBindGroup>; 
}

export class AssetManager {
    private static assets = new Map<string, ModelAsset>();

    public static async loadAsset(
        id: string, 
        objUrl: string, 
        textureUrls: Record<string, string>, 
        device: GPUDevice, 
        materialLayout: GPUBindGroupLayout
    ): Promise<void> {
        try {
            const objResponse = await fetch(objUrl);
            const objText = await objResponse.text();
            
            const parsedData = ObjLoader.parse(objText);
            
            const mesh = new Model(device);
            mesh.uploadData(parsedData);

            const materialBindGroups = new Map<string, GPUBindGroup>();

            const texturePromises = Object.entries(textureUrls).map(async ([matName, url]) => {
                const texture = await WebGPUTexture.create(device, url);
                const bindGroup = device.createBindGroup({
                    layout: materialLayout,
                    entries: [
                        { binding: 0, resource: texture.sampler },
                        { binding: 1, resource: texture.view }
                    ]
                });
                materialBindGroups.set(matName, bindGroup);
            });

            await Promise.all(texturePromises);

            this.assets.set(id, { mesh, materialBindGroups });
        } catch (error) {
            console.error(`Error loading asset '${id}':`, error);
        }
    }

    public static getAsset(id: string): ModelAsset | undefined {
        return this.assets.get(id);
    }
}