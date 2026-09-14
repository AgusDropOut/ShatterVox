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

export const FireBehavior: IBlockBehavior = {
    onRandomTick: (x, y, z, world) => {
        const s = Engine.voxelSize;
        const cx = (x * s) + (s / 2);
        const cy = (y * s) + (s / 2);
        const cz = (z * s) + (s / 2);

        const particleCount = 4 + Math.floor(Math.random() * 4);

        for (let i = 0; i < particleCount; i++) {
            const isSmoke = Math.random() > 0.6;
            
            const px = cx + (Math.random() - 0.5) * (s * 0.9);
            const py = cy + (s / 2) + (Math.random() * 0.05); 
            const pz = cz + (Math.random() - 0.5) * (s * 0.9);
            
            const vy = 0.005 + Math.random() * 0.008;
            const vx = 0.0;
            const vz = 0.0;

            const color = isSmoke 
                ? [0.15, 0.15, 0.15, 0.4] 
                : [1.0, 0.4 + Math.random() * 0.4, 0.0, 0.9]; 

            globalEventBus.emit("SPAWN_PARTICLE", {
                position: [px, py, pz],
                velocity: [vx, vy, vz],
                color: color as [number, number, number, number],
                lifetime: isSmoke ? 160 : 90,
                size: isSmoke ? 0.12 : 0.08,
                gravity: false
            });
        }

        if (Math.random() < 0.6) { 
            globalEventBus.emit("PLAY_SPATIAL_SOUND", { 
                id: "fire_chill", 
                position: [cx, cy, cz], 
                volume: 0.5, 
                pitch: 0.9 + Math.random() * 0.2 
            });
        }

        if (Math.random() < 0.1) {
            const crackSound = Math.random() > 0.5 ? "wood_crack-1" : "wood_crack-2";
            globalEventBus.emit("PLAY_SPATIAL_SOUND", { 
                id: crackSound, 
                position: [cx, cy, cz], 
                volume: 0.8, 
                pitch: 0.8 + Math.random() * 0.4 
            });
        }
    }
};

export const AmbarBehavior: IBlockBehavior = {
    onRandomTick: (x, y, z, world) => {
        const s = Engine.voxelSize;
        const px = (x * s) + (s / 2);
        const py = (y * s) + (s / 2);
        const pz = (z * s) + (s / 2);

        if (world.getBlock(x, y + 1, z) === 0 || world.getBlock(x, y - 1, z) === 0 || world.getBlock(x + 1, y, z) === 0 || world.getBlock(x - 1, y, z) === 0) {
            
            if (Math.random() > 0.5) {
                globalEventBus.emit("SPAWN_PARTICLE", {
                    position: [px + (Math.random() - 0.5) * s, py + (Math.random() - 0.5) * s, pz + (Math.random() - 0.5) * s],
                    velocity: [0, 0.005 + Math.random() * 0.01, 0],
                    color: [1.0, 0.8, 0.2, 0.8], 
                    lifetime: 120,
                    size: 0.05,
                    gravity: false
                });
            }

            if (Math.random() < 0.35) { 
                world.setBlock(x, y, z, 0);
                world.setChunkDirtyAt(x, y, z);
                
                ParticleSpawner.spawnAura(vec3.fromValues(px, py, pz), vec4.fromValues(1.0, 0.8, 0.2, 1.0), 3);
            }
        }
    }
};

export const LeavesWithFlowersBehavior: IBlockBehavior = {
    onRandomTick: (x, y, z, world) => {
        if (world.getBlock(x, y - 1, z) === 0) {
            const s = Engine.voxelSize;
            
            const spawnCount = 2 + Math.floor(Math.random() * 3);

            for (let i = 0; i < spawnCount; i++) {
                const px = (x * s) + (Math.random() * s);
                const py = (y * s); 
                const pz = (z * s) + (Math.random() * s);

                const vy = -0.0015 - (Math.random() * 0.001);
                
                const time = Date.now() * 0.001 + i;
                const windX = Math.sin(time + x) * 0.0003; 
                const windZ = Math.cos(time + z) * 0.0003;

                const isYolk = Math.random() > 0.8;
                const color = isYolk 
                    ? [1.0, 0.75, 0.15, 0.9] 
                    : [0.95, 0.95, 0.95, 0.8]; 

                globalEventBus.emit("SPAWN_PARTICLE", {
                    position: [px, py, pz],
                    velocity: [windX, vy, windZ],
                    color: color as [number, number, number, number],
                    lifetime: 600 + Math.random() * 150, 
                    size: isYolk ? 0.12 : 0.09, 
                    gravity: false 
                });
            }

            if (Math.random() < 0.08) {
                globalEventBus.emit("SPAWN_PARTICLE", {
                    position: [(x * s) + (Math.random() * s), (y * s) + (s / 2), (z * s) + (Math.random() * s)],
                    velocity: [0, 0.005 + Math.random() * 0.01, 0],
                    color: [1.0, 0.9, 0.5, 0.9], 
                    lifetime: 180,
                    size: 0.02,
                    gravity: false
                });
            }
        }
    },
    onInteract: (x, y, z, world) => {
        const s = Engine.voxelSize;
        const cx = (x * s) + (s / 2);
        const cy = (y * s);
        const cz = (z * s) + (s / 2);

        for (let i = 0; i < 20; i++) {
            const isYolk = Math.random() > 0.6;
            const color = isYolk ? [1.0, 0.75, 0.15, 0.9] : [0.95, 0.95, 0.95, 0.9];
            
            globalEventBus.emit("SPAWN_PARTICLE", {
                position: [
                    cx + (Math.random() - 0.5) * s * 1.5, 
                    cy + (Math.random() * s), 
                    cz + (Math.random() - 0.5) * s * 1.5
                ],
                velocity: [
                    (Math.random() - 0.5) * 0.02, 
                    -0.02 - (Math.random() * 0.04), 
                    (Math.random() - 0.5) * 0.02
                ],
                color: color as [number, number, number, number],
                lifetime: 150 + Math.random() * 100,
                size: 0.04 + Math.random() * 0.02,
                gravity: false
            });
        }
        
        globalEventBus.emit("PLAY_SPATIAL_SOUND", { 
            id: "leaves_collision", 
            position: [cx, cy, cz], 
            volume: 0.4, 
            pitch: 0.9 + Math.random() * 0.2 
        });
    }
};

export const AtmosphericDustBehavior: IBlockBehavior = {
    onRandomTick: (x, y, z, world) => {
        const s = Engine.voxelSize;
        const count = 3 + Math.floor(Math.random() * 4);

        for (let i = 0; i < count; i++) {
            const px = (x * s) + (Math.random() * s);
            const py = (y * s) + (Math.random() * s);
            const pz = (z * s) + (Math.random() * s);

            const vx = (Math.random() - 0.5) * 0.0015;
            const vy = (Math.random() - 0.5) * 0.0015;
            const vz = (Math.random() - 0.5) * 0.0015;

            globalEventBus.emit("SPAWN_PARTICLE", {
                position: [px, py, pz],
                velocity: [vx, vy, vz],
                color: [1.0, 0.95, 0.8, 0.3],
                lifetime: 400 + Math.random() * 400,
                size: 0.025 + Math.random() * 0.02,
                gravity: false
            });
        }
    }
};

export const MysticSporeBehavior: IBlockBehavior = {
    onRandomTick: (x, y, z, world) => {
        const s = Engine.voxelSize;
        const count = 6 + Math.floor(Math.random() * 8);

        for (let i = 0; i < count; i++) {
            const px = (x * s) + (Math.random() * s);
            const py = (y * s) + (Math.random() * s);
            const pz = (z * s) + (Math.random() * s);

            const vx = (Math.random() - 0.5) * 0.002;
            const vy = -0.001 - Math.random() * 0.0015;
            const vz = (Math.random() - 0.5) * 0.002;

            globalEventBus.emit("SPAWN_PARTICLE", {
                position: [px, py, pz],
                velocity: [vx, vy, vz],
                color: [1.0, 0.85, 0.3, 0.6],
                lifetime: 1000 + Math.random() * 600,
                size: 0.02 + Math.random() * 0.03,
                gravity: false
            });
        }
    }
};

export const RedLeavesBehavior: IBlockBehavior = {
    onRandomTick: (x, y, z, world) => {
        if (world.getBlock(x, y - 1, z) === 0) {
            if (Math.random() > 0.3) return;

            const s = Engine.voxelSize;
            const px = (x * s) + (Math.random() * s);
            const py = (y * s); 
            const pz = (z * s) + (Math.random() * s);

            const vy = -0.0015 - (Math.random() * 0.001);
            const time = Date.now() * 0.001;
            const windX = Math.sin(time + x) * 0.0003; 
            const windZ = Math.cos(time + z) * 0.0003;

            globalEventBus.emit("SPAWN_PARTICLE", {
                position: [px, py, pz],
                velocity: [windX, vy, windZ],
                color: [0.65, 0.15, 0.15, 0.9],
                lifetime: 400 + Math.random() * 150, 
                size: 0.07, 
                gravity: false 
            });
        }
    }
};

export const RedLeavesWithFlowersBehavior: IBlockBehavior = {
    onRandomTick: (x, y, z, world) => {
        if (world.getBlock(x, y - 1, z) === 0) {
            const s = Engine.voxelSize;
            const spawnCount = 2 + Math.floor(Math.random() * 3);

            for (let i = 0; i < spawnCount; i++) {
                const px = (x * s) + (Math.random() * s);
                const py = (y * s); 
                const pz = (z * s) + (Math.random() * s);

                const vy = -0.0015 - (Math.random() * 0.001);
                
                const time = Date.now() * 0.001 + i;
                const windX = Math.sin(time + x) * 0.0003; 
                const windZ = Math.cos(time + z) * 0.0003;

                const isMagenta = Math.random() > 0.7;
                const color = isMagenta 
                    ? [1.0, 0.2, 0.4, 0.9] 
                    : [0.85, 0.1, 0.15, 0.8]; 

                globalEventBus.emit("SPAWN_PARTICLE", {
                    position: [px, py, pz],
                    velocity: [windX, vy, windZ],
                    color: color as [number, number, number, number],
                    lifetime: 600 + Math.random() * 150, 
                    size: isMagenta ? 0.11 : 0.08, 
                    gravity: false 
                });
            }

            if (Math.random() < 0.08) {
                globalEventBus.emit("SPAWN_PARTICLE", {
                    position: [(x * s) + (Math.random() * s), (y * s) + (s / 2), (z * s) + (Math.random() * s)],
                    velocity: [0, 0.005 + Math.random() * 0.01, 0],
                    color: [1.0, 0.4, 0.6, 0.9], 
                    lifetime: 180,
                    size: 0.025,
                    gravity: false
                });
            }
        }
    },
    onInteract: (x, y, z, world) => {
        const s = Engine.voxelSize;
        const cx = (x * s) + (s / 2);
        const cy = (y * s);
        const cz = (z * s) + (s / 2);

        for (let i = 0; i < 20; i++) {
            const isMagenta = Math.random() > 0.6;
            const color = isMagenta ? [1.0, 0.2, 0.4, 0.9] : [0.85, 0.1, 0.15, 0.9];
            
            globalEventBus.emit("SPAWN_PARTICLE", {
                position: [
                    cx + (Math.random() - 0.5) * s * 1.5, 
                    cy + (Math.random() * s), 
                    cz + (Math.random() - 0.5) * s * 1.5
                ],
                velocity: [
                    (Math.random() - 0.5) * 0.02, 
                    -0.02 - (Math.random() * 0.04), 
                    (Math.random() - 0.5) * 0.02
                ],
                color: color as [number, number, number, number],
                lifetime: 150 + Math.random() * 100,
                size: 0.04 + Math.random() * 0.02,
                gravity: false
            });
        }
        
        globalEventBus.emit("PLAY_SPATIAL_SOUND", { 
            id: "leaves_collision", 
            position: [cx, cy, cz], 
            volume: 0.4, 
            pitch: 0.9 + Math.random() * 0.2 
        });
    }
};

export const FireflySpawnerBehavior: IBlockBehavior = {
    onRandomTick: (x, y, z, world) => {
        if (Math.random() > 0.2) return;

        const s = Engine.voxelSize;
        const px = (x * s) + (Math.random() * s);
        const py = (y * s) + (Math.random() * s);
        const pz = (z * s) + (Math.random() * s);

        const time = Date.now() * 0.001;
        const vx = Math.sin(time + px) * 0.004;
        const vy = (Math.random() - 0.4) * 0.003;
        const vz = Math.cos(time + pz) * 0.004;

        globalEventBus.emit("SPAWN_PARTICLE", {
            position: [px, py, pz],
            velocity: [vx, vy, vz],
            color: [0.1, 1.0, 0.5, 1.0], 
            lifetime: 800 + Math.random() * 400,
            size: 0.04 + Math.random() * 0.03,
            gravity: false
        });
    }
};