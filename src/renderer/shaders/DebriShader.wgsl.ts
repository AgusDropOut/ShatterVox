import { MotionVectorMath } from "./WGSLModules";

export const debriShaderWGSL = `
    struct Camera { 
        viewProj: mat4x4<f32>,
        prevViewProj: mat4x4<f32>, 
    };
    @group(0) @binding(0) var<uniform> camera: Camera;
    @group(0) @binding(1) var textureSampler: sampler;
    @group(0) @binding(2) var atlasTexture: texture_2d<f32>;

    struct DebriData {
        matrix: mat4x4<f32>,
        prevMatrix: mat4x4<f32>,
    };
    @group(1) @binding(0) var<storage, read> debriBuffer: array<DebriData>;

    @group(3) @binding(0) var normalSampler: sampler;
    @group(3) @binding(1) var normalAtlasTexture: texture_2d<f32>;

    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
        @location(1) color: vec4<f32>,
        @location(2) normal: vec4<f32>,
        @location(3) currentClipPos: vec4<f32>,
        @location(4) previousClipPos: vec4<f32>,
        @location(5) tangent: vec3<f32>,
    };

    @vertex
    fn vs_main(
        @location(0) pos: vec3<f32>,
        @location(1) norm: vec4<f32>,
        @location(2) col: vec4<f32>,
        @location(3) uv: vec2<f32>,
        @builtin(instance_index) instanceIndex: u32
    ) -> VertexOutput {
        var out: VertexOutput;
        let localPos = vec4<f32>(pos, 1.0);
        let modelMatrix = debriBuffer[instanceIndex].matrix;
        let prevModelMatrix = debriBuffer[instanceIndex].prevMatrix;
        
        let normalMatrix = mat3x3<f32>(
            modelMatrix[0].xyz,
            modelMatrix[1].xyz,
            modelMatrix[2].xyz
        );

        var localT: vec3<f32>;
        let absN = abs(norm.xyz);
        if (absN.y > 0.5) {
            localT = vec3<f32>(1.0, 0.0, 0.0);
        } else if (absN.x > 0.5) {
            localT = vec3<f32>(0.0, 0.0, -sign(norm.x));
        } else {
            localT = vec3<f32>(sign(norm.z), 0.0, 0.0);
        }

        out.tangent = normalMatrix * localT;
        out.currentClipPos = camera.viewProj * modelMatrix * localPos;
        out.previousClipPos = camera.prevViewProj * prevModelMatrix * localPos;

        out.position = out.currentClipPos;
        out.uv = uv;
        out.color = col;
        out.normal = vec4<f32>(normalMatrix * norm.xyz, norm.w);
        return out;
    }

    struct GBufferOutput {
        @location(0) albedo: vec4<f32>,
        @location(1) normal: vec4<f32>,
        @location(2) motion: vec2<f32>,
    };

    ${MotionVectorMath}

    @fragment
    fn fs_main(in: VertexOutput) -> GBufferOutput {
        var output: GBufferOutput;

        let texColor = textureSample(atlasTexture, textureSampler, in.uv);
        if(texColor.a < 0.1) { discard; }
        
        let N = normalize(in.normal.xyz);
        let T = normalize(in.tangent);
        let B = normalize(cross(N, T));
        let TBN = mat3x3<f32>(T, B, N);

        let rawNormalMap = textureSample(normalAtlasTexture, normalSampler, in.uv).rgb;
        let decodedNormalMap = rawNormalMap * 2.0 - 1.0;
        let finalNormal = normalize(TBN * decodedNormalMap);

        output.albedo = vec4<f32>(texColor.rgb * in.color.rgb, in.normal.w);
        output.normal = vec4<f32>(finalNormal, in.color.a);
        output.motion = calculateMotionVector(in.currentClipPos, in.previousClipPos);

        return output;
    }
`;