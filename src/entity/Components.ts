// src/entity/Components.ts
import { vec3 } from "gl-matrix";


export interface PhysicsComponent {
    bodyId: number; 
}


export interface RenderComponent {
    modelId: string; 
    color: [number, number, number];
    scale: vec3;
}

export interface ExplosiveComponent {
    timer: number;   
    radius: number;  
    fuseActive: boolean;
}

