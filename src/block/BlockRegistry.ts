export interface BlockDef {
    id: number;
    name: string;
    textureId: number; 
    color: [number, number, number];
    isTransparent?: boolean;
  
}


export class BlockBuilder {
    private def: Partial<BlockDef> & { id: number };

    constructor(id: number) {
        this.def = {
            id,
            name: "Unknown",
            textureId: 0,
            color: [1.0, 1.0, 1.0]
        };
    }

    public name(name: string): this {
        this.def.name = name;
        return this;
    }

    public texture(textureId: number): this {
        this.def.textureId = textureId;
        return this;
    }

    public color(r: number, g: number, b: number): this {
        this.def.color = [r, g, b];
        return this;
    }

    public transparent(isTransparent: boolean = true): this {
        this.def.isTransparent = isTransparent;
        return this;
    }

  
    public register(): BlockDef {
        const blockDef = this.def as BlockDef;
        BlockRegistry.register(blockDef);
        return blockDef;
    }
}

export class BlockRegistry {
    private static blocks = new Map<number, BlockDef>();

    public static init(): void {
        this.create(0).name("Air").texture(0).color(0.0, 0.0, 0.0).transparent().register();
        this.create(1).name("Stone").texture(1).color(0.2, 0.2, 0.2).register();
        this.create(2).name("Grass").texture(2).color(0.0, 1.0, 0.0).register();
        this.create(3).name("Wood").texture(3).color(0.6, 0.4, 0.2).register();
        this.create(4).name("Leaves").texture(4).color(0.0, 0.6, 0.0).transparent().register();
    }

    public static create(id: number): BlockBuilder {
        return new BlockBuilder(id);
    }

  
    public static register(def: BlockDef): void {
        this.blocks.set(def.id, def);
    }

   
    public static get(id: number): BlockDef {
        return this.blocks.get(id) || this.blocks.get(1)!; 
    }
}

BlockRegistry.init();