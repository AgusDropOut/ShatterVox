import { vec3 } from "gl-matrix";
import { World } from "../world/World";
import { Engine } from "../core/Engine";

export interface RaycastResult {
    hit: boolean;
    blockPos: vec3;
    normal: vec3;
    distance: number;          
}

export class VoxelRaycaster {
    public static raycastGrid(origin: vec3, direction: vec3, maxDistance: number, world: World): RaycastResult {
        const gridOrigin = vec3.fromValues(
            origin[0] / Engine.voxelSize,
            origin[1] / Engine.voxelSize,
            origin[2] / Engine.voxelSize
        );
        const gridMaxDist = maxDistance / Engine.voxelSize;

        let x = Math.floor(gridOrigin[0]);
        let y = Math.floor(gridOrigin[1]);
        let z = Math.floor(gridOrigin[2]);

        const stepX = Math.sign(direction[0]);
        const stepY = Math.sign(direction[1]);
        const stepZ = Math.sign(direction[2]);

        const dirX = direction[0] !== 0 ? direction[0] : 1e-7;
        const dirY = direction[1] !== 0 ? direction[1] : 1e-7;
        const dirZ = direction[2] !== 0 ? direction[2] : 1e-7;

        const tDeltaX = Math.abs(1.0 / dirX);
        const tDeltaY = Math.abs(1.0 / dirY);
        const tDeltaZ = Math.abs(1.0 / dirZ);

        let tMaxX = (stepX > 0 ? (x + 1.0 - gridOrigin[0]) : (gridOrigin[0] - x)) * tDeltaX;
        let tMaxY = (stepY > 0 ? (y + 1.0 - gridOrigin[1]) : (gridOrigin[1] - y)) * tDeltaY;
        let tMaxZ = (stepZ > 0 ? (z + 1.0 - gridOrigin[2]) : (gridOrigin[2] - z)) * tDeltaZ;

        const normal = vec3.create();
        let currentDistance = 0.0;

        while (currentDistance <= gridMaxDist) {
            if (world.getBlock(x, y, z) !== 0) {
                return {
                    hit: true,
                    blockPos: vec3.fromValues(x, y, z),
                    normal: normal,
                    distance: currentDistance * Engine.voxelSize 
                };
            }

            if (tMaxX < tMaxY) {
                if (tMaxX < tMaxZ) {
                    x += stepX; currentDistance = tMaxX; tMaxX += tDeltaX; vec3.set(normal, -stepX, 0, 0);
                } else {
                    z += stepZ; currentDistance = tMaxZ; tMaxZ += tDeltaZ; vec3.set(normal, 0, 0, -stepZ);
                }
            } else {
                if (tMaxY < tMaxZ) {
                    y += stepY; currentDistance = tMaxY; tMaxY += tDeltaY; vec3.set(normal, 0, -stepY, 0);
                } else {
                    z += stepZ; currentDistance = tMaxZ; tMaxZ += tDeltaZ; vec3.set(normal, 0, 0, -stepZ);
                }
            }
        }

        return { hit: false, blockPos: vec3.create(), normal: vec3.create(), distance: Infinity };
    }
}