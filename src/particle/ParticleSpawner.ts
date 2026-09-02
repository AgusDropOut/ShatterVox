import { vec3, vec4 } from "gl-matrix";
import { globalEventBus } from "../core/EventBus";

export interface Gradient {
    colors: vec4[];
    continuous: boolean;
}

export interface SpawnerConfig {
    count: number;
    baseSpeed: number;
    speedVariance: number;
    lifetime: [number, number];
    size: [number, number];
    gradient: Gradient;
    vortex?: boolean; 
}

export class ParticleSpawner {
    private static getRandom(min: number, max: number): number {
        return Math.random() * (max - min) + min;
    }

    private static getColor(gradient: Gradient): vec4 {
        const numColors = gradient.colors.length;
        if (numColors === 1) return vec4.clone(gradient.colors[0]);

        const t = Math.random();
        if (!gradient.continuous) {
            const index = Math.floor(t * numColors);
            return vec4.clone(gradient.colors[index]);
        }

        const scaledT = t * (numColors - 1);
        const index = Math.floor(scaledT);
        const remainder = scaledT - index;
        
        const outColor = vec4.create();
        vec4.lerp(outColor, gradient.colors[index], gradient.colors[Math.min(index + 1, numColors - 1)], remainder);
        return outColor;
    }

    private static randomSphereDir(): vec3 {
        const theta = Math.random() * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * Math.random() - 1.0);
        const out = vec3.create();
        out[0] = Math.sin(phi) * Math.cos(theta);
        out[1] = Math.sin(phi) * Math.sin(theta);
        out[2] = Math.cos(phi);
        return out;
    }

    private static randomHemisphereDir(normal: vec3): vec3 {
        const dir = this.randomSphereDir();
        if (vec3.dot(dir, normal) < 0.0) {
            vec3.scale(dir, dir, -1.0);
        }
        return dir;
    }

    public static spawnExplosion(center: vec3, config: SpawnerConfig): void {
        for (let i = 0; i < config.count; i++) {
            const dir = this.randomSphereDir();
            
            if (config.vortex) {
                const upVector = vec3.fromValues(0, 1, 0);
                const tangent = vec3.create();
                vec3.cross(tangent, dir, upVector);
                vec3.add(dir, dir, tangent);
                vec3.normalize(dir, dir);
            }

            const speed = config.baseSpeed + this.getRandom(-config.speedVariance, config.speedVariance);
            const vel = vec3.create();
            vec3.scale(vel, dir, Math.max(0, speed));

            globalEventBus.emit("SPAWN_PARTICLE", {
                position: vec3.clone(center),
                velocity: vel,
                color: this.getColor(config.gradient),
                lifetime: this.getRandom(config.lifetime[0], config.lifetime[1]),
                size: this.getRandom(config.size[0], config.size[1]),
                gravity: true
            });
        }
    }

    public static spawnBlockMined(center: vec3, normal: vec3, config: SpawnerConfig): void {
        for (let i = 0; i < config.count; i++) {
            const dir = this.randomHemisphereDir(normal);
            const speed = config.baseSpeed + this.getRandom(-config.speedVariance, config.speedVariance);
            const vel = vec3.create();
            vec3.scale(vel, dir, Math.max(0, speed));

            globalEventBus.emit("SPAWN_PARTICLE", {
                position: vec3.clone(center),
                velocity: vel,
                color: this.getColor(config.gradient),
                lifetime: this.getRandom(config.lifetime[0], config.lifetime[1]),
                size: this.getRandom(config.size[0], config.size[1]),
                gravity: true
            });
        }
    }

    public static spawnAura(position: vec3, color: vec4, count: number = 5): void {
        for (let i = 0; i < count; i++) {

            const jitteredPos = vec3.fromValues(
                position[0] + this.getRandom(-0.08, 0.08),
                position[1] + this.getRandom(0.0, 0.05),
                position[2] + this.getRandom(-0.08, 0.08)
            );

          
            const vel = vec3.fromValues(
                this.getRandom(-0.005, 0.005), 
                this.getRandom(0.002, 0.012),
                this.getRandom(-0.005, 0.005)
            );

            globalEventBus.emit("SPAWN_PARTICLE", {
                position: jitteredPos,
                velocity: vel,
                color: vec4.clone(color),
                lifetime: this.getRandom(240, 600), 
                size: this.getRandom(0.04, 0.12),   
                gravity: false 
            });
        }
    }

   
    public static spawnDirectional(position: vec3, direction: vec3, color: vec4, speed: number, count: number = 3): void {
        for (let i = 0; i < count; i++) {
            const vel = vec3.create();
            const currentSpeed = speed + this.getRandom(-speed * 0.2, speed * 0.2);
            vec3.scale(vel, direction, currentSpeed);
            
            vel[0] += this.getRandom(-0.015, 0.015);
            vel[1] += this.getRandom(-0.015, 0.015);
            vel[2] += this.getRandom(-0.015, 0.015);

            globalEventBus.emit("SPAWN_PARTICLE", {
                position: vec3.clone(position),
                velocity: vel,
                color: vec4.clone(color),
                lifetime: this.getRandom(80, 150),
                size: this.getRandom(0.06, 0.14),
                gravity: false
            });
        }
    }
}