import { vec3 } from "gl-matrix";
import { globalEventBus } from "../core/EventBus";
import { ModernSpatialAdapter } from "./ModernSpatialAdapter";
import { LegacySpatialAdapter } from "./LegacySpatialAdapter";
import type { SpatialAudioAdapter } from "../types/SpatialAudioAdapter";

export class SoundManager {
    private context: AudioContext;
    private buffers: Map<string, AudioBuffer> = new Map();
    private unlocked: boolean = false;
    private adapter: SpatialAudioAdapter;

    private masterDry: GainNode;
    private masterWet: GainNode;
    private convolver: ConvolverNode;

    constructor() {
        this.context = new window.AudioContext();
        
        if (this.context.listener.positionX) {
            this.adapter = new ModernSpatialAdapter();
        } else {
            this.adapter = new LegacySpatialAdapter();
        }

        this.masterDry = this.context.createGain();
        this.masterDry.connect(this.context.destination);

        this.masterWet = this.context.createGain();
        this.masterWet.gain.value = 0.0;
        this.masterWet.connect(this.context.destination);

        this.convolver = this.context.createConvolver();
        this.convolver.connect(this.masterWet);

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

    public async loadImpulseResponse(url: string): Promise<void> {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        this.convolver.buffer = await this.context.decodeAudioData(arrayBuffer);
    }

    public setEnclosureFactor(enclosure: number): void {
        if (!this.unlocked) return;
        this.masterWet.gain.setTargetAtTime(enclosure, this.context.currentTime, 0.1);
        this.masterDry.gain.setTargetAtTime(1.0 - (enclosure * 0.5), this.context.currentTime, 0.1);
    }

    public updateListener(position: vec3, forward: vec3, up: vec3): void {
        this.adapter.updateListener(this.context.listener, position, forward, up);
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

        this.adapter.updatePanner(panner, position);

        source.connect(gainNode);
        gainNode.connect(panner);
        
        panner.connect(this.masterDry);
        panner.connect(this.convolver);

        source.start(0);
    }
}