import type { WebGPURenderer } from "../renderer/WebGPURenderer";

export class ModelLoader {
    public static async loadAll(renderer: WebGPURenderer): Promise<void> {
        const loadPromises = [
            renderer.loadEntityAsset(
                "bomb", 
                "/assets/models/bomb.obj", 
                ["/assets/textures/bomb.png"]
            ),
            renderer.loadEntityAsset(
                "billboard", 
                "/assets/models/billboard.obj", 
                ["/assets/textures/billboard.png"]
            ),
            renderer.loadEntityAsset(
                "billboard-1", 
                "/assets/models/billboard-1.obj", 
                ["/assets/textures/billboard-1.png"]
            ),
            renderer.loadEntityAsset(
                "billboard-2", 
                "/assets/models/billboard-2.obj", 
                ["/assets/textures/billboard-2.png"]
            ),
            renderer.loadEntityAsset(
                "billboard-3", 
                "/assets/models/billboard-3.obj", 
                ["/assets/textures/billboard-3.png"]
            ),
            renderer.loadEntityAsset(
                "blackhole", 
                "/assets/models/blackhole_bomb.obj", 
                [
                    "/assets/textures/blackhole_base.png", 
                    "/assets/textures/blackhole_outline.png" 
                ]
            ),
            renderer.loadEntityAsset(
                "magic_crystal", 
                "/assets/models/magic_crystal.obj", 
                [
                    "/assets/textures/magic_crystal_base.png", 
                    "/assets/textures/magic_crystal_outline.png" 
                ]
            )
        ];

        await Promise.all(loadPromises);
        console.log("All model assets loaded successfully");
    }
}