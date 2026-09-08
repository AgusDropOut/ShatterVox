function evaluateDynamicDetachment(debriId: number, blocks: Uint8Array, WIDTH: number, HEIGHT: number, DEPTH: number) {
    if(blocks.length <= 2) {
        self.postMessage({ type: 'DETACHMENT_RESULT_DYNAMIC', debriId, detachedBlocks: [] });
        return;
    }

    const detachedBlocks: number[][] = []; 
    const neighborOffsets = [
        [1, 0, 0], [-1, 0, 0],
        [0, 1, 0], [0, -1, 0],
        [0, 0, 1], [0, 0, -1]   
    ];

    for (let z = 0; z < DEPTH; z++) {
        for (let y = 0; y < HEIGHT; y++) {
            for (let x = 0; x < WIDTH; x++) {
                const idx = getIndex(x, y, z, WIDTH, HEIGHT);
                const currentBlockId = blocks[idx];

                if (currentBlockId === 0) continue;

                let airBlocks = 0;
                let supportBelow = false;

                for (const [dx, dy, dz] of neighborOffsets) {
                    const nx = x + dx;
                    const ny = y + dy;
                    const nz = z + dz;
                    
                    if (!inBounds(nx, ny, nz, WIDTH, HEIGHT, DEPTH)) {
                        airBlocks++;
                        continue;
                    }
                    
                    const nIdx = getIndex(nx, ny, nz, WIDTH, HEIGHT);
                    if (blocks[nIdx] === 0) {
                        airBlocks++;
                    } else if (dy === -1) {
                        supportBelow = true;
                    }
                }

    
                if (airBlocks >= 6 || (airBlocks === 5 && !supportBelow)) {
                    detachedBlocks.push([x, y, z, currentBlockId]);
                }
            }
        }
    }

    self.postMessage({ type: 'DETACHMENT_RESULT_DYNAMIC', debriId, detachedBlocks });
}

function evaluateStaticDetachment(chunks: { chunkX: number, chunkY: number, chunkZ: number, blocks: Uint8Array, WIDTH: number, HEIGHT: number, DEPTH: number }[]) {
    const detachedBlocks: { chunkX: number, chunkY: number, chunkZ: number, blocks: number[][] }[] = [];

    for (const chunk of chunks) {
        const { chunkX, chunkY, chunkZ, blocks, WIDTH, HEIGHT, DEPTH } = chunk;
        const chunkDetachedBlocks: number[][] = [];
        const visited = new Uint8Array(WIDTH * HEIGHT * DEPTH);

        for (let z = 0; z < DEPTH; z++) {
            for (let y = 0; y < HEIGHT; y++) {
                for (let x = 0; x < WIDTH; x++) {
                    const idx = getIndex(x, y, z, WIDTH, HEIGHT);
                    const currentBlockId = blocks[idx];

                    if (currentBlockId === 0 || visited[idx] === 1) continue;

    
                    const queue: number[][] = [[x, y, z, currentBlockId]];
                    let head = 0;
                    const island: number[][] = [];
                    let touchesBoundary = false;

                    visited[idx] = 1;

                    while (head < queue.length) {
                        const [cx, cy, cz, bId] = queue[head++];
                        island.push([cx, cy, cz, bId]);

                        if (cx === 0 || cx === WIDTH - 1 || 
                            cy === 0 || cy === HEIGHT - 1 || 
                            cz === 0 || cz === DEPTH - 1) {
                            touchesBoundary = true;
                        }

                        const nbs = [
                            [cx + 1, cy, cz], [cx - 1, cy, cz],
                            [cx, cy + 1, cz], [cx, cy - 1, cz],
                            [cx, cy, cz + 1], [cx, cy, cz - 1]
                        ];

                        for (const [nx, ny, nz] of nbs) {
                            if (!inBounds(nx, ny, nz, WIDTH, HEIGHT, DEPTH)) continue;
                            const nIdx = getIndex(nx, ny, nz, WIDTH, HEIGHT);
                            
                            if (visited[nIdx] === 0 && blocks[nIdx] !== 0) {
                                visited[nIdx] = 1;
                                queue.push([nx, ny, nz, blocks[nIdx]]);
                            }
                        }
                    }

             
                    if (!touchesBoundary) {
                        for (let i = 0; i < island.length; i++) {
                            chunkDetachedBlocks.push(island[i]);
                        }
                    }
                }
            }
        }

        if (chunkDetachedBlocks.length > 0) {
            detachedBlocks.push({ chunkX, chunkY, chunkZ, blocks: chunkDetachedBlocks });
        }
    }

    self.postMessage({ type: 'DETACHMENT_RESULT_STATIC', detachedBlocks });
}

function inBounds(x: number, y: number, z: number, WIDTH: number, HEIGHT: number, DEPTH: number): boolean {
    return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && z >= 0 && z < DEPTH;
}

function getIndex(x: number, y: number, z: number, WIDTH: number, HEIGHT: number): number {
    return z * WIDTH * HEIGHT + y * WIDTH + x;
}

self.onmessage = (e: MessageEvent) => {
    if (e.data.type === 'PERIODIC_DYNAMIC_DETACHMENT_CHECK') {
        evaluateDynamicDetachment(e.data.debriId, e.data.blocks, e.data.WIDTH, e.data.HEIGHT, e.data.DEPTH);
    } else if (e.data.type === 'PERIODIC_STATIC_DETACHMENT_CHECK') {
        evaluateStaticDetachment(e.data.chunks);
    } 
};