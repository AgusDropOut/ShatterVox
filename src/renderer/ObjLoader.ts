export interface SubMeshData {
    materialName: string;
    indexOffset: number;
    indexCount: number;
}

export interface ParsedModelData {
    positions: Float32Array;
    uvs: Float32Array;
    normals: Float32Array;
    vertexCount: number;
    subMeshes: SubMeshData[];
}

export class ObjLoader {
    public static parse(objText: string): ParsedModelData {
        const positions: number[][] = [];
        const texcoords: number[][] = [];
        const normals: number[][] = [];

        const outPositions: number[] = [];
        const outTexcoords: number[] = [];
        const outNormals: number[] = [];
        
        const subMeshes: SubMeshData[] = [];
        let currentMaterial = "default";
        let currentIndexOffset = 0;
        let currentVertexCount = 0;

        const lines = objText.split('\n');

        for (let line of lines) {
            line = line.trim();
            if (line === '' || line.startsWith('#') || line.startsWith('mtllib') || line.startsWith('o') || line.startsWith('s')) {
                continue;
            }

            const parts = line.split(/\s+/);
            const type = parts[0];

            if (type === 'usemtl') {
                if (currentVertexCount > 0) {
                    subMeshes.push({
                        materialName: currentMaterial,
                        indexOffset: currentIndexOffset,
                        indexCount: currentVertexCount
                    });
                    currentIndexOffset += currentVertexCount;
                    currentVertexCount = 0;
                }
                currentMaterial = parts[1] || "default";
            } else if (type === 'v') {
                positions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
            } else if (type === 'vt') {
                texcoords.push([parseFloat(parts[1]), parseFloat(parts[2])]); 
            } else if (type === 'vn') {
                normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
            } else if (type === 'f') {
                const vertices = parts.slice(1);
                for (let i = 1; i < vertices.length - 1; i++) {
                    this.processVertex(vertices[0], positions, texcoords, normals, outPositions, outTexcoords, outNormals);
                    this.processVertex(vertices[i], positions, texcoords, normals, outPositions, outTexcoords, outNormals);
                    this.processVertex(vertices[i + 1], positions, texcoords, normals, outPositions, outTexcoords, outNormals);
                    currentVertexCount += 3;
                }
            }
        }

        if (currentVertexCount > 0) {
            subMeshes.push({
                materialName: currentMaterial,
                indexOffset: currentIndexOffset,
                indexCount: currentVertexCount
            });
        }

        return {
            positions: new Float32Array(outPositions),
            uvs: new Float32Array(outTexcoords),
            normals: new Float32Array(outNormals),
            vertexCount: outPositions.length / 3,
            subMeshes
        };
    }

    private static processVertex(
        vertexStr: string,
        positions: number[][], texcoords: number[][], normals: number[][],
        outPositions: number[], outTexcoords: number[], outNormals: number[]
    ) {
        const indices = vertexStr.split('/');
        
        const posIdx = parseInt(indices[0]) - 1;
        outPositions.push(...positions[posIdx]);

        if (indices.length > 1 && indices[1] !== '') {
            const uvIdx = parseInt(indices[1]) - 1;
            outTexcoords.push(...texcoords[uvIdx]);
        } else {
            outTexcoords.push(0, 0); 
        }

        if (indices.length > 2) {
            const normIdx = parseInt(indices[2]) - 1;
            outNormals.push(...normals[normIdx]);
        } else {
            outNormals.push(0, 1, 0); 
        }
    }
}