import {vec3} from "gl-matrix"

export interface Cullable{
    getRadius():number;
    getCenter():vec3;
}