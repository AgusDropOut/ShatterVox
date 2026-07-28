export const vertexShaderSource = `#version 300 es
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;
layout (location = 2) in vec3 aColor;

uniform mat4 u_MVP;

out vec3 vColor;
out vec3 vNormal;

void main() {
    gl_Position = u_MVP * vec4(aPos, 1.0);
    vColor = aColor;
    vNormal = aNormal;
}
`;

export const fragmentShaderSource = `#version 300 es
precision highp float;

in vec3 vColor;
in vec3 vNormal;

out vec4 FragColor;

void main() {
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
    float diff = max(dot(vNormal, lightDir), 0.2); 
    FragColor = vec4(vColor * diff, 1.0);
}
`;