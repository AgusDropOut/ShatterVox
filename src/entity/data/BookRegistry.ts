export interface BookData {
    title: string;
    content: string;
    color: [number, number, number];
    mass: number;
    scale: [number, number, number];
    renderModel: string;
}

export const BookRegistry: Record<string, BookData> = {
    "book_1": {
        title: "Myself",
        content: "My name is Agus, I live in Argentina. Currently finishing my software engineering degree. I love cubes, physics, and programming. I am the creator of this engine. Hope you enjoy it!",
        color: [0.8, 0.1, 0.1],
        mass: 2.0,
        scale: [0.25, 0.25, 0.25],
        renderModel: "book_model"
    },
    "book_2": {
        title: "Graphics Programming",
        content: "There is something magical about graphics programming. The ability to create experiencies using just maths and code is fascinating. I love to learn about graphics programming, and I hope to become a graphics programmer in the future.",
        color: [0.8, 0.1, 0.1],
        mass: 2.0,
        scale: [0.25, 0.25, 0.25],
        renderModel: "book_model_1"
    },
    
};