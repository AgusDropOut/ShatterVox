import { Engine } from "../core/Engine";
import { globalEventBus } from "../core/EventBus";
import type { IBlockBehavior } from "./BlockBehaviors";
import { RadioactiveBehavior, SlimeBehavior, MagicOreBehavior, FireBehavior, AmbarBehavior } from "./BlockBehaviors";

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
    lightEmissive?: boolean;
    lightRadius?: number;
    lightColor?: [number, number, number];
    soundId?: string;
    behavior?: IBlockBehavior;
    roughness: number;
    metallic: number;
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
            blastResistance: 50,
            lightEmissive: false,
            lightColor: [1.0, 1.0, 1.0],
            lightRadius: 0.0,
            soundId: "stone_collision",
            roughness: 0.9,
            metallic: 0.0
        };
    }

    public name(name: string): this { this.def.name = name; return this; }
    public texture(textureId: number): this { this.def.textureId = textureId; return this; }
    public color(r: number, g: number, b: number): this { this.def.color = [r, g, b]; return this; }
    public transparent(isTransparent: boolean = true): this { this.def.isTransparent = isTransparent; return this; }
    public fragmentation(chance: number): this { this.def.fragmentationChance = chance; return this; }
    public sound(soundId: string): this { this.def.soundId = soundId; return this; }
    
    public light(radius: number, r: number, g: number, b: number): this {
        this.def.lightRadius = radius;
        this.def.lightColor = [r, g, b];
        this.def.lightEmissive = true;
        return this;
    }
    
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

    public behavior(b: IBlockBehavior): this {
        this.def.behavior = b;
        return this;
    }

    public material(roughness: number, metallic: number): this {
        this.def.roughness = roughness;
        this.def.metallic = metallic;
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
        
        this.create(1).name("Stone").texture(1).color(0.25, 0.25, 0.25).material(0.85, 0.0).fragmentation(0.04).sound("stone_collision").register();
        this.create(2).name("Grass").texture(2).color(0.15, 0.5, 0.15).material(0.9, 0.0).fragmentation(0.08).sound("grass_collision").register();
        this.create(3).name("Wood").texture(3).color(0.48, 0.32, 0.2).material(0.8, 0.0).fragmentation(0.05).sound("wood_crack").register();
        this.create(4).name("Leaves").texture(4).color(0.1, 0.4, 0.1).material(0.9, 0.0).fragmentation(0.3).transparent().sound("leaves_collision").register();
        
        this.create(5).name("Amethyst").texture(5).color(0.6, 0.4, 0.8).light(1.5, 0.8, 0.9, 1.0).material(0.05, 0.0).fragmentation(0.12).sound("glass_collision").behavior(RadioactiveBehavior).register();
        this.create(6).name("Ruby").texture(6).color(0.8, 0.05, 0.05).light(1.5, 1.0, 0.1, 0.1).material(0.05, 0.0).fragmentation(0.12).sound("glass_collision").register();
        this.create(7).name("Emerald").texture(7).color(0.1, 0.8, 0.3).light(1.5, 0.1, 1.0, 0.1).material(0.05, 0.0).fragmentation(0.12).sound("glass_collision").behavior(MagicOreBehavior).register();
        this.create(8).name("Sapphire").texture(8).color(0.1, 0.3, 0.8).light(2.5, 0.1, 0.3, 1.0).material(0.05, 0.0).fragmentation(0.12).sound("glass_collision").register();
        this.create(9).name("Glowstone").texture(9).color(0.8, 0.8, 0.3).light(1.5, 1.0, 0.8, 0.2).material(0.4, 0.0).fragmentation(0.12).sound("glass_collision").register();
        
        this.create(10).name("Redstone").texture(6).color(0.7, 0.1, 0.1).material(0.7, 0.0).fragmentation(0.05).sound("stone_collision").register();
        this.create(11).name("Quartz").texture(10).color(0.85, 0.85, 0.85).material(0.15, 0.0).fragmentation(0.05).sound("glass_collision").register();
        this.create(13).name("Slime").texture(11).color(0.22, 0.65, 0.22).material(0.2, 0.0).physics(0.8, 0.9, 1.4, 0.0).behavior(SlimeBehavior).sound("slime_squish").register();
        
        this.create(14).name("Iron").texture(12).color(0.56, 0.57, 0.58).material(0.35, 1.0).physics(2.0, 0.6, 0.1, 0.0).sound("metal_collision").fragmentation(0.05).toughness(90).register();
        this.create(15).name("Fire").texture(13).color(1.0, 0.5, 0.0).transparent().light(2.0, 1.0, 0.4, 0.1).behavior(FireBehavior).physics(0.0, 0.0, 0.0, 0.0).toughness(0).register();
        
        this.create(16).name("Stone_bricks").texture(14).color(0.25, 0.25, 0.25).material(0.8, 0.0).fragmentation(0.02).sound("stone_collision").register();
        this.create(17).name("Stone_column").texture(15).color(0.25, 0.25, 0.25).material(0.8, 0.0).fragmentation(0.02).sound("stone_collision").register();
        this.create(18).name("Wood_planks").texture(16).color(0.55, 0.4, 0.25).material(0.7, 0.0).fragmentation(0.05).sound("wood_crack").register();
        this.create(19).name("Stone_pattern_1").texture(17).color(0.2, 0.2, 0.2).material(0.8, 0.0).fragmentation(0.02).sound("stone_collision").register();
        this.create(20).name("metal").texture(18).color(0.35, 0.37, 0.4).material(0.25, 1.0).physics(2.0, 0.6, 0.1, 0.0).sound("metal_collision").fragmentation(0.05).toughness(90).register();
        this.create(21).name("Ambar").texture(19).color(0.8, 0.8, 0.3).material(0.4, 0.0).fragmentation(0.12).sound("glass_collision").behavior(AmbarBehavior).register();
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

    public static getAvailableBlocks(): Record<string, number> {
        const result: Record<string, number> = {};
        for (const [id, def] of this.blocks.entries()) {
            if (id !== 0) result[def.name] = id;
        }
        return result;
    }

    public static exportPhysicsConfig(): Record<number, { density: number, friction: number, restitution: number, fragmentationChance: number, soundId?: string }> {
        const config: Record<number, any> = {};
        for (const [id, def] of this.blocks.entries()) {
            config[id] = { 
                density: def.density, 
                friction: def.friction, 
                restitution: def.restitution, 
                fragmentationChance: def.fragmentationChance,
                soundId: def.soundId
            };
        }
        return config;
    }
}

BlockRegistry.init();