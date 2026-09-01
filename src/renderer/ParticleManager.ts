import { vec3, vec4 } from "gl-matrix";
import { WebGPUStorageBuffer } from "./WebGPUStorageBuffer";
import { globalEventBus } from "../core/EventBus";


export interface Particle {
        position: vec3
        velocity: vec3
        color: vec4
        lifetime: number
        size: number
        gravity: boolean
} 

export class ParticleManager {
    private readonly device: GPUDevice;
    private readonly particleBuffer: WebGPUStorageBuffer;
    public readonly maxParticles: number;
    private readonly floatsPerParticle: number = 12; 


    private particles: Particle[] = [];
    private currentParticleIndex: number = 0;
    private lastFrameParticleIndex: number = 0;
    private currentFrameNewParticles: number = 0;

    

    constructor(device: GPUDevice, maxParticles: number) {
        this.device = device;
        this.maxParticles = maxParticles;
        const initialData = new Float32Array(maxParticles * this.floatsPerParticle);
        this.particleBuffer = new WebGPUStorageBuffer(device, initialData, "Particle Buffer");

        globalEventBus.on("SPAWN_PARTICLE", (data) => {
            const particle: Particle = {
                position: vec3.clone(data.position),
                velocity: vec3.clone(data.velocity),
                color: vec4.clone(data.color),
                lifetime: data.lifetime,
                size: data.size,
                gravity: data.gravity ?? false
            };
            this.addParticle(particle);
        });
    }

    public addParticle(particle: Particle): void {
        if (this.currentParticleIndex >= this.maxParticles) {
            this.currentParticleIndex = 0;
        }
        this.particles[this.currentParticleIndex] = particle;
        this.currentParticleIndex++;
        this.currentFrameNewParticles++;
    }

    public flushParticles(): void {
        if (this.currentFrameNewParticles === 0) return;

        if (this.currentFrameNewParticles > this.maxParticles) {
            this.currentFrameNewParticles = this.maxParticles;
        }

        const particleData = new Float32Array(this.currentFrameNewParticles * this.floatsPerParticle);
        
        for (let i = 0; i < this.currentFrameNewParticles; i++) {
            const readIndex = (this.lastFrameParticleIndex + i) % this.maxParticles;
            const particle = this.particles[readIndex];
          
            particleData[i * this.floatsPerParticle + 0] = particle.position[0];
            particleData[i * this.floatsPerParticle + 1] = particle.position[1];
            particleData[i * this.floatsPerParticle + 2] = particle.position[2];
            particleData[i * this.floatsPerParticle + 3] = particle.lifetime;
            particleData[i * this.floatsPerParticle + 4] = particle.velocity[0];
            particleData[i * this.floatsPerParticle + 5] = particle.velocity[1];
            particleData[i * this.floatsPerParticle + 6] = particle.velocity[2];
            particleData[i * this.floatsPerParticle + 7] = particle.size;
            particleData[i * this.floatsPerParticle + 8] = particle.color[0];
            particleData[i * this.floatsPerParticle + 9] = particle.color[1];
            particleData[i * this.floatsPerParticle + 10] = particle.color[2];
            particleData[i * this.floatsPerParticle + 11] = particle.gravity ? 1.0 : 0.0;
        }

        if (this.lastFrameParticleIndex + this.currentFrameNewParticles > this.maxParticles) {
            const firstPartSize = this.maxParticles - this.lastFrameParticleIndex;
            this.particleBuffer.updateSubData(
                particleData.subarray(0, firstPartSize * this.floatsPerParticle), 
                this.lastFrameParticleIndex * this.floatsPerParticle * 4
            ); 
            const secondPartSize = this.currentFrameNewParticles - firstPartSize;
            this.particleBuffer.updateSubData(
                particleData.subarray(firstPartSize * this.floatsPerParticle), 
                0
            );
        } else {
            this.particleBuffer.updateSubData(
                particleData, 
                this.lastFrameParticleIndex * this.floatsPerParticle * 4
            );
        }
        
        this.lastFrameParticleIndex = (this.lastFrameParticleIndex + this.currentFrameNewParticles) % this.maxParticles;
        this.currentFrameNewParticles = 0;
    }

    public getParticleBuffer(): GPUBuffer {
        return this.particleBuffer.buffer;
    }
}