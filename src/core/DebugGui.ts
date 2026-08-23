import GUI from 'lil-gui';
import { WebGPURenderer } from '../renderer/WebGPURenderer';

export class DebugGui {
    private gui: GUI;

    constructor(renderer: WebGPURenderer) {
        this.gui = new GUI({ title: 'Engine Debug Settings' });
        this.gui.hide();

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Backquote' || e.code === 'IntlBackslash') {
                this.gui._hidden ? this.gui.show() : this.gui.hide();
            }
        });

        this.setupSSGI(renderer);
        this.setupGTAO(renderer);
        this.setupTAA(renderer);
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
    }

    private setupTAA(renderer: any): void {
        const folder = this.gui.addFolder('TAA');
        const config = renderer.taaPass.config;
        folder.add(config, 'alpha', 0.01, 1.0).name('Alpha');
        folder.add(config, 'vectorSearchRadius', 0, 5, 1).name('Vector Search Radius');
        folder.add(config, 'colorClampRadius', 0, 5, 1).name('Color Clamp Radius');
    }
}