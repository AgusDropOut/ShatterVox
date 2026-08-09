export const clusteredShadingLightsToClustersComputeShaderWGSL = `

    struct Cluster {
        minPoint: vec4<f32>,
        maxPoint: vec4<f32>,
        lightCount: u32,
        _padding: array<u32, 3>, 
        lightIndices: array<u32, 200>,
    }

    struct Light {
        position: vec3<f32>,
        radius: f32,
        color: vec3<f32>,
        padding: f32,
    }

    const TOTAL_CLUSTERS = 4608u; // 12 * 12 * 32

    @group(0) @binding(0) var<storage, read_write> clusterBuffer: array<Cluster>;

    @group(1) @binding(0) var<storage, read> lightBuffer: array<Light>;
    @group(1) @binding(1) var<uniform> lightInfo: vec4<f32>;

    @group(2) @binding(0) var<uniform> viewMatrix: mat4x4<f32>;
   

    @compute @workgroup_size(64, 1, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        
        if (global_id.x >= TOTAL_CLUSTERS) {
            return;
        }

        let lightCount: u32 = u32(lightInfo.x);
        let index: u32 = global_id.x;
        let cluster = &clusterBuffer[index];

        cluster.lightCount = 0u;

        for (var i = 0u; i < lightCount; i++) {
            if (testSphereAABB(i, *cluster) && cluster.lightCount < 200u) {
                cluster.lightIndices[cluster.lightCount] = i;
                cluster.lightCount++;
            }
        }
    }

    fn sphereAABBIntersection(center: vec3<f32>, radius: f32, aabbMin: vec3<f32>, aabbMax: vec3<f32>) -> bool {
        let closestPoint: vec3<f32> = clamp(center, aabbMin, aabbMax);
        let distanceSquared: f32 = dot(closestPoint - center, closestPoint - center);
        return distanceSquared <= radius * radius;
    }

    fn testSphereAABB(lightIndex: u32, cluster: Cluster) -> bool {
        let light = lightBuffer[lightIndex];
        let radius: f32 = light.radius;

        let aabbMin: vec3<f32> = cluster.minPoint.xyz; 
        let aabbMax: vec3<f32> = cluster.maxPoint.xyz;

        let center: vec3<f32> = (viewMatrix * vec4<f32>(light.position, 1.0)).xyz;

        return sphereAABBIntersection(center, radius, aabbMin, aabbMax);
    }
`;