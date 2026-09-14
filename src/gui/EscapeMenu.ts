import type { WebGPURenderer } from "../renderer/WebGPURenderer";

export class EscapeMenu {
    private menu: HTMLElement;
    private escapeMain: HTMLElement;
    private helpMenu: HTMLElement;
    
    private ssgiBtn: HTMLElement;
    private taaBtn: HTMLElement;
    private resumeBtn: HTMLElement;
    private helpBtn: HTMLElement;
    private closeHelpBtn: HTMLElement;
    
    private canvas: HTMLCanvasElement;
    private renderer: WebGPURenderer;
    private clickSound = new Audio('/assets/click.ogg');

    constructor(canvas: HTMLCanvasElement, renderer: WebGPURenderer) {
        this.canvas = canvas;
        this.renderer = renderer;
        
        this.menu = document.getElementById('escape-menu') as HTMLElement;
        this.escapeMain = document.getElementById('escape-main') as HTMLElement;
        this.helpMenu = document.getElementById('help-menu') as HTMLElement;
        
        this.ssgiBtn = document.getElementById('toggle-ssgi-btn') as HTMLElement;
        this.taaBtn = document.getElementById('toggle-taa-btn') as HTMLElement;
        this.resumeBtn = document.getElementById('resume-btn') as HTMLElement;
        this.helpBtn = document.getElementById('help-btn') as HTMLElement;
        this.closeHelpBtn = document.getElementById('close-help-btn') as HTMLElement;

        if (!this.menu || !this.ssgiBtn || !this.taaBtn || !this.resumeBtn || !this.helpBtn || !this.closeHelpBtn) return;

        this.updateButtonText();

        this.ssgiBtn.addEventListener('click', () => {
            this.renderer.enableSSGI = !this.renderer.enableSSGI;
            this.updateButtonText();
        });

        this.taaBtn.addEventListener('click', () => {
            this.renderer.enableTAA = !this.renderer.enableTAA;
            this.updateButtonText();
        });

        this.helpBtn.addEventListener('click', () => {
            this.escapeMain.style.display = 'none';
            this.helpMenu.style.display = 'flex';
        });

        this.closeHelpBtn.addEventListener('click', () => {
            this.helpMenu.style.display = 'none';
            this.escapeMain.style.display = 'flex';
        });

        this.resumeBtn.addEventListener('click', () => {
            this.canvas.requestPointerLock();
        });

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                const projOverlay = document.getElementById('project-overlay');
                const bookOverlay = document.getElementById('book-overlay');
                
                const isProjOpen = projOverlay && projOverlay.style.display === 'block';
                const isBookOpen = bookOverlay && bookOverlay.style.display === 'block';

                if (isProjOpen || isBookOpen) return;

                if (this.menu.style.display === 'flex' && this.helpMenu.style.display === 'flex') {
                    this.helpMenu.style.display = 'none';
                    this.escapeMain.style.display = 'flex';
                    this.playClick();
                    return;
                }

                if (document.pointerLockElement === this.canvas) {
                    document.exitPointerLock();
                } else {
                    this.canvas.requestPointerLock();
                }
            }
        });

        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === this.canvas) {
                this.menu.style.display = 'none';
                this.helpMenu.style.display = 'none';
                this.escapeMain.style.display = 'flex';
            } else {
                const projOverlay = document.getElementById('project-overlay');
                const bookOverlay = document.getElementById('book-overlay');

                if ((!projOverlay || projOverlay.style.display !== 'block') && 
                    (!bookOverlay || bookOverlay.style.display !== 'block')) {
                    this.menu.style.display = 'flex';
                }
            }
        });
    }

    private playClick(): void {
        const soundClone = this.clickSound.cloneNode() as HTMLAudioElement;
        soundClone.volume = 0.6;
        soundClone.play().catch(() => {});
    }

    private updateButtonText(): void {
        this.ssgiBtn.innerText = `SSGI: ${this.renderer.enableSSGI ? 'ON' : 'OFF'}`;
        this.taaBtn.innerText = `TAA: ${this.renderer.enableTAA ? 'ON' : 'OFF'}`;
    }
}