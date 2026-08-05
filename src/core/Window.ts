import { globalEventBus } from "./EventBus";

export class Window {
    private readonly canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        window.addEventListener("resize", () => this.handleResize());
        window.addEventListener("keydown", (e) => this.handleKeyDown(e));

        this.handleResize();
    }

    private handleResize(): void {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        globalEventBus.emit("WINDOW_RESIZE", { 
            width: this.canvas.width, 
            height: this.canvas.height 
        });
    }

    private handleKeyDown(e: KeyboardEvent): void {
        if (e.code === "KeyP") {
            globalEventBus.emit("TOGGLE_PHYSICS_DEBUG", {});
        }

        if(e.code === "Digit1") {
            globalEventBus.emit("DEBUG_DEPTH", {});
        }

        if(e.code === "Digit2") {
            globalEventBus.emit("DEBUG_NORMALS", {});
        }

        if(e.code === "Digit3") {
            globalEventBus.emit("DEBUG_ALBEDO", {});
        }

    }
}