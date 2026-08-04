export class Input {
    private readonly canvas: HTMLCanvasElement;
    private readonly keys: Set<string>;
    
    private deltaX: number = 0;
    private deltaY: number = 0;
    
    public isLocked: boolean = false;

  
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.keys = new Set();

        this.attachListeners();
    }

  
    public isKeyPressed(keyCode: string): boolean {
        return this.keys.has(keyCode);
    }

    
    public consumeMouseDeltas(): { x: number; y: number } {
        const deltas = { x: this.deltaX, y: this.deltaY };
        this.deltaX = 0;
        this.deltaY = 0;
        return deltas;
    }

    private attachListeners(): void {
        window.addEventListener("keydown", (e) => this.keys.add(e.code));
        window.addEventListener("keyup", (e) => this.keys.delete(e.code));

     
        this.canvas.addEventListener("click", () => {
            if (!this.isLocked) {
              
                this.canvas.requestPointerLock().catch((err) => {
                    console.warn("No se pudo bloquear el puntero (hacé clic en el juego primero).");
                });
            }
        });

      
        document.addEventListener("pointerlockchange", () => {
            this.isLocked = document.pointerLockElement === this.canvas;
        });

        window.addEventListener("mousemove", (e) => {
            if (!this.isLocked) return;
            this.deltaX += e.movementX;
            this.deltaY -= e.movementY; 
        });
    }
}