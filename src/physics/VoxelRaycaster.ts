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
        const dir = vec3.clone(direction);
        vec3.normalize(dir, dir);

        const voxelSize = Engine.voxelSize;
        
        const startX = origin[0] / voxelSize;
        const startY = origin[1] / voxelSize;
        const startZ = origin[2] / voxelSize;

        let x = Math.floor(startX);
        let y = Math.floor(startY);
        let z = Math.floor(startZ);

        const stepX = dir[0] > 0 ? 1 : (dir[0] < 0 ? -1 : 0);
        const stepY = dir[1] > 0 ? 1 : (dir[1] < 0 ? -1 : 0);
        const stepZ = dir[2] > 0 ? 1 : (dir[2] < 0 ? -1 : 0);

        const tDeltaX = dir[0] === 0 ? Infinity : Math.abs(1.0 / dir[0]);
        const tDeltaY = dir[1] === 0 ? Infinity : Math.abs(1.0 / dir[1]);
        const tDeltaZ = dir[2] === 0 ? Infinity : Math.abs(1.0 / dir[2]);

        let tMaxX = Infinity;
        if (stepX > 0) tMaxX = (x + 1.0 - startX) * tDeltaX;
        else if (stepX < 0) tMaxX = (startX - x) * tDeltaX;
        if (Number.isNaN(tMaxX)) tMaxX = 0;

        let tMaxY = Infinity;
        if (stepY > 0) tMaxY = (y + 1.0 - startY) * tDeltaY;
        else if (stepY < 0) tMaxY = (startY - y) * tDeltaY;
        if (Number.isNaN(tMaxY)) tMaxY = 0;

        let tMaxZ = Infinity;
        if (stepZ > 0) tMaxZ = (z + 1.0 - startZ) * tDeltaZ;
        else if (stepZ < 0) tMaxZ = (startZ - z) * tDeltaZ;
        if (Number.isNaN(tMaxZ)) tMaxZ = 0;

        let currentDist = 0.0;
        const maxGridDist = maxDistance / voxelSize;
        const normal = vec3.create();
        
        if (world.getBlock(x, y, z) !== 0) {
            return { hit: true, blockPos: vec3.fromValues(x, y, z), normal: vec3.fromValues(0, 1, 0), distance: 0 };
        }

        let limit = Math.ceil(maxGridDist) * 3;
        
        while (limit-- > 0) {
            if (tMaxX < tMaxY) {
                if (tMaxX < tMaxZ) {
                    currentDist = tMaxX;
                    x += stepX;
                    tMaxX += tDeltaX;
                    vec3.set(normal, -stepX, 0, 0);
                } else {
                    currentDist = tMaxZ;
                    z += stepZ;
                    tMaxZ += tDeltaZ;
                    vec3.set(normal, 0, 0, -stepZ);
                }
            } else {
                if (tMaxY < tMaxZ) {
                    currentDist = tMaxY;
                    y += stepY;
                    tMaxY += tDeltaY;
                    vec3.set(normal, 0, -stepY, 0);
                } else {
                    currentDist = tMaxZ;
                    z += stepZ;
                    tMaxZ += tDeltaZ;
                    vec3.set(normal, 0, 0, -stepZ);
                }
            }

            if (currentDist > maxGridDist) {
                break;
            }

            if (world.getBlock(x, y, z) !== 0) {
                return {
                    hit: true,
                    blockPos: vec3.fromValues(x, y, z),
                    normal: normal,
                    distance: currentDist * voxelSize
                };
            }
        }

        return { hit: false, blockPos: vec3.create(), normal: vec3.create(), distance: Infinity };
    }
}