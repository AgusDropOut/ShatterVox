export interface Renderable {
    draw(renderPass: GPURenderPassEncoder): void;
}