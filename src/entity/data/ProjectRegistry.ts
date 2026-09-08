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
    }
};