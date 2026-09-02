import { Engine } from "../core/Engine";
import type { World } from "../world/World";
import { ParticleSpawner } from "../particle/ParticleSpawner";
import { vec3, vec4 } from "gl-matrix";
import { globalEventBus } from "../core/EventBus";

export interface IBlockBehavior {
    onBreak?: (x: number, y: number, z: number, world: World) => void;
    onInteract?: (x: number, y: number, z: number, world: World) => void;
    onRandomTick?: (x: number, y: number, z: number, world: World) => void;
}

export const MagicOreBehavior: IBlockBehavior = {
    onRandomTick: (x, y, z, world) => {
        if (world.getBlock(x, y + 1, z) === 0) {
            const s = Engine.voxelSize;
            
       
            const px = (x * s) + (s / 2) + (Math.random() - 0.5) * (s * 0.8);
            const pz = (z * s) + (s / 2) + (Math.random() - 0.5) * (s * 0.8);
            const py = (y * s) + s; 

          
            ParticleSpawner.spawnAura(
                vec3.fromValues(px, py, pz), 
                vec4.fromValues(0.2, 1.0, 0.2, 1.0) 
            );
        }
    }
};

export const RadioactiveBehavior: IBlockBehavior = {
    onRandomTick: (x, y, z, world) => {
        if (world.getBlock(x, y + 1, z) === 0) {
            const s = Engine.voxelSize;
            ParticleSpawner.spawnAura(
                vec3.fromValues((x * s) + (s/2), (y * s) + s, (z * s) + (s/2)), 
                vec4.fromValues(0.8, 0.2, 1.0, 1.0) 
            );
        }
    }
};

export const SlimeBehavior: IBlockBehavior = {
    onRandomTick: (x, y, z, world) => {

        if (world.getBlock(x, y + 1, z) === 0) {
            const s = Engine.voxelSize;
            const px = (x * s) + (s / 2) + (Math.random() - 0.5) * (s * 0.8);
            const pz = (z * s) + (s / 2) + (Math.random() - 0.5) * (s * 0.8);
            const py = (y * s) + s; 

           
            globalEventBus.emit("SPAWN_PARTICLE", {
                position: [px, py, pz],
                velocity: [0, 0.015, 0],
                color: [0.3, 1.0, 0.3, 0.8], 
                lifetime: 150,
                size: 0.04,
                gravity: false
            });
        }
    }
};