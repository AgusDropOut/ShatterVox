import { vec3 } from "gl-matrix";
import { globalEventBus } from "../core/EventBus";

export class SoundManager {
    private context: AudioContext;
    private buffers: Map<string, AudioBuffer> = new Map();
    private unlocked: boolean = false;

    constructor() {
        this.context = new window.AudioContext();
        globalEventBus.on("PLAY_SPATIAL_SOUND", (data: { id: string, position: vec3, volume?: number, pitch?: number }) => {
            this.playSpatialSound(data.id, data.position, data.volume ?? 1.0, data.pitch ?? 1.0);
        });
    }

    public unlock(): void {
        if (!this.unlocked) {
            this.context.resume();
            this.unlocked = true;
        }
    }

    public async loadSound(id: string, url: string): Promise<void> {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
        this.buffers.set(id, audioBuffer);
    }

    public updateListener(position: vec3, forward: vec3, up: vec3): void {
        const listener = this.context.listener;
        
        if (listener.positionX) {
            listener.positionX.value = position[0];
            listener.positionY.value = position[1];
            listener.positionZ.value = position[2];
            
            listener.forwardX.value = forward[0];
            listener.forwardY.value = forward[1];
            listener.forwardZ.value = forward[2];
            
            listener.upX.value = up[0];
            listener.upY.value = up[1];
            listener.upZ.value = up[2];
        } else {
            listener.setPosition(position[0], position[1], position[2]);
            listener.setOrientation(forward[0], forward[1], forward[2], up[0], up[1], up[2]);
        }
    }

    public playSpatialSound(id: string, position: vec3, volume: number = 1.0, pitch: number = 1.0): void {
        if (!this.unlocked) return;
        const buffer = this.buffers.get(id); 
        if (!buffer) return;

        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = pitch;

        const gainNode = this.context.createGain();
        gainNode.gain.value = volume;

        const panner = this.context.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1.0;
        panner.maxDistance = 50.0;
        panner.rolloffFactor = 1.0;

        if (panner.positionX) {
            panner.positionX.value = position[0];
            panner.positionY.value = position[1];
            panner.positionZ.value = position[2];
        } else {
            panner.setPosition(position[0], position[1], position[2]);
        }

        source.connect(gainNode);
        gainNode.connect(panner);
        panner.connect(this.context.destination);

        source.start(0);
    }
}