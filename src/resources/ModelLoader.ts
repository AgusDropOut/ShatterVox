import type { WebGPURenderer } from "../renderer/WebGPURenderer";

export class ModelLoader {
    public static async loadAll(renderer: WebGPURenderer): Promise<void> {
        const loadPromises = [
            renderer.loadEntityAsset(
                "bomb", 
                "/assets/models/bomb.obj", 
                "/assets/textures/bomb.png"
            ),
            renderer.loadEntityAsset(
                "billboard", 
                "/assets/models/billboard.obj", 
                "/assets/textures/billboard.png"
            ),
            renderer.loadEntityAsset(
                "billboard-1", 
                "/assets/models/billboard-1.obj", 
                "/assets/textures/billboard-1.png"
            )
        ];

        await Promise.all(loadPromises);
        console.log("All model assets loaded successfully");
    }
}