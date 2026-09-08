import type { SoundManager } from "../audio/SoundManager";

export class AudioLoader {
    public static async loadAll(soundManager: SoundManager): Promise<void> {
        const loadPromises = [
            soundManager.loadSound("stone_collision", "/assets/sounds/stone_collision.ogg"),
            soundManager.loadSound("wood_collision", "/assets/sounds/wood_collision.ogg"),
            soundManager.loadSound("glass_collision", "/assets/sounds/glass_collision.ogg"),
            soundManager.loadSound("grass_collision", "/assets/sounds/grass_collision.ogg"),
            soundManager.loadSound("leaves_collision", "/assets/sounds/leaves_collision.ogg"),
            soundManager.loadSound("nade_explosion", "/assets/sounds/nade_explosion.ogg"),
            soundManager.loadSound("slime_squish", "/assets/sounds/slime_squish.ogg"),
            soundManager.loadSound("metal_collision", "/assets/sounds/metal_collision.ogg"),
            soundManager.loadSound("wood_crack-1", "/assets/sounds/wood_crack-1.ogg"),
            soundManager.loadSound("wood_crack-2", "/assets/sounds/wood_crack-2.ogg"),
            soundManager.loadSound("fire_chill", "/assets/sounds/fire_chill.ogg"),
            soundManager.loadImpulseResponse("/assets/sounds/cave_ir.ogg")
        ];

        await Promise.all(loadPromises);
        console.log("All audio assets loaded successfully");
    }
}