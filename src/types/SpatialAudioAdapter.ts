import { vec3 } from "gl-matrix";

export interface SpatialAudioAdapter {
    updateListener(listener: AudioListener, position: vec3, forward: vec3, up: vec3): void;
    updatePanner(panner: PannerNode, position: vec3): void;
}