export interface ProjectData {
    title: string;
    description: string;
    link: string;
}

export const ProjectRegistry: Record<string, ProjectData> = {
    "billboard": {
        title: "Bloody Hell! - The Mod",
        description: "A massive game overhaul built in Java using the Forge API. It expands the base game by adding custom dimensions, complex entity behaviors, and advanced mechanics.",
        link: "https://www.curseforge.com/minecraft/mc-mods/bloody-hell"
    },
    "billboard-1": {
        title: "Bloody Hell! - Under the Hood",
        description: "Heavy focus on OOP and event-driven architecture. Includes custom rendering pipelines using BlockEntityRenderers, state management, and optimized particle generation.",
        link: "https://www.curseforge.com/minecraft/mc-mods/bloody-hell"
    },
    "billboard-2": {
        title: "Cosmos Engine",
        description: "A custom shader editor and graphics programming tool built for Minecraft dev. Runs on TypeScript, Three.js, and Electron. It features a custom graph-node compiler to explore low-level rendering without the headache.",
        link: "https://github.com/AgusDropOut/cosmos"
    },
    "billboard-3": {
        title: "Particle Simulation",
        description: "A high-performance C++ and OpenGL particle simulator. Handles massive amounts of concurrent particles in real-time using instanced rendering, heavy multithreading, and spatial partitioning for lightning-fast collisions.",
        link: "https://github.com/AgusDropOut/ParticleSimulation"
    }
};