import RAPIER from "@dimforge/rapier3d-compat";

export class PhysicsContext {
    public world: RAPIER.World | null = null;
    public dynamicBodies: Map<number, RAPIER.RigidBody> = new Map();
    public isInitialized: boolean = false;
}