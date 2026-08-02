export interface BlockDef {
    id: number;
    name: string;
    textureId: number; 
    color: [number, number, number];
    isTransparent?: boolean;
    density: number;
    friction: number;
    restitution: number;
    blastResistance: number;
    fragmentationChance?: number;
}


export class BlockBuilder {
    private def: Partial<BlockDef> & { id: number };

    constructor(id: number) {
        this.def = {
            id,
            name: "Unknown",
            textureId: 0,
            color: [1.0, 1.0, 1.0],
            density: 1.0,      
            friction: 0.5,     
            restitution: 0.0,   
            fragmentationChance: 0.0,
            blastResistance: 10 
        };
    }

    public name(name: string): this { this.def.name = name; return this; }
    public texture(textureId: number): this { this.def.textureId = textureId; return this; }
    public color(r: number, g: number, b: number): this { this.def.color = [r, g, b]; return this; }
    public transparent(isTransparent: boolean = true): this { this.def.isTransparent = isTransparent; return this; }
    public fragmentation(chance: number): this { this.def.fragmentationChance = chance; return this; }

  
    public physics(density: number, friction: number, restitution: number, fragmentationChance: number = 0.0): this {
        this.def.density = density;
        this.def.friction = friction;
        this.def.restitution = restitution;
        this.def.fragmentationChance = fragmentationChance;
        return this;
    }

    public toughness(resistance: number): this {
        this.def.blastResistance = resistance;
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
        this.create(1).name("Stone").texture(1).color(0.2, 0.2, 0.2).fragmentation(0.12).register();
        this.create(2).name("Grass").texture(2).color(0.0, 1.0, 0.0).fragmentation(0.08).register();
        this.create(3).name("Wood").texture(3).color(0.6, 0.4, 0.2).fragmentation(0.04).register();
        this.create(4).name("Leaves").texture(4).color(0.0, 0.6, 0.0).fragmentation(0.3).transparent().register();
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

    public static exportPhysicsConfig(): Record<number, { density: number, friction: number, restitution: number, fragmentationChance: number }> {
        const config: Record<number, any> = {};
        for (const [id, def] of this.blocks.entries()) {
            config[id] = { density: def.density, friction: def.friction, restitution: def.restitution, fragmentationChance: def.fragmentationChance };
        }
        return config;
    }
}

BlockRegistry.init();