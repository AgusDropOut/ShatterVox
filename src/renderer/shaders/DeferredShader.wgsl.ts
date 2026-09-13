export const deferredShader = `
    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
    };

    struct Camera {
        viewProj: mat4x4<f32>,
        invViewProj: mat4x4<f32>,
    };

    @vertex
    fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
        var pos = array<vec2<f32>, 6>(
            vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0,  1.0),
            vec2<f32>(-1.0,  1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0,  1.0)
        );
        var uv = array<vec2<f32>, 6>(
            vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 0.0),
            vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0), vec2<f32>(1.0, 0.0)
        );
        var out: VertexOutput;
        out.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
        out.uv = uv[vertexIndex];
        return out;
    }

    @group(0) @binding(0) var texSamplerLinear: sampler;
    @group(0) @binding(1) var texSamplerNearest: sampler;
    @group(0) @binding(2) var albedoTex: texture_2d<f32>;
    @group(0) @binding(3) var normalTex: texture_2d<f32>;
    @group(0) @binding(4) var depthTex: texture_depth_2d;
    @group(0) @binding(5) var gtaoTexture: texture_2d<f32>;
    @group(0) @binding(6) var shadowMap: texture_depth_2d;
    @group(0) @binding(7) var shadowSampler: sampler_comparison;
    @group(1) @binding(0) var<uniform> camera: Camera;

    struct SunParams {
        viewProj: mat4x4<f32>,
        direction: vec3<f32>,
        color: vec3<f32>,
    };
    @group(1) @binding(1) var<uniform> sun: SunParams;

    struct Light {
        position: vec3<f32>,
        intensity: f32,
        color: vec3<f32>,
        padding: f32,
    };

    struct Cluster {
        minPoint: vec4<f32>,
        maxPoint: vec4<f32>,
        lightCount: u32,
        _padding: array<u32, 3>, 
        lightIndices: array<u32, 200>,
    };

    struct ClusterParams {
        inverseProjectionMatrix: mat4x4<f32>, 
        gridSize: vec3<u32>,                  
        zNear: f32,                           
        screenResolution: vec2<f32>,          
        zFar: f32,                            
        cameraPosition: vec4<f32>,
    };
    
    @group(2) @binding(0) var<storage, read> lightBuffer: array<Light>;
    @group(3) @binding(0) var<storage, read> clusterBuffer: array<Cluster>;
    @group(3) @binding(1) var<uniform> clusterParams: ClusterParams;

    @fragment
    fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
        let depth = textureSampleLevel(depthTex, texSamplerNearest, in.uv, 0);
        if (depth >= 1.0) {
            return vec4<f32>(0.0, 0.0, 0.0, 1.0);
        }
        
        let albedo = textureSampleLevel(albedoTex, texSamplerLinear, in.uv, 0.0);
        let normal = textureSampleLevel(normalTex, texSamplerLinear, in.uv, 0.0);
        let normalizedNormal = normalize(normal.xyz);

        let roughness = normal.w;
        let metallic = albedo.a;

        let xNDC = in.uv.x * 2.0 - 1.0;
        let yNDC = 1.0 - in.uv.y * 2.0;
        let zNDC = depth;

        let clip = vec4<f32>(xNDC, yNDC, zNDC, 1.0);
        let WHomogenousWorld = camera.invViewProj * clip;
        let WHomogenousView = clusterParams.inverseProjectionMatrix * clip;
        let worldPos = WHomogenousWorld.xyz / WHomogenousWorld.w;
        let viewPos = WHomogenousView.xyz / WHomogenousView.w;

        let tileSizeX: f32 = clusterParams.screenResolution.x / f32(clusterParams.gridSize.x);
        let tileSizeY: f32 = clusterParams.screenResolution.y / f32(clusterParams.gridSize.y);

        let zTile: u32 = u32((log(abs(viewPos.z) / clusterParams.zNear) * f32(clusterParams.gridSize.z)) / log(clusterParams.zFar / clusterParams.zNear));
        
        let tile: vec3<u32> = vec3<u32>(u32(in.position.x / tileSizeX), u32(in.position.y / tileSizeY), zTile);
        let tileIndex: u32 = u32(tile.x + (tile.y * clusterParams.gridSize.x) + (tile.z * clusterParams.gridSize.x * clusterParams.gridSize.y));
        let lightCount = i32(clusterBuffer[tileIndex].lightCount);

        let shadowVisibility = calculateShadow(worldPos, normalizedNormal);

        var lightAccum: vec3<f32> = vec3<f32>(0.0, 0.0, 0.0);
        let viewDir = normalize(clusterParams.cameraPosition.xyz - worldPos);
        let F0 = mix(vec3<f32>(0.04, 0.04, 0.04), albedo.xyz, metallic);

        for (var i: i32 = 0; i < lightCount; i = i + 1) {
            let lightIndex = clusterBuffer[tileIndex].lightIndices[i];
            let light = lightBuffer[lightIndex];
            let lightVec = light.position - worldPos;
            let distance = length(lightVec);

            if (distance < light.intensity) {
                let ndir = normalize(lightVec);
                let halfVector = normalize(viewDir + ndir);

                let ks = getfresnelSchlick(halfVector, F0, viewDir);
                let kd = (vec3<f32>(1.0, 1.0, 1.0) - ks) * (1.0 - metallic);

                let diff = max(dot(normalizedNormal, ndir), 0.0);
                let attenuation = max(1.0 - ((distance * distance) / (light.intensity * light.intensity)), 0.0);

                let diffuseTerm = kd * (albedo.xyz / 3.14159265359);
                let specularTerm = calculateSpecular(normalizedNormal, viewDir, ndir, roughness, metallic, albedo, F0);

                lightAccum += ((diffuseTerm + specularTerm) * (light.color * 8.0) * diff * attenuation);
            }
        }
        
        let NdotL = max(dot(normalizedNormal, -sun.direction), 0.0);
      
        let sunDirectLight = sun.color * 6.0 * shadowVisibility * NdotL * albedo.xyz;

        let ambient = vec3<f32>(0.4, 0.4, 0.4);
        let gtao = textureSampleLevel(gtaoTexture, texSamplerLinear, in.uv, 0.0).r;
        let occludedAmbient = ambient * gtao * albedo.xyz;
        
        let finalColor = lightAccum + sunDirectLight + occludedAmbient;

        return vec4<f32>(finalColor, 1.0);
    }

    fn calculateShadow(worldPos: vec3<f32>, normal: vec3<f32>) -> f32 {
        let sunPos = sun.viewProj * vec4<f32>(worldPos, 1.0);
        let projCoords = sunPos.xyz / sunPos.w;
        let uv = vec2<f32>(projCoords.x * 0.5 + 0.5, 1.0 - (projCoords.y * 0.5 + 0.5));
        
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || projCoords.z > 1.0 || projCoords.z < 0.0) {
            return 0.0; 
        }

        let bias = max(0.001 * (1.0 - dot(normal, normalize(-sun.direction))), 0.0001);
        let currentDepth = projCoords.z - bias;
        
        return textureSampleCompareLevel(shadowMap, shadowSampler, uv, currentDepth);
    }

    fn calculateSpecular(normal: vec3<f32>, viewDir: vec3<f32>, lightDir: vec3<f32>, roughness: f32, metallic: f32, albedo: vec4<f32>, F0: vec3<f32>) -> vec3<f32> {
        let safeRoughness = max(roughness, 0.05);
        let halfVector = normalize(viewDir + lightDir);
        let NDF = getNormalDistribution(normal, halfVector, safeRoughness);
        let G = getGeometry(normal, viewDir, lightDir, safeRoughness);
        let F = getfresnelSchlick(halfVector, F0, viewDir);
        let numerator = NDF * G * F;
        let denominator = 4.0 * max(dot(normal, viewDir), 0.0) * max(dot(normal, lightDir), 0.0) + 0.0001;
        return numerator / denominator;
    }

    fn getNormalDistribution(normal: vec3<f32>, halfVector: vec3<f32>, roughness: f32) -> f32 {
        let phi = 3.14159265359;
        let a = roughness * roughness;
        let a2 = a * a;
        let NdotH = max(dot(normal, halfVector), 0.0);
        let NdotH2 = NdotH * NdotH;
        let denom = NdotH2 * (a2 - 1.0) + 1.0;
        return a2 / (phi * denom * denom);
    }

    fn getfresnelSchlick(halfVector: vec3<f32>, F0: vec3<f32>, viewDir: vec3<f32>) -> vec3<f32> {
        let VdotH = max(dot(viewDir, halfVector), 0.0);
        return F0 + (vec3<f32>(1.0, 1.0, 1.0) - F0) * pow(1.0 - VdotH, 5.0);
    }

    fn getGeometry(normal: vec3<f32>, viewDir: vec3<f32>, lightDir: vec3<f32>, roughness: f32) -> f32 {
        let NdotV = max(dot(normal, viewDir), 0.0);
        let NdotL = max(dot(normal, lightDir), 0.0);
        let ggx1 = getGeometrySub(NdotV, roughness);
        let ggx2 = getGeometrySub(NdotL, roughness);
        return ggx1 * ggx2;
    }

    fn getGeometrySub(NdotV: f32, roughness: f32) -> f32 {
        let k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
        return NdotV / (NdotV * (1.0 - k) + k);
    }
`;