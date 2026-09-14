import type { WebGPURenderer } from "../renderer/WebGPURenderer";

export class EscapeMenu {
    private menu: HTMLElement;
    private ssgiToggle: HTMLInputElement;
    private taaToggle: HTMLInputElement;
    private resumeBtn: HTMLElement;
    private canvas: HTMLCanvasElement;
    private renderer: WebGPURenderer;

    constructor(canvas: HTMLCanvasElement, renderer: WebGPURenderer) {
        this.canvas = canvas;
        this.renderer = renderer;
        
        this.menu = document.getElementById('escape-menu') as HTMLElement;
        this.ssgiToggle = document.getElementById('toggle-ssgi') as HTMLInputElement;
        this.taaToggle = document.getElementById('toggle-taa') as HTMLInputElement;
        this.resumeBtn = document.getElementById('resume-btn') as HTMLElement;

        if (!this.menu || !this.ssgiToggle || !this.taaToggle || !this.resumeBtn) return;

        this.ssgiToggle.checked = this.renderer.enableSSGI;
        this.taaToggle.checked = this.renderer.enableTAA;

        this.ssgiToggle.addEventListener('change', (e) => {
            this.renderer.enableSSGI = (e.target as HTMLInputElement).checked;
        });

        this.taaToggle.addEventListener('change', (e) => {
            this.renderer.enableTAA = (e.target as HTMLInputElement).checked;
        });

        this.resumeBtn.addEventListener('click', () => {
            this.canvas.requestPointerLock();
        });

        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === this.canvas) {
                this.menu.style.display = 'none';
            } else {
                const projOverlay = document.getElementById('project-overlay');
                const bookOverlay = document.getElementById('book-overlay');
                const isProjOpen = projOverlay && projOverlay.style.display === 'block';
                const isBookOpen = bookOverlay && bookOverlay.style.display === 'block';

                if (!isProjOpen && !isBookOpen) {
                    this.menu.style.display = 'flex';
                }
            }
        });
    }
}