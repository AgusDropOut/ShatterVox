import { Engine } from "./core/Engine";
import RAPIER from "@dimforge/rapier3d-compat";
import { globalEventBus } from "./core/EventBus";

const overlay = document.getElementById("project-overlay");
const title = document.getElementById("project-title");
const desc = document.getElementById("project-desc");
const link = document.getElementById("project-link") as HTMLAnchorElement;
const closeBtn = document.getElementById("close-overlay");

const bookOverlay = document.getElementById("book-overlay");
const bookTitle = document.getElementById("book-title");
const bookContent = document.getElementById("book-content");
const closeBookBtn = document.getElementById("close-book");

globalEventBus.on("SHOW_OVERLAY", (payload) => {
    if (!overlay || !title || !desc || !link) return;
    
    title.innerText = payload.data.title;
    desc.innerText = payload.data.description;
    link.href = payload.data.link;
    
    overlay.style.display = "block";
    document.exitPointerLock(); 
});

globalEventBus.on("SHOW_BOOK", (payload) => {
    if (!bookOverlay || !bookTitle || !bookContent) return;
    
    bookTitle.innerText = payload.title;
    bookContent.innerText = payload.content;
    
    bookOverlay.style.display = "block";
    document.exitPointerLock();
});

if (closeBtn && overlay) {
    closeBtn.addEventListener("click", () => {
        overlay.style.display = "none";
    });
}

if (closeBookBtn && bookOverlay) {
    closeBookBtn.addEventListener("click", () => {
        bookOverlay.style.display = "none";
    });
}
async function run(highQuality: boolean) {
    await RAPIER.init();
    const engine = new Engine("glcanvas");
    engine.setGraphicsQuality(highQuality);
    engine.start();
}

const btnQuality = document.getElementById("btn-quality");
const btnPerformance = document.getElementById("btn-performance");
const promptUi = document.getElementById("graphics-prompt");
const loadingBox = document.getElementById("loading-box");
const loadingPercent = document.getElementById("loading-percent");

const startEngine = (highQuality: boolean) => {
   
    if (promptUi) promptUi.style.display = 'none';
    if (loadingBox) loadingBox.style.display = 'block';
    if (loadingPercent) loadingPercent.style.display = 'block';

   
    let percent = 0;
    const interval = setInterval(() => {
        percent += Math.floor(Math.random() * 15) + 5;
        if (percent > 100) percent = 100;
        if (loadingPercent) loadingPercent.innerText = percent + '%';
        if (percent === 100) clearInterval(interval);
    }, 100);

   
    run(highQuality);
};


if (btnQuality && btnPerformance) {
    btnQuality.addEventListener("click", () => startEngine(true));
    btnPerformance.addEventListener("click", () => startEngine(false));
} else {
    run(true); 
}