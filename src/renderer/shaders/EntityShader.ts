// src/renderer/shaders/EntityShader.ts

export const entityVertexShaderSource = `#version 300 es
layout (location = 0) in vec3 a_Position;
layout (location = 1) in vec2 a_TexCoord;
layout (location = 2) in vec3 a_Normal; // Listo por si luego agregas luz direccional

uniform mat4 u_MVP;

out vec2 v_TexCoord;

void main() {
    v_TexCoord = a_TexCoord;
    gl_Position = u_MVP * vec4(a_Position, 1.0);
}
`;

export const entityFragmentShaderSource = `#version 300 es
precision highp float;

in vec2 v_TexCoord;
out vec4 FragColor;

uniform sampler2D u_Texture;

void main() {
    vec4 texColor = texture(u_Texture, v_TexCoord);
    
    // Si la textura tiene zonas transparentes, las descartamos
    if(texColor.a < 0.1) {
        discard;
    }
    
    FragColor = texColor;
}
`;