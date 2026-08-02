function evaluateDynamicDetachment(debriId: number, blocks: Uint8Array, WIDTH: number, HEIGHT: number, DEPTH: number) {
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
                    }
                }


                if (airBlocks >= 5) {
                    detachedBlocks.push([x, y, z, currentBlockId]);
                }
            }
        }
    }
    console.log(`[DetachmentWorker] Detachment evaluation complete for debri ID: ${debriId}. Detached blocks count: ${detachedBlocks.length}`);
    console.log(`[DetachmentWorker] ID: ${debriId}. Detached: ${detachedBlocks.length}`);
    self.postMessage({ 
        type: 'DETACHMENT_RESULT_DYNAMIC', 
        debriId, 
        detachedBlocks 
    });
}

function evaluateStaticDetachment(chunks: { chunkX: number, chunkY: number, chunkZ: number, blocks: Uint8Array, WIDTH: number, HEIGHT: number, DEPTH: number }[]) {
    const detachedBlocks: { chunkX: number, chunkY: number, chunkZ: number, blocks: number[][] }[] = [];

    for (const chunk of chunks) {
        const { chunkX, chunkY, chunkZ, blocks } = chunk;
        const chunkDetachedBlocks: number[][] = [];

        for (let z = 0; z < chunk.DEPTH; z++) {
            for (let y = 0; y < chunk.HEIGHT; y++) {
                for (let x = 0; x < chunk.WIDTH; x++) {
                    const idx = getIndex(x, y, z, chunk.WIDTH, chunk.HEIGHT);
                    const currentBlockId = blocks[idx];

                    if (currentBlockId === 0) continue;

                    if(y === 0 || y - 1 === 0) continue; 

                    let airBlocks = 0;
                    const neighborOffsets = [
                        [1, 0, 0], [-1, 0, 0],
                        [0, 1, 0], [0, -1, 0],
                        [0, 0, 1], [0, 0, -1]
                    ];

                    for (const [dx, dy, dz] of neighborOffsets) {
                        const nx = x + dx;
                        const ny = y + dy;
                        const nz = z + dz;

                        if (!inBounds(nx, ny, nz, chunk.WIDTH, chunk.HEIGHT, chunk.DEPTH)) {
                            airBlocks++;
                            continue;
                        }

                        const nIdx = getIndex(nx, ny, nz, chunk.WIDTH, chunk.HEIGHT);
                        if (blocks[nIdx] === 0) {
                            airBlocks++;
                        }
                    }

                    if (airBlocks >= 4) {
                        chunkDetachedBlocks.push([x, y, z, currentBlockId]);
                    }
                }
            }
        }

        if (chunkDetachedBlocks.length > 0) {
            detachedBlocks.push({ chunkX, chunkY, chunkZ, blocks: chunkDetachedBlocks });
        }
    }

    console.log(`[DetachmentWorker] Static detachment evaluation complete. Total detached chunks: ${detachedBlocks.length}`);
    self.postMessage({
        type: 'DETACHMENT_RESULT_STATIC',
        detachedBlocks
    });
}

function inBounds(x: number, y: number, z: number, WIDTH: number, HEIGHT: number, DEPTH: number): boolean {
    return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && z >= 0 && z < DEPTH;
}

function getIndex(x: number, y: number, z: number, WIDTH: number, HEIGHT: number): number {
    return z * WIDTH * HEIGHT + y * WIDTH + x;
}


self.onmessage = (e: MessageEvent) => {
    if (e.data.type === 'PERIODIC_DYNAMIC_DETACHMENT_CHECK') {
        const data = e.data;
        console.log(`[DetachmentWorker] Received periodic detachment check for debri ID: ${data.debriId}`);
        evaluateDynamicDetachment(data.debriId, data.blocks, data.WIDTH, data.HEIGHT, data.DEPTH);
    } else if (e.data.type === 'PERIODIC_STATIC_DETACHMENT_CHECK') {
        const data = e.data;
        console.log(`[DetachmentWorker] Received periodic static detachment check for chunk at (${data.chunks[0].chunkX}, ${data.chunks[0].chunkY}, ${data.chunks[0].chunkZ})`);
        evaluateStaticDetachment(data.chunks);
    } 
};