import { vec3, vec4 } from "gl-matrix";
import { globalEventBus } from "../core/EventBus";
import { ParticleSpawner } from "./ParticleSpawner";
import { Engine } from "../core/Engine";
import { BlockRegistry } from "../block/BlockRegistry";

export class ParticleEffectsController {
    private static generateBlockGradient(baseColor: [number, number, number]): vec4[] {
        const [r, g, b] = baseColor;
        const clamp = (v: number) => Math.max(0.0, Math.min(1.0, v));

        return [
            vec4.fromValues(clamp(r * 1.35), clamp(g * 1.35), clamp(b * 1.35), 1.0),
            vec4.fromValues(clamp(r * 0.90), clamp(g * 0.90), clamp(b * 0.90), 1.0),
            vec4.fromValues(clamp(r * 0.50), clamp(g * 0.50), clamp(b * 0.50), 0.0)
        ];
    }

    public static initialize(): void {
        globalEventBus.on("BLOCK_MINED_STATIC", (data) => {
            const size = Engine.voxelSize;
            const blockCenter = vec3.fromValues(
                (data.x * size) + (size / 2),
                (data.y * size) + (size / 2),
                (data.z * size) + (size / 2)
            );
            const surfaceNormal = vec3.fromValues(0, -1, 0); 
            
            const blockDef = BlockRegistry.get(data.blockType ?? 1);
            const colors = this.generateBlockGradient(blockDef.color);
            
            ParticleSpawner.spawnBlockMined(blockCenter, surfaceNormal, {
                count: 80,
                baseSpeed: 0.01, 
                speedVariance: 0.005,
                lifetime: [100, 220],
                size: [0.07, 0.1],
                gradient: {
                    colors,
                    continuous: false
                }
            });
        });

        globalEventBus.on("BOMB_DETONATED", (data) => {
            const explosionCenter = vec3.fromValues(data.x, data.y, data.z);
            
            ParticleSpawner.spawnExplosion(explosionCenter, {
                count: 600,
                baseSpeed: 0.55,
                speedVariance: 0.25,
                lifetime: [90, 200], 
                size: [0.06, 0.20],
                gradient: {
                    colors: [
                        vec4.fromValues(1.0, 1.0, 1.0, 1.0),
                        vec4.fromValues(1.0, 0.85, 0.1, 1.0),
                        vec4.fromValues(1.0, 0.25, 0.0, 0.9),
                        vec4.fromValues(0.2, 0.05, 0.0, 0.6),
                        vec4.fromValues(0.1, 0.10, 0.1, 0.0)
                    ],
                    continuous: true
                },
                vortex: true 
            });
        });
    }
}