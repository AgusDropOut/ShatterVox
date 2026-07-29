import { vec3 } from "gl-matrix";
import { World } from "../world/World";
import RAPIER from "@dimforge/rapier3d-compat";

export interface RaycastResult {
    hit: boolean;
    blockPos: vec3;
    normal: vec3;
    distance: number;          
    colliderHandle?: number;  
}

export class VoxelRaycaster {
    
    /**
     * Executes a Fast Voxel Traversal (Amanatides & Woo DDA) to find the first solid block.
     * @param origin Starting point of the ray (e.g., Camera position)
     * @param direction Normalized direction vector (e.g., Camera front)
     * @param maxDistance Maximum reach of the ray in world units
     * @param world The world instance to query blocks from
     */
    public static raycastGrid(origin: vec3, direction: vec3, maxDistance: number, world: World): RaycastResult {
        let x = Math.floor(origin[0]);
        let y = Math.floor(origin[1]);
        let z = Math.floor(origin[2]);

        const stepX = Math.sign(direction[0]);
        const stepY = Math.sign(direction[1]);
        const stepZ = Math.sign(direction[2]);

        const dirX = direction[0] !== 0 ? direction[0] : 1e-7;
        const dirY = direction[1] !== 0 ? direction[1] : 1e-7;
        const dirZ = direction[2] !== 0 ? direction[2] : 1e-7;

        const tDeltaX = Math.abs(1.0 / dirX);
        const tDeltaY = Math.abs(1.0 / dirY);
        const tDeltaZ = Math.abs(1.0 / dirZ);

        let tMaxX = (stepX > 0 ? (x + 1.0 - origin[0]) : (origin[0] - x)) * tDeltaX;
        let tMaxY = (stepY > 0 ? (y + 1.0 - origin[1]) : (origin[1] - y)) * tDeltaY;
        let tMaxZ = (stepZ > 0 ? (z + 1.0 - origin[2]) : (origin[2] - z)) * tDeltaZ;

        const normal = vec3.create();
        let currentDistance = 0.0;

        while (currentDistance <= maxDistance) {
            if (world.getBlock(x, y, z) !== 0) {
                return {
                    hit: true,
                    blockPos: vec3.fromValues(x, y, z),
                    normal: normal,
                    distance: currentDistance // <- Lo devolvemos acá
                };
            }

            if (tMaxX < tMaxY) {
                if (tMaxX < tMaxZ) {
                    x += stepX;
                    currentDistance = tMaxX;
                    tMaxX += tDeltaX;
                    vec3.set(normal, -stepX, 0, 0);
                } else {
                    z += stepZ;
                    currentDistance = tMaxZ;
                    tMaxZ += tDeltaZ;
                    vec3.set(normal, 0, 0, -stepZ);
                }
            } else {
                if (tMaxY < tMaxZ) {
                    y += stepY;
                    currentDistance = tMaxY;
                    tMaxY += tDeltaY;
                    vec3.set(normal, 0, -stepY, 0);
                } else {
                    z += stepZ;
                    currentDistance = tMaxZ;
                    tMaxZ += tDeltaZ;
                    vec3.set(normal, 0, 0, -stepZ);
                }
            }
        }

        return { hit: false, blockPos: vec3.create(), normal: vec3.create(), distance: Infinity };
    }


    /**
     * Executes a raycast using the physics engine (Rapier) to find the first collider hit.
     * @param origin Starting point of the ray (e.g., Camera position)
     * @param direction Normalized direction vector (e.g., Camera front)
     * @param maxDistance Maximum reach of the ray in world units
     * @param physicsWorld The Rapier physics world instance
     * @param playerCollider The player's collider to exclude from the raycast
     */
    public static raycastPhysics(origin: vec3, direction: vec3, maxDistance: number, physicsWorld: RAPIER.World, playerCollider: RAPIER.Collider): RaycastResult {
        const ray = new RAPIER.Ray(
            { x: origin[0], y: origin[1], z: origin[2] },
            { x: direction[0], y: direction[1], z: direction[2] }
        );

     
        const hit = physicsWorld.castRay(ray, maxDistance, true, undefined, undefined, playerCollider);

        if (hit ) {
            return {
                hit: true,
                blockPos: vec3.create(), 
                normal: vec3.create(), 
                distance: hit.timeOfImpact,      
                colliderHandle: hit.collider.handle
            };
        }

        return { hit: false, blockPos: vec3.create(), normal: vec3.create(), distance: Infinity };
    }

}