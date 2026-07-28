export class GeometryGenerator {
    
   

    static getFrontFace(): Float32Array {
        return new Float32Array([
            -1.0, -1.0,  1.0,   1.0, -1.0,  1.0,   1.0,  1.0,  1.0,
             1.0,  1.0,  1.0,  -1.0,  1.0,  1.0,  -1.0, -1.0,  1.0
        ]);
    }

    static getBackFace(): Float32Array {
        return new Float32Array([
             1.0, -1.0, -1.0,  -1.0, -1.0, -1.0,  -1.0,  1.0, -1.0,
            -1.0,  1.0, -1.0,   1.0,  1.0, -1.0,   1.0, -1.0, -1.0
        ]);
    }

    static getLeftFace(): Float32Array {
        return new Float32Array([
            -1.0, -1.0, -1.0,  -1.0, -1.0,  1.0,  -1.0,  1.0,  1.0,
            -1.0,  1.0,  1.0,  -1.0,  1.0, -1.0,  -1.0, -1.0, -1.0
        ]);
    }

    static getRightFace(): Float32Array {
        return new Float32Array([
             1.0, -1.0,  1.0,   1.0, -1.0, -1.0,   1.0,  1.0, -1.0,
             1.0,  1.0, -1.0,   1.0,  1.0,  1.0,   1.0, -1.0,  1.0
        ]);
    }

    static getTopFace(): Float32Array {
        return new Float32Array([
            -1.0,  1.0,  1.0,   1.0,  1.0,  1.0,   1.0,  1.0, -1.0,
             1.0,  1.0, -1.0,  -1.0,  1.0, -1.0,  -1.0,  1.0,  1.0
        ]);
    }

    static getBottomFace(): Float32Array {
        return new Float32Array([
            -1.0, -1.0, -1.0,   1.0, -1.0, -1.0,   1.0, -1.0,  1.0,
             1.0, -1.0,  1.0,  -1.0, -1.0,  1.0,  -1.0, -1.0, -1.0
        ]);
    }


    static getFrontNormal(): Int8Array {
        return new Int8Array([
            0, 0, 1,   0, 0, 1,   0, 0, 1,
            0, 0, 1,   0, 0, 1,   0, 0, 1
        ]);
    }

    static getBackNormal(): Int8Array {
        return new Int8Array([
            0, 0, -1,  0, 0, -1,  0, 0, -1,
            0, 0, -1,  0, 0, -1,  0, 0, -1
        ]);
    }

    static getLeftNormal(): Int8Array {
        return new Int8Array([
            -1, 0, 0, -1, 0, 0, -1, 0, 0,
            -1, 0, 0, -1, 0, 0, -1, 0, 0
        ]);
    }

    static getRightNormal(): Int8Array {
        return new Int8Array([
            1, 0, 0,   1, 0, 0,   1, 0, 0,
            1, 0, 0,   1, 0, 0,   1, 0, 0
        ]);
    }

    static getTopNormal(): Int8Array {
        return new Int8Array([
            0, 1, 0,   0, 1, 0,   0, 1, 0,
            0, 1, 0,   0, 1, 0,   0, 1, 0
        ]);
    }

    static getBottomNormal(): Int8Array {
        return new Int8Array([
            0, -1, 0,  0, -1, 0,  0, -1, 0,
            0, -1, 0,  0, -1, 0,  0, -1, 0
        ]);
    }

   
    static getCubePositions(): Float32Array {
        const faces = [
            this.getFrontFace(), this.getBackFace(), 
            this.getLeftFace(), this.getRightFace(), 
            this.getTopFace(), this.getBottomFace()
        ];
        
        let totalLength = 0;
        for (const face of faces) totalLength += face.length;

        const buffer = new Float32Array(totalLength);
        let offset = 0;
        for (const face of faces) {
            buffer.set(face, offset); 
            offset += face.length;
        }
        return buffer;
    }

    
    static getCubeNormals(): Int8Array {
        const faces = [
            this.getFrontNormal(), this.getBackNormal(), 
            this.getLeftNormal(), this.getRightNormal(), 
            this.getTopNormal(), this.getBottomNormal()
        ];
        
        let totalLength = 0;
        for (const face of faces) totalLength += face.length;

        const buffer = new Int8Array(totalLength);
        let offset = 0;
        for (const face of faces) {
            buffer.set(face, offset); 
            offset += face.length;
        }
        return buffer;
    }
}