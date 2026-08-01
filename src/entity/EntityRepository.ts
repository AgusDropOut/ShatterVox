// src/entity/EntityRepository.ts
import type { PhysicsComponent, RenderComponent, ExplosiveComponent } from "./Components";

export class EntityRepository {
    private nextEntityId: number = 1;

  
    public readonly physics = new Map<number, PhysicsComponent>();
    public readonly renders = new Map<number, RenderComponent>();
    public readonly explosives = new Map<number, ExplosiveComponent>();


    public createEntity(): number {
        return this.nextEntityId++;
    }

  
    public destroyEntity(entity: number): void {
        this.physics.delete(entity);
        this.renders.delete(entity);
        this.explosives.delete(entity);
    }
}