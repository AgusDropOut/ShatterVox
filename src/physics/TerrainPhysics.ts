import RAPIER from "@dimforge/rapier3d-compat";
import { Chunk } from "../world/Chunk";

export class TerrainPhysics {
    public readonly rigidBody: RAPIER.RigidBody;
    private readonly physicsWorld: RAPIER.World;

    constructor(physicsWorld: RAPIER.World) {
        this.physicsWorld = physicsWorld;

        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
        this.rigidBody = this.physicsWorld.createRigidBody(bodyDesc);
    }

 
    public buildColliders(chunk: Chunk): void {


        for (let x = 0; x < Chunk.WIDTH; x++) {
            for (let y = 0; y < Chunk.HEIGHT; y++) {
                for (let z = 0; z < Chunk.DEPTH; z++) {
                    const blockId = chunk.getBlock(x, y, z);
                    
                    if (blockId === 0) continue;

                   
                    const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5)
                        .setTranslation(x, y, z);
                    

                    this.physicsWorld.createCollider(colliderDesc, this.rigidBody);
                }
            }
        }
    }
}