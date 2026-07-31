import { Chunk } from "../world/Chunk";

const WIDTH = Chunk.WIDTH;
const HEIGHT = Chunk.HEIGHT;
const DEPTH = Chunk.DEPTH;

function inBounds(x: number, y: number, z: number, size: number): boolean {
    return x >= 0 && x < size && y >= 0 && y < size && z >= 0 && z < size;
}

function getIndex(x: number, y: number, z: number, size: number): number {
    return x + (y * size) + (z * size * size);
}

function getBlock(blocks: Uint8Array, x: number, y: number, z: number, size: number): number {
    if (!inBounds(x, y, z, size)) return 0;
    return blocks[getIndex(x, y, z, size)];
}

function checkStaticSupport(data: any): void {
    const { blocks, size, minX, minY, minZ } = data;
        const visitedGlobal = new Uint8Array(size * size * size);
        const detachedIslands: number[][][] = [];

        for (let z = 0; z < size; z++) {
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const idx = getIndex(x, y, z, size);
                    if (visitedGlobal[idx] === 1) continue;

                    const blockId = getBlock(blocks, x, y, z, size);
                    if (blockId === 0) continue;

                   
                    const queue: number[][] = [[x, y, z, blockId]];
                    let head = 0;
                    const islandBlocks: number[][] = [];
                    let isAnchored = false;

                    visitedGlobal[idx] = 1;

                    while (head < queue.length) {
                        const [cx, cy, cz, bId] = queue[head++];
                        islandBlocks.push([cx, cy, cz, bId]);

                        const absoluteY = cy + minY;
                        if (absoluteY <= 0) {
                            isAnchored = true;
                        }

                        const nbs = [
                            [cx + 1, cy, cz], [cx - 1, cy, cz],
                            [cx, cy + 1, cz], [cx, cy - 1, cz],
                            [cx, cy, cz + 1], [cx, cy, cz - 1]
                        ];

                        for (const [vx, vy, vz] of nbs) {
                            if (!inBounds(vx, vy, vz, size)) continue;
                            const vIdx = getIndex(vx, vy, vz, size);
                            if (visitedGlobal[vIdx] === 1) continue;

                            const vId = getBlock(blocks, vx, vy, vz, size);
                            if (vId !== 0) {
                                visitedGlobal[vIdx] = 1;
                                queue.push([vx, vy, vz, vId]);
                            }
                        }
                    }

              
                    if (!isAnchored) {
                        detachedIslands.push(islandBlocks);
                    }
                }
            }
        }

        self.postMessage({ type: 'STATIC_CHECK_RESULT', detachedBlocks: detachedIslands, minX, minY, minZ });
    }

function evaluateShatter(data: any): void {
    const { debriId, blocks, rx, ry, rz } = data;
        const neighbors = [
            [rx + 1, ry, rz], [rx - 1, ry, rz],
            [rx, ry + 1, rz], [rx, ry - 1, rz],
            [rx, ry, rz + 1], [rx, ry, rz - 1]
        ];

        const validNeighbors: number[][] = [];
        for (const [nx, ny, nz] of neighbors) {
            if (getBlock(blocks, nx, ny, nz, WIDTH) !== 0) {
                validNeighbors.push([nx, ny, nz]);
            }
        }

        if (validNeighbors.length <= 1) {
            self.postMessage({ type: 'SHATTER_RESULT', debriId, islands: [] });
            return;
        }

        const visitedGlobal = new Uint8Array(WIDTH * HEIGHT * DEPTH);
        const islands: number[][][] = []; 

        for (const [nx, ny, nz] of validNeighbors) {
            const startIdx = getIndex(nx, ny, nz, WIDTH);
            if (visitedGlobal[startIdx] === 1) continue;

            const startId = getBlock(blocks, nx, ny, nz, WIDTH);
            const queue: number[][] = [[nx, ny, nz, startId]];
            let head = 0;
            
            const islandBlocks: number[][] = [];
            visitedGlobal[startIdx] = 1;

            while (head < queue.length) {
                const [cx, cy, cz, blockId] = queue[head++];
                islandBlocks.push([cx, cy, cz, blockId]);

                const nbs = [
                    [cx + 1, cy, cz], [cx - 1, cy, cz],
                    [cx, cy + 1, cz], [cx, cy - 1, cz],
                    [cx, cy, cz + 1], [cx, cy, cz - 1]
                ];

                for (const [vx, vy, vz] of nbs) {
                    if (!inBounds(vx, vy, vz, WIDTH)) continue;
                    
                    const vIdx = getIndex(vx, vy, vz, WIDTH);
                    if (visitedGlobal[vIdx] === 1) continue;

                    const vId = getBlock(blocks, vx, vy, vz, WIDTH);
                    if (vId !== 0) {
                        visitedGlobal[vIdx] = 1;
                        queue.push([vx, vy, vz, vId]);
                    }
                }
            }
            islands.push(islandBlocks);
        }

        self.postMessage({ type: 'SHATTER_RESULT', debriId, islands });
}

self.onmessage = (e: MessageEvent) => {
    const data = e.data;

  
    if (data.type === 'EVALUATE_SHATTER') {
        evaluateShatter(data);
    }

  
    else if (data.type === 'CHECK_STATIC_SUPPORT') {
        checkStaticSupport(data);
    }

    
};