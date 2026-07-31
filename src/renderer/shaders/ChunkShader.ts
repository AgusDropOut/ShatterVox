export const vertexShaderSource = `#version 300 es
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;
layout (location = 2) in vec3 aColor;
layout (location = 3) in vec2 aUv;

uniform mat4 u_MVP;

out vec3 vColor;
out vec3 vNormal;
out vec2 vUv;

void main() {
    gl_Position = u_MVP * vec4(aPos, 1.0);
    vColor = aColor;
    vNormal = aNormal;
    vUv = aUv;
}
`;

export const fragmentShaderSource = `#version 300 es
precision highp float;

in vec3 vColor;
in vec3 vNormal;
in vec2 vUv;

uniform sampler2D u_Texture;

out vec4 FragColor;

void main() {
    vec3 ambient = vec3(0.2, 0.2, 0.2);
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
    float diff = max(dot(vNormal, lightDir), 0.2); 
    

    vec4 texColor = texture(u_Texture, vUv);

    if(texColor.a < 0.1) {
        discard; 
    }
    

 
    FragColor = vec4(vColor * diff + ambient, 1.0) * texColor;
}
`;