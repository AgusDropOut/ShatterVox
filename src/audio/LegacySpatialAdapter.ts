import { vec3 } from "gl-matrix";
import type { SpatialAudioAdapter } from "../types/SpatialAudioAdapter";

export class LegacySpatialAdapter implements SpatialAudioAdapter {
    public updateListener(listener: AudioListener, position: vec3, forward: vec3, up: vec3): void {
        listener.setPosition(position[0], position[1], position[2]);
        listener.setOrientation(forward[0], forward[1], forward[2], up[0], up[1], up[2]);
    }

    public updatePanner(panner: PannerNode, position: vec3): void {
        panner.setPosition(position[0], position[1], position[2]);
    }
}
