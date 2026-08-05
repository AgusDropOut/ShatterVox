export const physicsDebugShaderWGSL = `
    struct Camera {
        viewProj: mat4x4<f32>,
    };
    @group(0) @binding(0) var<uniform> camera: Camera;

    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) color: vec4<f32>,
    };

    @vertex
    fn vs_main(
        @location(0) pos: vec3<f32>,
        @location(1) color: vec4<f32>
    ) -> VertexOutput {
        var out: VertexOutput;
        out.position = camera.viewProj * vec4<f32>(pos, 1.0);
        out.color = color;
        return out;
    }

    struct GBufferOutput {
        @location(0) albedo: vec4<f32>,
        @location(1) normal: vec4<f32>,
    };

    @fragment
    fn fs_main(in: VertexOutput) -> GBufferOutput {
        var output: GBufferOutput;

        output.albedo = in.color;

        output.normal = vec4<f32>(0.0, 1.0, 0.0, 1.0);
        
        return output;
    }
`;