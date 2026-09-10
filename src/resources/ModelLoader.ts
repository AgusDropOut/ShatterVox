import type { WebGPURenderer } from "../renderer/WebGPURenderer";

export class ModelLoader {
    public static async loadAll(renderer: WebGPURenderer): Promise<void> {
        const loadPromises = [
            renderer.loadEntityAsset(
                "bomb", 
                "/assets/models/bomb.obj", 
                { "default": "/assets/textures/bomb.png" } 
            ),
            renderer.loadEntityAsset(
                "billboard", 
                "/assets/models/billboard.obj", 
                { "default": "/assets/textures/billboard.png" }
            ),
            renderer.loadEntityAsset(
                "billboard-1", 
                "/assets/models/billboard-1.obj", 
                { "default": "/assets/textures/billboard-1.png" }
            ),
            renderer.loadEntityAsset(
                "billboard-2", 
                "/assets/models/billboard-2.obj", 
                { "default": "/assets/textures/billboard-2.png" }
            ),
            renderer.loadEntityAsset(
                "billboard-3", 
                "/assets/models/billboard-3.obj", 
                { "default": "/assets/textures/billboard-3.png" }
            ),
            renderer.loadEntityAsset(
                "blackhole", 
                "/assets/models/blackhole_bomb.obj", 
                { 
                    "base": "/assets/textures/blackhole_base.png", 
                    "outline": "/assets/textures/blackhole_outline.png" 
                } 
            )
        ];

        await Promise.all(loadPromises);
        console.log("All model assets loaded successfully");
    }
}