import { MotionVectorMath } from "./WGSLModules";

export const ParticleShaderWGSL = `

    struct Particle {
        positionAndLife: vec4<f32>,
        velocityAndSize: vec4<f32>,
        colorAndGravity: vec4<f32>,
    };

    struct Params {
        screenResolution: vec2<f32>,
        inverseProjectionMatrix: mat4x4<f32>,
        projectionMatrix: mat4x4<f32>,
        viewMatrix: mat4x4<f32>,
        viewProjMatrix: mat4x4<f32>,
        prevViewProjMatrix: mat4x4<f32>, 
    };

    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) color: vec4<f32>,
        @location(1) normal: vec3<f32>,
        @location(2) currentClipPos: vec4<f32>, 
        @location(3) previousClipPos: vec4<f32>
    };

    struct GBufferOutput {
        @location(0) albedo: vec4<f32>,
        @location(1) normal: vec4<f32>,
        @location(2) motion: vec2<f32>,
    };
    @group(0) @binding(0) var<storage, read> particleBuffer: array<Particle>;
    
    @group(1) @binding(0) var<uniform> params: Params;
    

    ${MotionVectorMath}
    

    @vertex
    fn vs_main(
        @location(0) pos: vec3<f32>,
        @location(1) normal: vec3<f32>,
        @builtin(vertex_index) in_vertex_index: u32,
        @builtin(instance_index) instanceIndex: u32
    ) -> VertexOutput {

        var out: VertexOutput;
        let particleIndex = i32(instanceIndex);
        let particle = particleBuffer[particleIndex];
        let clipPos = params.viewProjMatrix * vec4<f32>((pos * particle.velocityAndSize.w) + particle.positionAndLife.xyz, 1.0);
        let prevClipPos = params.prevViewProjMatrix * vec4<f32>(particle.positionAndLife.xyz, 1.0);
        out.position = clipPos;
        out.currentClipPos = clipPos;
        out.previousClipPos = prevClipPos;
        out.normal = normal;
        out.color = vec4<f32>(particle.colorAndGravity.xyz, 1.0);
        return out;
    }


    @fragment
    fn fs_main(in: VertexOutput) -> GBufferOutput {
        var output: GBufferOutput;
        output.albedo = in.color;
        output.normal = vec4<f32>(in.normal, 1.0);
        output.motion = calculateMotionVector(in.currentClipPos, in.previousClipPos);
        return output;
    }
`;