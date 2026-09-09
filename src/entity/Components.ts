import { vec3, quat } from "gl-matrix";

export interface PhysicsComponent {
    bodyId: number; 
}

export interface RenderComponent {
    modelId: string; 
    color: [number, number, number];
    scale: vec3;
    visualOffset?: vec3;
    position?: vec3; 
    rotation?: quat; 
}

export interface ExplosiveComponent {
    timer: number;   
    radius: number;  
    fuseActive: boolean;
}

export interface InteractableComponent {
    overlayData?: any;
    onInteract?: () => void;
}

export interface UpdateComponent {
    onUpdate: (deltaTime: number) => void;
}