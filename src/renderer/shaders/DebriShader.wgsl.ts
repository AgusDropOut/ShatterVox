export const debriShaderWGSL = `
    struct Camera {
        viewProj: mat4x4<f32>,
    };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var textureSampler: sampler;
    @group(0) @binding(2) var atlasTexture: texture_2d<f32>;

    struct DebriData {
        matrix: mat4x4<f32>,
    };
    @group(1) @binding(0) var<storage, read> debriBuffer: array<DebriData>;

    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
        @location(1) color: vec3<f32>,
        @location(2) normal: vec3<f32>,
    };

    @vertex
    fn vs_main(
        @location(0) pos: vec3<f32>,
        @location(1) norm: vec3<f32>,
        @location(2) col: vec3<f32>,
        @location(3) uv: vec2<f32>,
        @builtin(instance_index) instanceIndex: u32
    ) -> VertexOutput {
        var out: VertexOutput;
        let modelMatrix = debriBuffer[instanceIndex].matrix;
        out.position = camera.viewProj * modelMatrix * vec4<f32>(pos, 1.0);
        out.uv = uv;
        out.color = col;
        out.normal = norm;
        return out;
    }

    struct GBufferOutput {
        @location(0) albedo: vec4<f32>,
        @location(1) normal: vec4<f32>,
    };

    @fragment
    fn fs_main(in: VertexOutput) -> GBufferOutput {
        var output: GBufferOutput;

        let texColor = textureSample(atlasTexture, textureSampler, in.uv);
        if(texColor.a < 0.1) {
            discard;
        }
        
        output.albedo = texColor;
        output.normal = vec4<f32>(normalize(in.normal), 1.0);

        return output;
    }
`;