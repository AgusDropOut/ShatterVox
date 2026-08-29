import RAPIER from "@dimforge/rapier3d-compat";

export class PhysicsContext {
    public world: RAPIER.World | null = null;
    public dynamicBodies: Map<number, RAPIER.RigidBody> = new Map();
    public terrainColliders: Map<string, RAPIER.Collider> = new Map();
    public terrainRigidBody: RAPIER.RigidBody | null = null;
    public rapierEventQueue: RAPIER.EventQueue | null = null;
    public isInitialized: boolean = false;
    public blockDefs: Record<number, { density: number, friction: number, restitution: number, soundId?: string }> = {};
    public terrainCollidersMap: Map<number, RAPIER.Collider> | null = null;
    public colliderMaterials: Map<number, number> = new Map(); 
}