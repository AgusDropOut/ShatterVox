import GUI from 'lil-gui';
import { WebGPURenderer } from '../renderer/WebGPURenderer';
import { globalEventBus } from './EventBus';
import { BlockRegistry } from '../block/BlockRegistry';
import { WorldSerializer } from '../world/WorldSerializer';
import type { World } from '../world/World';
import type { EntityRepository } from '../entity/EntityRepository';
import { PhysicsFacade } from '../physics/PhysicsFacade';
import { PlayerController } from './PlayerController';
import { ProjectRegistry } from '../entity/data/ProjectRegistry';

export class DebugGui {
    private gui: GUI;
    private profilerPanel: HTMLDivElement;

    public state = {
        activeView: 'None',
        physicsDebug: false,
        buildMode: false,
        selectedBlockId: 1,
        sphereRadius: 3,
        destructionRadius: 3,
        mineCooldownMs: 100,
        buildCooldownMs: 100,
        selectedThrowable: 'bomb'
    };

    constructor(
        renderer: WebGPURenderer, 
        world: World, 
        entityRepo: EntityRepository, 
        physicsFacade: PhysicsFacade, 
        player?: PlayerController
    ) {
        this.gui = new GUI({ title: 'Engine Debug Settings' });
        this.gui.hide();

        this.profilerPanel = this.createDedicatedProfilerWindow(physicsFacade);
        this.profilerPanel.style.display = 'none';

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Backquote' || e.code === 'IntlBackslash') {
                const shouldShow = this.gui._hidden;
                if (shouldShow) {
                    this.gui.show();
                    this.profilerPanel.style.display = 'flex';
                } else {
                    this.gui.hide();
                    this.profilerPanel.style.display = 'none';
                }
            }
        });

        this.setupViews();
        if (player) this.setupPlayerInfo(player);
        this.setupGameplay();
        this.setupBuildMode(world, entityRepo, physicsFacade);
        this.setupProfiler(renderer, physicsFacade);
        this.setupSSGI(renderer);
        this.setupGTAO(renderer);
        this.setupTAA(renderer);
        this.setupPostProcess(renderer);
    }

    private createDedicatedProfilerWindow(physicsFacade: PhysicsFacade): HTMLDivElement {
        const panel = document.createElement('div');
        panel.style.position = 'fixed';
        panel.style.top = '10px';
        panel.style.right = '265px';
        panel.style.width = '140px';
        panel.style.boxSizing = 'border-box';
        panel.style.zIndex = '10001';
        panel.style.background = 'rgba(15, 15, 15, 0.9)';
        panel.style.border = '1px solid #333';
        panel.style.borderRadius = '4px';
        panel.style.padding = '6px';
        panel.style.display = 'flex';
        panel.style.flexDirection = 'column';
        panel.style.gap = '4px';
        panel.style.boxShadow = '0 2px 6px rgba(0,0,0,0.5)';
        panel.style.fontFamily = 'monospace';
        panel.style.userSelect = 'none';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.fontSize = '9px';
        header.style.lineHeight = '10px';

        const title = document.createElement('span');
        title.style.color = '#888';
        title.innerText = 'PHYSICS';
        
        const readout = document.createElement('span');
        readout.style.color = '#39ff14';
        readout.innerText = '0.0 ms';

        header.appendChild(title);
        header.appendChild(readout);
        panel.appendChild(header);

        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 32;
        canvas.style.cssText = `
            width: 128px !important;
            height: 32px !important;
            min-width: 128px !important;
            max-width: 128px !important;
            min-height: 32px !important;
            max-height: 32px !important;
            display: block !important;
            background: #0a0a0a;
            border-radius: 2px;
            box-sizing: border-box;
        `;
        panel.appendChild(canvas);

        document.body.appendChild(panel);

        const ctx = canvas.getContext('2d')!;

        const renderGraph = () => {
            if (panel.style.display !== 'none') {
                const history = physicsFacade.physicsHistory;
                const currentMs = physicsFacade.physicsTimings.stepTimeMs;
                
                readout.innerText = `${currentMs.toFixed(1)} ms`;
                readout.style.color = currentMs > 16.67 ? '#ff3b30' : (currentMs > 8.0 ? '#ffcc00' : '#39ff14');

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const maxScale = 33.33;
                const yTarget = canvas.height - (16.67 / maxScale) * canvas.height;

                ctx.strokeStyle = '#262626';
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(0, yTarget);
                ctx.lineTo(canvas.width, yTarget);
                ctx.stroke();
                ctx.setLineDash([]);

                if (history.length > 1) {
                    ctx.strokeStyle = '#39ff14';
                    ctx.lineWidth = 1;
                    ctx.beginPath();

                    const stepX = canvas.width / (60 - 1);
                    for (let i = 0; i < history.length; i++) {
                        const val = Math.min(history[i], maxScale);
                        const y = canvas.height - (val / maxScale) * canvas.height;
                        const x = i * stepX;

                        if (i === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                }
            }

            requestAnimationFrame(renderGraph);
        };

        requestAnimationFrame(renderGraph);

        return panel;
    }

    private setupPlayerInfo(player: PlayerController): void {
        const folder = this.gui.addFolder('Player Info');
        folder.add(player.guiState, 'x').listen().disable();
        folder.add(player.guiState, 'y').listen().disable();
        folder.add(player.guiState, 'z').listen().disable();
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

    private setupGameplay(): void {
        const folder = this.gui.addFolder('Gameplay');
        const throwableOptions = {
            'Standard Bomb': 'bomb',
            'Blackhole Bomb': 'blackhole',
            'Magic Crystal': 'magic_crystal'
        };
        
        folder.add(this.state, 'selectedThrowable', throwableOptions).name('Throwable Item').onChange((value: string) => {
            globalEventBus.emit("SET_THROWABLE", { id: value });
        });
    }

    private setupBuildMode(world: World, entityRepo: EntityRepository, physicsFacade: PhysicsFacade): void {
        const folder = this.gui.addFolder('Build Mode');
        const availableBlocks = BlockRegistry.getAvailableBlocks();
        
        let customIdCounter = 999;
        for (const modelId in ProjectRegistry) {
            availableBlocks[`Billboard: ${ProjectRegistry[modelId].title}`] = customIdCounter;
            customIdCounter--;
        }

        folder.add(this.state, 'buildMode').name('Enable Build Mode').onChange((value: boolean) => {
            globalEventBus.emit("TOGGLE_BUILD_MODE", { enabled: value });
        });

        folder.add(this.state, 'selectedBlockId', availableBlocks).name('Block Type').onChange((value: number) => {
            globalEventBus.emit("SET_BUILD_BLOCK", { id: Number(value) });
        });

        const toolOptions = { 
            'Single Block': 'SINGLE', 
            'Solid Box': 'BOX', 
            'Sculpt Sphere': 'SPHERE',
            'Sculpt Dynamite': 'DYNAMITE',
            'Sculpt Smooth': 'SMOOTH',
            'Cut Box': 'CUT_BOX',
            'Dynamic Cut Box': 'DYNAMIC_BOX'
        };
        
        folder.add({ tool: 'SINGLE' }, 'tool', toolOptions).name('Build Tool').onChange((value: string) => {
            globalEventBus.emit("SET_BUILD_TOOL", { tool: value });
        });

        folder.add(this.state, 'sphereRadius', 1, 20, 1).name('Sculpt Radius').onChange((value: number) => {
            globalEventBus.emit("SET_SPHERE_RADIUS", { radius: value });
        });

        folder.add(this.state, 'destructionRadius', 1, 10, 1).name('Click Destruct Radius').onChange((value: number) => {
            this.emitToolSettings();
        });
        
        folder.add(this.state, 'buildCooldownMs', 0, 500, 10).name('Right Click Delay(ms)').onChange((value: number) => {
            this.emitToolSettings();
        });

        folder.add(this.state, 'mineCooldownMs', 0, 500, 10).name('Left Click Delay(ms)').onChange((value: number) => {
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

    private setupProfiler(renderer: WebGPURenderer, physicsFacade?: PhysicsFacade): void {
        const folder = this.gui.addFolder('Profiler');

        if (physicsFacade) {
            folder.add(physicsFacade.physicsTimings, 'stepTimeMs')
                .name('Physics Step (ms)')
                .listen()
                .disable();
        }

        folder.add(renderer.gpuTimings, 'Total').listen().disable();
        folder.add(renderer.gpuTimings, 'Geometry').listen().disable();
        folder.add(renderer.gpuTimings, 'GTAO').listen().disable();
        folder.add(renderer.gpuTimings, 'Deferred').listen().disable();
        folder.add(renderer.gpuTimings, 'SSGI').listen().disable();
        folder.add(renderer.gpuTimings, 'Composition').listen().disable();
        folder.add(renderer.gpuTimings, 'TAA').listen().disable();
        folder.add(renderer.gpuTimings, 'PostProcess').listen().disable();
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

    private setupPostProcess(renderer: any): void {
        const folder = this.gui.addFolder('Post Process');
        const config = renderer.postProcessPass.config;
        folder.add(config, 'exposure', 0.1, 5.0).name('Exposure');
        folder.add(config, 'gamma', 1.0, 3.0).name('Gamma');
        folder.add(config, 'contrast', 0.5, 2.0).name('Contrast');
        folder.add(config, 'saturation', 0.0, 3.0).name('Saturation');
        folder.add(config, 'toneMappingMethod', { 'None': 0, 'ACES': 1, 'Reinhard': 2 }).name('Tone Mapping');
    }
}