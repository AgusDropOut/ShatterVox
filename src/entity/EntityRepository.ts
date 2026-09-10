import type { PhysicsComponent, RenderComponent, ExplosiveComponent, InteractableComponent, UpdateComponent, SingularityComponent } from "./Components";

export class EntityRepository {
    private nextEntityId: number = 1;
  
    public readonly physics = new Map<number, PhysicsComponent>();
    public readonly renders = new Map<number, RenderComponent>();
    public readonly explosives = new Map<number, ExplosiveComponent>();
    public readonly interactables = new Map<number, InteractableComponent>();
    public readonly updates = new Map<number, UpdateComponent>();
    
    public readonly singularities = new Map<number, SingularityComponent>();

    public createEntity(): number {
        return this.nextEntityId++;
    }

    public destroyEntity(entity: number): void {
        this.physics.delete(entity);
        this.renders.delete(entity);
        this.explosives.delete(entity);
        this.interactables.delete(entity);
        this.updates.delete(entity);
        this.singularities.delete(entity); 
    }
}