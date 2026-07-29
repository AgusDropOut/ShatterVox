import { World } from "../world/World";
import RAPIER from "@dimforge/rapier3d-compat";
import { Debri} from "../world/Debri";
import type { TerrainPhysics } from "./TerrainPhysics";
import { ColliderRegistry } from "./ColliderRegistry";

export class StructuralIntegrity {
    private readonly world: World;
    private readonly physicsWorld: RAPIER.World;
    private readonly gl: WebGL2RenderingContext;
    private readonly terrainPhysics: TerrainPhysics;

    constructor(gl: WebGL2RenderingContext, world: World, physicsWorld: RAPIER.World, terrainPhysics: TerrainPhysics) {
        this.gl = gl;
        this.world = world;
        this.physicsWorld = physicsWorld;
        this.terrainPhysics = terrainPhysics;
    }

    public checkSupport(x: number, y: number, z: number): void {
        const neighbors = [
            [x + 1, y, z], [x - 1, y, z],
            [x, y + 1, z], [x, y - 1, z],
            [x, y, z + 1], [x, y, z - 1]
        ];

        for (const [nx, ny, nz] of neighbors) {
            const blockId = this.world.getBlock(nx, ny, nz);

            if (blockId === 0 || blockId === 2) continue;

       
            const island = this.findIsland(nx, ny, nz, (bx, by, bz) => this.world.getBlock(bx, by, bz), true);
            
            if (!island.isAnchored) {
                this.markAsDebris(island.blocks);
            }
        }
    }

    // BFS
    private findIsland(
        startX: number, startY: number, startZ: number, 
        getBlock: (x: number, y: number, z: number) => number, 
        checkAnchor: boolean
    ) {
        const queue: number[][] = [[startX, startY, startZ]];
        const visited = new Set<string>();
        const islandBlocks: number[][] = [];
        let isAnchored = false;

        visited.add(`${startX},${startY},${startZ}`);

        while (queue.length > 0) {
            const [cx, cy, cz] = queue.shift()!;
            islandBlocks.push([cx, cy, cz]);
            
            if (checkAnchor && cy <= 0) {
                isAnchored = true;
                break; 
            }

            const neighbors = [
                [cx + 1, cy, cz], [cx - 1, cy, cz],
                [cx, cy + 1, cz], [cx, cy - 1, cz],
                [cx, cy, cz + 1], [cx, cy, cz - 1]
            ];

            for (const [nx, ny, nz] of neighbors) {
                const key = `${nx},${ny},${nz}`;
                if (visited.has(key)) continue;

            
                const neighborId = getBlock(nx, ny, nz);

                if (neighborId !== 0) {
                    visited.add(key);
                    queue.push([nx, ny, nz]);
                }
            }
        }

        return { isAnchored, blocks: islandBlocks, visitedKeys: visited };
    }

    private markAsDebris(blocks: number[][]): void {
        if (blocks.length === 0) return;

        let cx = 0, cy = 0, cz = 0;
        let minX = Infinity, minY = Infinity, minZ = Infinity;

        for (const [x, y, z] of blocks) {
            cx += x + 0.5;
            cy += y + 0.5;
            cz += z + 0.5;

            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (z < minZ) minZ = z;
        }
        cx /= blocks.length;
        cy /= blocks.length;
        cz /= blocks.length;

        for (const [x, y, z] of blocks) {
            this.world.chunk.setBlock(x, y, z, 0); 
        }

        const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(cx, cy, cz);
        const rigidBody = this.physicsWorld.createRigidBody(rigidBodyDesc);
        let debri = new Debri(this.gl, rigidBody, blocks, cx, cy, cz);
    
        for (const [x, y, z] of blocks) {
            const localX = x - cx + 0.5;
            const localY = y - cy + 0.5;
            const localZ = z - cz + 0.5;

           
            const colliderDesc = RAPIER.ColliderDesc.cuboid(0.50, 0.50, 0.50)
                .setTranslation(localX, localY, localZ); 
            
            const collider = this.physicsWorld.createCollider(colliderDesc, rigidBody);
       
            ColliderRegistry.set(collider.handle, {
                debri: debri,
                localX: x - minX, 
                localY: y - minY,
                localZ: z - minZ
            });
        }

        this.terrainPhysics.removeColliders(blocks);
        this.world.addDebri(debri);

        console.log(`[Physics] Spawned debris with ${blocks.length} blocks at ${cx.toFixed(1)}, ${cy.toFixed(1)}, ${cz.toFixed(1)}`);
    }

  
    public evaluateShatter(debri: Debri): void {
        const visitedGlobal = new Set<string>();
        const islands: number[][][] = [];

    
        for (let x = 0; x < 16; x++) {
            for (let y = 0; y < 16; y++) {
                for (let z = 0; z < 16; z++) {
                    if (debri.getBlock(x, y, z) === 0) continue;
                    
                    const key = `${x},${y},${z}`;
                    if (visitedGlobal.has(key)) continue;

               
                    const result = this.findIsland(x, y, z, (bx, by, bz) => debri.getBlock(bx, by, bz), false);
                    islands.push(result.blocks);

                   
                    for (const vKey of result.visitedKeys) {
                        visitedGlobal.add(vKey);
                    }
                }
            }
        }

        if (islands.length === 0) {
            this.world.removeDebri(debri);
            debri.deleteGraphics();
            this.physicsWorld.removeRigidBody((debri as any).rigidBody);
            return;
        }

        if (islands.length === 1) {
            this.world.updateDebriMesh(debri); 
            return;
        }

      console.log(`[StructuralIntegrity] Debri ID ${debri} shattered into ${islands.length} pieces.`);

        //clone
        const parentRb = (debri as any).rigidBody as RAPIER.RigidBody;
        const pTrans = parentRb.translation();
        const pRot = parentRb.rotation();
        const pLinVel = parentRb.linvel();
        const pAngVel = parentRb.angvel();
        
        const pOffsetX = (debri as any).offsetX;
        const pOffsetY = (debri as any).offsetY;
        const pOffsetZ = (debri as any).offsetZ;

      
        for (let i = 1; i < islands.length; i++) {
            const island = islands[i];

            const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(pTrans.x, pTrans.y, pTrans.z)
                .setRotation(pRot)
                .setLinvel(pLinVel.x, pLinVel.y, pLinVel.z)
                .setAngvel(new RAPIER.Vector3(pAngVel.x, pAngVel.y, pAngVel.z));
            
            const newRb = this.physicsWorld.createRigidBody(bodyDesc);

           
            const newDebri = new Debri(this.gl, newRb, [], 0, 0, 0);
            (newDebri as any).offsetX = pOffsetX;
            (newDebri as any).offsetY = pOffsetY;
            (newDebri as any).offsetZ = pOffsetZ;

           
            for (const [lx, ly, lz] of island) {
                debri.setBlock(lx, ly, lz, 0);   
                newDebri.setBlock(lx, ly, lz, 2); 
                
                
                for (const [handle, data] of ColliderRegistry.entries()) {
                    if (data.debri === debri && data.localX === lx && data.localY === ly && data.localZ === lz) {
                        const oldCollider = this.physicsWorld.getCollider(handle);
                        if (oldCollider) this.physicsWorld.removeCollider(oldCollider, true);
                        ColliderRegistry.delete(handle);
                        break;
                    }
                }

                const physLocalX = lx - pOffsetX + 0.5;
                const physLocalY = ly - pOffsetY + 0.5;
                const physLocalZ = lz - pOffsetZ + 0.5;

                const colliderDesc = RAPIER.ColliderDesc.cuboid(0.48, 0.48, 0.48)
                    .setTranslation(physLocalX, physLocalY, physLocalZ);
                
                const newCollider = this.physicsWorld.createCollider(colliderDesc, newRb);

                ColliderRegistry.set(newCollider.handle, {
                    debri: newDebri,
                    localX: lx,
                    localY: ly,
                    localZ: lz
                });
            }

            this.world.addDebri(newDebri);
            this.world.updateDebriMesh(newDebri);
        }

        
        this.world.updateDebriMesh(debri);
    }
}