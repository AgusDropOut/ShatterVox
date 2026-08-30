import { vec3 } from "gl-matrix";
import type { SpatialAudioAdapter } from "../types/SpatialAudioAdapter";

export class ModernSpatialAdapter implements SpatialAudioAdapter {
    public updateListener(listener: AudioListener, position: vec3, forward: vec3, up: vec3): void {
        listener.positionX.value = position[0];
        listener.positionY.value = position[1];
        listener.positionZ.value = position[2];
        listener.forwardX.value = forward[0];
        listener.forwardY.value = forward[1];
        listener.forwardZ.value = forward[2];
        listener.upX.value = up[0];
        listener.upY.value = up[1];
        listener.upZ.value = up[2];
    }

    public updatePanner(panner: PannerNode, position: vec3): void {
        panner.positionX.value = position[0];
        panner.positionY.value = position[1];
        panner.positionZ.value = position[2];
    }
}