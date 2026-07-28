import { Engine } from "./core/Engine";
import RAPIER from "@dimforge/rapier3d-compat";

async function run() {

    await RAPIER.init();
    console.log("Rapier WASM loaded successfully!");


    const engine = new Engine("glcanvas");
    engine.start();
}

run();