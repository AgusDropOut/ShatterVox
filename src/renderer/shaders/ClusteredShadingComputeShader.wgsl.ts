export const clusteredShadingComputeShaderWGSL = `

    struct Cluster {
        minPoint: vec4<f32>,
        maxPoint: vec4<f32>,
        lightCount: u32,
        _padding: vec3<u32>,
        lightIndices: array<u32, 100>,
    }

   
    struct ClusterParams {
        inverseProjectionMatrix: mat4x4<f32>, 
        gridSize: vec3<u32>,                  
        zNear: f32,                           
        screenResolution: vec2<f32>,         
        zFar: f32,                            
    }

    @group(0) @binding(0) var<storage, read_write> clusterBuffer: array<Cluster>;
    @group(0) @binding(1) var<uniform> params: ClusterParams;

    @compute @workgroup_size(8, 8, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        if (global_id.x >= params.gridSize.x || 
            global_id.y >= params.gridSize.y || 
            global_id.z >= params.gridSize.z) {
            return;
        }

        let tileIndex: u32 = global_id.x + (global_id.y * params.gridSize.x) + (global_id.z * params.gridSize.x * params.gridSize.y);

        let tileSizeX: f32 = params.screenResolution.x / f32(params.gridSize.x);
        let tileSizeY: f32 = params.screenResolution.y / f32(params.gridSize.y);

        let minXTileInScreenSpace: f32 = f32(global_id.x) * tileSizeX;
        let maxXTileInScreenSpace: f32 = f32(global_id.x + 1u) * tileSizeX;
        let minYTileInScreenSpace: f32 = f32(global_id.y) * tileSizeY;
        let maxYTileInScreenSpace: f32 = f32(global_id.y + 1u) * tileSizeY;

        let planeNear: f32 = params.zNear * pow(params.zFar / params.zNear, f32(global_id.z) / f32(params.gridSize.z));
        let planeFar: f32 = params.zNear * pow(params.zFar / params.zNear, f32(global_id.z + 1u) / f32(params.gridSize.z));

        let minTile: vec3<f32> = screenToView(vec2<f32>(minXTileInScreenSpace, minYTileInScreenSpace));
        let maxTile: vec3<f32> = screenToView(vec2<f32>(maxXTileInScreenSpace, maxYTileInScreenSpace));

        let minPointNear: vec3<f32> =
            lineIntersectionWithZPlane(vec3<f32>(0, 0, 0), minTile, planeNear);
        let minPointFar: vec3<f32> =
            lineIntersectionWithZPlane(vec3<f32>(0, 0, 0), minTile, planeFar);
        let maxPointNear: vec3<f32> =
            lineIntersectionWithZPlane(vec3<f32>(0, 0, 0), maxTile, planeNear);
        let maxPointFar: vec3<f32> =
            lineIntersectionWithZPlane(vec3<f32>(0, 0, 0), maxTile, planeFar);

        // grabbing the min and max points for the cluster gives an AABB in view space
        clusterBuffer[tileIndex].minPoint = vec4(min(minPointNear, minPointFar), 0.0);
        clusterBuffer[tileIndex].maxPoint = vec4(max(maxPointNear, maxPointFar), 0.0);

    }

    fn lineIntersectionWithZPlane(startPoint: vec3<f32>, endPoint: vec3<f32>, zDistance: f32) -> vec3<f32> {
        let direction: vec3<f32> = endPoint - startPoint;
        let normal: vec3<f32> = vec3<f32>(0.0, 0.0, -1.0);
        let t: f32 = (zDistance - dot(normal, startPoint)) / dot(normal, direction);
        return startPoint + t * direction;
    }

    fn screenToView(screenCoord : vec2<f32>) -> vec3<f32> {
        let xNDC: f32 = (screenCoord.x / params.screenResolution.x) * 2.0 - 1.0;
        let yNDC: f32 = 1.0 - (screenCoord.y / params.screenResolution.y) * 2.0;


        // 0.0 cause we start from the near plane, 1.0 cause we are in clip space
        let clipSpacePos: vec4<f32> = vec4<f32>(xNDC, yNDC, 0.0, 1.0);
        var viewCoord: vec4<f32> = params.inverseProjectionMatrix * clipSpacePos;
        viewCoord /= viewCoord.w;

        return viewCoord.xyz;
    
    }

`;