import GUI from 'lil-gui';
import { WebGPURenderer } from '../renderer/WebGPURenderer';
import { globalEventBus } from './EventBus';
import { BlockRegistry } from '../block/BlockRegistry';
import { WorldSerializer } from '../world/WorldSerializer';
import type { World } from '../world/World';
import type { EntityRepository } from '../entity/EntityRepository';
import { PhysicsFacade } from '../physics/PhysicsFacade';

export class DebugGui {
    private gui: GUI;

    public state = {
        activeView: 'None',
        physicsDebug: false,
        buildMode: false,
        selectedBlockId: 1,
        sphereRadius: 3,
        destructionRadius: 3,
        mineCooldownMs: 100,
        buildCooldownMs: 100
    };

    constructor(renderer: WebGPURenderer, world: World, entityRepo: EntityRepository, physicsFacade: PhysicsFacade) {
        this.gui = new GUI({ title: 'Engine Debug Settings' });
        this.gui.hide();

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Backquote' || e.code === 'IntlBackslash') {
                this.gui._hidden ? this.gui.show() : this.gui.hide();
            }
        });

        this.setupViews();
        this.setupBuildMode(world, entityRepo, physicsFacade);
        this.setupProfiler(renderer);
        this.setupSSGI(renderer);
        this.setupGTAO(renderer);
        this.setupTAA(renderer);
    }

    private setupViews(): void {
        const folder = this.gui.addFolder('Render Views');
        const viewOptions = [
            'None', 'Depth', 'Normals', 'Albedo', 'Deferred', 
            'GTAO (Noisy)', 'GTAO (Blurred)', 'SSGI (Noisy)', 'SSGI (Blurred)'
        ];

        folder.add(this.state, 'activeView', viewOptions).name('G-Buffer').onChange((value: string) => {
            globalEventBus.emit("CHANGE_DEBUG_VIEW", { view: value });
        });

        folder.add(this.state, 'physicsDebug').name('Physics Lines').listen().onChange((value: boolean) => {
            globalEventBus.emit("TOGGLE_PHYSICS_DEBUG", { enabled: value });
        });

        globalEventBus.on("TOGGLE_PHYSICS_DEBUG", (data) => {
            if (data.enabled === undefined) {
                this.state.physicsDebug = !this.state.physicsDebug;
            } else {
                this.state.physicsDebug = data.enabled;
            }
        });
    }

   private setupBuildMode(world: World, entityRepo: EntityRepository, physicsFacade: PhysicsFacade): void {
        const folder = this.gui.addFolder('Build Mode');
        const availableBlocks = BlockRegistry.getAvailableBlocks();
        availableBlocks['Billboard (Entity)'] = 999; 

        folder.add(this.state, 'buildMode').name('Enable Build Mode').onChange((value: boolean) => {
            globalEventBus.emit("TOGGLE_BUILD_MODE", { enabled: value });
        });

        folder.add(this.state, 'selectedBlockId', availableBlocks).name('Block Type').onChange((value: number) => {
            globalEventBus.emit("SET_BUILD_BLOCK", { id: Number(value) });
        });

        const toolOptions = { 
            'Single Block': 'SINGLE', 
            'Solid Box': 'BOX', 
            'Solid Sphere': 'SPHERE',
            'Dynamic Cut Box': 'DYNAMIC_BOX'
        };
        
        folder.add({ tool: 'SINGLE' }, 'tool', toolOptions).name('Build Tool').onChange((value: string) => {
            globalEventBus.emit("SET_BUILD_TOOL", { tool: value });
        });

        folder.add(this.state, 'sphereRadius', 1, 20, 1).name('Sphere Radius').onChange((value: number) => {
            globalEventBus.emit("SET_SPHERE_RADIUS", { radius: value });
        });

        folder.add(this.state, 'destructionRadius', 1, 10, 1).name('Destruction Radius').onChange((value: number) => {
            this.emitToolSettings();
        });
        
        folder.add(this.state, 'buildCooldownMs', 0, 500, 10).name('Build Cooldown (ms)').onChange((value: number) => {
            this.emitToolSettings();
        });

        folder.add(this.state, 'mineCooldownMs', 0, 500, 10).name('Mine Cooldown (ms)').onChange((value: number) => {
            this.emitToolSettings();
        });

        folder.add({ 
            saveWorld: () => {
                const blob = WorldSerializer.saveWorld(world, entityRepo, physicsFacade);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'portfolio.bin';
                a.click();
                URL.revokeObjectURL(url);
            }
        }, 'saveWorld').name('Export World (.bin)');
    }

    private emitToolSettings(): void {
        globalEventBus.emit("SET_TOOL_SETTINGS", {
            destructionRadius: this.state.destructionRadius,
            buildCooldownMs: this.state.buildCooldownMs,
            mineCooldownMs: this.state.mineCooldownMs
        } as any); 
    }

    private setupProfiler(renderer: WebGPURenderer): void {
        const folder = this.gui.addFolder('GPU Profiler (ms)');
        folder.add(renderer.gpuTimings, 'Total').listen().disable();
        folder.add(renderer.gpuTimings, 'Geometry').listen().disable();
        folder.add(renderer.gpuTimings, 'GTAO').listen().disable();
        folder.add(renderer.gpuTimings, 'Deferred').listen().disable();
        folder.add(renderer.gpuTimings, 'SSGI').listen().disable();
        folder.add(renderer.gpuTimings, 'Composition').listen().disable();
        folder.add(renderer.gpuTimings, 'TAA').listen().disable();
    }

    private setupSSGI(renderer: any): void {
        const folder = this.gui.addFolder('SSGI');
        const config = renderer.ssgiPass.config;
        folder.add(config, 'rayStepSize', 0.01, 1.0).name('Ray Step Size');
        folder.add(config, 'maxSteps', 4, 64, 1).name('Max Steps');
        folder.add(config, 'thickness', 0.01, 2.0).name('Thickness');
        folder.add(config, 'normalSharpness', 1.0, 512.0).name('Normal Sharpness');
        folder.add(config, 'depthSharpness', 1.0, 512.0).name('Depth Sharpness');
        folder.add(config, 'blurRadius', 1.0, 10.0, 1.0).name('Blur Radius');
        folder.add(config, 'blurIterations', 1.0, 10.0, 1.0).name('Blur Iterations');
    }

    private setupGTAO(renderer: any): void {
        const folder = this.gui.addFolder('GTAO');
        const config = renderer.gtaoPass.config;
        folder.add(config, 'radius', 0.05, 5.0).name('Radius');
        folder.add(config, 'falloff', 0.01, 2.0).name('Falloff');
        folder.add(config, 'thickness', 0.01, 2.0).name('Thickness');
        folder.add(config, 'blurRadius', 1.0, 10.0, 1.0).name('Blur Radius');
        folder.add(config, 'blurSharpness', 1.0, 1000.0).name('Blur Sharpness');
        folder.add(config, 'minRadiusPixels', 1.0, 20.0).name('Min Radius Px');
        folder.add(config, 'maxRadiusPixels', 10.0, 512.0).name('Max Radius Px');
        folder.add(config, 'numSlices', 1, 8, 1).name('Num Slices');
        folder.add(config, 'maxSteps', 1, 16, 1).name('Max Steps');
        folder.add(config, 'biasRadians', 0.0, 1.0).name('Bias Radians');
    }

    private setupTAA(renderer: any): void {
        const folder = this.gui.addFolder('TAA');
        const config = renderer.taaPass.config;
        folder.add(config, 'alpha', 0.01, 1.0).name('Alpha');
        folder.add(config, 'vectorSearchRadius', 0, 5, 1).name('Vector Search Radius');
        folder.add(config, 'colorClampRadius', 0, 5, 1).name('Color Clamp Radius');
    }
}