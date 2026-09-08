import { mat4, vec3 } from "gl-matrix";

export type CameraMovement = "FORWARD" | "BACKWARD" | "LEFT" | "RIGHT" | "UP" | "DOWN";

export class Camera {
    public position: vec3;
    public front: vec3;
    public up: vec3;
    public right: vec3;
    public worldUp: vec3;

    public yaw: number;
    public pitch: number;

    public movementSpeed: number;
    public mouseSensitivity: number;

    constructor(
        position: vec3 = vec3.fromValues(0, 0, 0),
        yaw: number = -90.0,
        pitch: number = 0.0
    ) {
        this.position = position;
        this.worldUp = vec3.fromValues(0, 1, 0);
        this.front = vec3.fromValues(0, 0, -1);
        this.up = vec3.create();
        this.right = vec3.create();
        
        this.yaw = yaw;
        this.pitch = pitch;
        this.movementSpeed = 10.0;
        this.mouseSensitivity = 0.1;

        this.updateCameraVectors();
    }


    public getViewMatrix(): mat4 {
        const view = mat4.create();
        const target = vec3.create();
        
        vec3.add(target, this.position, this.front);
        mat4.lookAt(view, this.position, target, this.up);
        
        return view;
    }



    public processKeyboard(direction: CameraMovement, deltaTime: number): void {
        const velocity = this.movementSpeed * deltaTime;
        const temp = vec3.create();

        if (direction === "FORWARD") {
            vec3.scale(temp, this.front, velocity);
            vec3.add(this.position, this.position, temp);
        }
        if (direction === "BACKWARD") {
            vec3.scale(temp, this.front, velocity);
            vec3.sub(this.position, this.position, temp);
        }
        if (direction === "LEFT") {
            vec3.scale(temp, this.right, velocity);
            vec3.sub(this.position, this.position, temp);
        }
        if (direction === "RIGHT") {
            vec3.scale(temp, this.right, velocity);
            vec3.add(this.position, this.position, temp);
        }
        if (direction === "UP") {
            vec3.scale(temp, this.worldUp, velocity);
            vec3.add(this.position, this.position, temp);
        }
        if (direction === "DOWN") {
            vec3.scale(temp, this.worldUp, velocity);
            vec3.sub(this.position, this.position, temp);
        }
    }


    public processMouseMovement(xOffset: number, yOffset: number, constrainPitch: boolean = true): void {
        this.yaw += xOffset * this.mouseSensitivity;
        this.pitch += yOffset * this.mouseSensitivity;

        if (constrainPitch) {
            if (this.pitch > 89.0) this.pitch = 89.0;
            if (this.pitch < -89.0) this.pitch = -89.0;
        }

        this.updateCameraVectors();
    }

    private updateCameraVectors(): void {
        const newFront = vec3.create();
        const yawRad = this.yaw * (Math.PI / 180.0);
        const pitchRad = this.pitch * (Math.PI / 180.0);

        newFront[0] = Math.cos(yawRad) * Math.cos(pitchRad);
        newFront[1] = Math.sin(pitchRad);
        newFront[2] = Math.sin(yawRad) * Math.cos(pitchRad);
        vec3.normalize(this.front, newFront);

        vec3.cross(this.right, this.front, this.worldUp);
        vec3.normalize(this.right, this.right);

        vec3.cross(this.up, this.right, this.front);
        vec3.normalize(this.up, this.up);
    }
}