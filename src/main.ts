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


let loadingInterval: number | null = null;

async function run(highQuality: boolean) {
    try {
        await RAPIER.init();
        const engine = new Engine("glcanvas");
        engine.setGraphicsQuality(highQuality);
     
        await engine.start();
    } catch (error: any) {
      
        if (loadingInterval) clearInterval(loadingInterval);
        
        const loadingBox = document.getElementById("loading-box");
        const loadingPercent = document.getElementById("loading-percent");
        
        if (loadingBox) loadingBox.style.display = 'none';
        
        if (loadingPercent) {
            loadingPercent.style.color = '#ff5555'; 
            loadingPercent.style.fontSize = '18px';
            loadingPercent.style.maxWidth = '500px';
            loadingPercent.style.textAlign = 'center';
            loadingPercent.style.lineHeight = '1.5';
            loadingPercent.style.padding = '20px';
            loadingPercent.style.backgroundColor = 'rgba(0,0,0,0.8)';
            loadingPercent.style.border = '2px solid #ff5555';
           
            loadingPercent.innerText = `CRITICAL ERROR:\n\n${error.message || "Failed to initialize WebGPU. Hardware acceleration might be disabled."}`;
        }
        console.error(error);
    }
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
    loadingInterval = setInterval(() => {
        percent += Math.floor(Math.random() * 15) + 5;
        if (percent > 99) percent = 99; 
        if (loadingPercent) loadingPercent.innerText = percent + '%';
    }, 100) as unknown as number;

    run(highQuality);
};

if (btnQuality && btnPerformance) {
    btnQuality.addEventListener("click", () => startEngine(true));
    btnPerformance.addEventListener("click", () => startEngine(false));
} else {
    run(true); 
}