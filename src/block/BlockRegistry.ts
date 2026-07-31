export interface BlockDef {
    id: number;
    name: string;
    textureId: number; 
    color: [number, number, number];
    isTransparent?: boolean;
}

export class BlockRegistry {
    private static blocks = new Map<number, BlockDef>();

    public static init(): void {
        this.register({ id: 0, name: "Air",    textureId: 0, color: [0.0, 0.0, 0.0], isTransparent: true });
        this.register({ id: 1, name: "Stone",  textureId: 1, color: [0.2, 0.2, 0.2] });
        this.register({ id: 2, name: "Grass",  textureId: 2, color: [0.0, 1.0, 0.0] });
        this.register({ id: 3, name: "Wood",   textureId: 3, color: [0.6, 0.4, 0.2] });
        this.register({ id: 4, name: "Leaves", textureId: 4, color: [0.0, 0.6, 0.0], isTransparent: true }); 
    }

    public static register(def: BlockDef): void {
        this.blocks.set(def.id, def);
    }

    public static get(id: number): BlockDef {
        return this.blocks.get(id) || this.blocks.get(1)!; 
    }
}

BlockRegistry.init();