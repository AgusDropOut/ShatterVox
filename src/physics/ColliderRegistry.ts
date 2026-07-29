import { Debri } from "../world/Debri";

export interface VoxelPhysicsData {
    debri: Debri;
    localX: number;
    localY: number;
    localZ: number;
}


export const ColliderRegistry = new Map<number, VoxelPhysicsData>();