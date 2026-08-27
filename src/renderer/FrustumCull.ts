
import {mat4, vec4, vec3} from "gl-matrix";
export class FrustumCull {
    private viewProjMat : mat4;
    private leftPlane: vec4;
    private rightPlane: vec4;
    private lowerPlane: vec4;
    private upperPlane: vec4;
    private nearPlane: vec4;
    private farPlane: vec4;
    private planes: vec4[];

    constructor() {
        this.viewProjMat = mat4.create();
        this.leftPlane = vec4.create();
        this.rightPlane = vec4.create();
        this.lowerPlane = vec4.create();
        this.upperPlane = vec4.create();
        this.nearPlane = vec4.create();
        this.farPlane = vec4.create();

        this.planes = [
            this.leftPlane, this.rightPlane, this.lowerPlane, 
            this.upperPlane, this.nearPlane, this.farPlane
        ];
    }

    public updateViewProjMatrix(viewProjMat: mat4) {
        // w + x
        this.leftPlane[0] = viewProjMat[3] + viewProjMat[0];
        this.leftPlane[1] = viewProjMat[7] + viewProjMat[4];
        this.leftPlane[2] = viewProjMat[11] + viewProjMat[8];
        this.leftPlane[3] = viewProjMat[15] + viewProjMat[12];

        // w - x
        this.rightPlane[0] = viewProjMat[3] - viewProjMat[0];
        this.rightPlane[1] = viewProjMat[7] - viewProjMat[4];
        this.rightPlane[2] = viewProjMat[11] - viewProjMat[8];
        this.rightPlane[3] = viewProjMat[15] - viewProjMat[12];

        // w + y
        this.lowerPlane[0] = viewProjMat[3] + viewProjMat[1];
        this.lowerPlane[1] = viewProjMat[7] + viewProjMat[5];
        this.lowerPlane[2] = viewProjMat[11] + viewProjMat[9];
        this.lowerPlane[3] = viewProjMat[15] + viewProjMat[13];

        // w - y
        this.upperPlane[0] = viewProjMat[3] - viewProjMat[1];
        this.upperPlane[1] = viewProjMat[7] - viewProjMat[5];
        this.upperPlane[2] = viewProjMat[11] - viewProjMat[9];
        this.upperPlane[3] = viewProjMat[15] - viewProjMat[13];

        // Range Z WebGPU [0, 1]
        this.nearPlane[0] = viewProjMat[2];
        this.nearPlane[1] = viewProjMat[6];
        this.nearPlane[2] = viewProjMat[10];
        this.nearPlane[3] = viewProjMat[14];

        // w - z
        this.farPlane[0] = viewProjMat[3] - viewProjMat[2];
        this.farPlane[1] = viewProjMat[7] - viewProjMat[6];
        this.farPlane[2] = viewProjMat[11] - viewProjMat[10];
        this.farPlane[3] = viewProjMat[15] - viewProjMat[14];

        let len = this.vectorLength(this.leftPlane);
        if (len > 0) {
            vec4.scale(this.leftPlane, this.leftPlane, 1.0 / len);
        }

        len = this.vectorLength(this.rightPlane);
        if (len > 0) {
            vec4.scale(this.rightPlane, this.rightPlane, 1.0 / len);
        }

        len = this.vectorLength(this.lowerPlane);
        if (len > 0) {
            vec4.scale(this.lowerPlane, this.lowerPlane, 1.0 / len);
        }

        len = this.vectorLength(this.upperPlane);
        if (len > 0) {
            vec4.scale(this.upperPlane, this.upperPlane, 1.0 / len);
        }

        len = this.vectorLength(this.nearPlane);
        if (len > 0) {
            vec4.scale(this.nearPlane, this.nearPlane, 1.0 / len);
        }

        len = this.vectorLength(this.farPlane);
        if (len > 0) {
            vec4.scale(this.farPlane, this.farPlane, 1.0 / len);
        }

        

    }

    public isFrustumCulled(center : vec3, radius: number){
        for (let i = 0; i < 6; i++) {
            const plane = this.planes[i];
            const distance = plane[0] * center[0] + plane[1] * center[1] + plane[2] * center[2] + plane[3];

            if (distance < -radius) return true;
        }
        return false;
    }

    private vectorLength(v: vec4){
        let a = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
        return Math.sqrt(a);
    }
}