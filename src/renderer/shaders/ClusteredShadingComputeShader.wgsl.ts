export const clusteredShadingComputeShaderWGSL = `

    struct Cluster {
        minPoint: vec4<f32>,
        maxPoint: vec4<f32>,
        lightCount: u32,
        _padding: array<u32, 3>,
        lightIndices: array<u32, 200>,
    }
   
    struct ClusterParams {
        inverseProjectionMatrix: mat4x4<f32>, 
        gridSize: vec3<u32>,                  
        zNear: f32,                           
        screenResolution: vec2<f32>,         
        zFar: f32, 
        cameraPosition: vec4<f32>,                           
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

       
      
        let p0 = screenToView(vec2<f32>(minXTileInScreenSpace, minYTileInScreenSpace));
        let p1 = screenToView(vec2<f32>(maxXTileInScreenSpace, minYTileInScreenSpace));
        let p2 = screenToView(vec2<f32>(minXTileInScreenSpace, maxYTileInScreenSpace));
        let p3 = screenToView(vec2<f32>(maxXTileInScreenSpace, maxYTileInScreenSpace));

        let eye = vec3<f32>(0.0, 0.0, 0.0);
        
        let n0 = lineIntersectionWithZPlane(eye, p0, planeNear);
        let n1 = lineIntersectionWithZPlane(eye, p1, planeNear);
        let n2 = lineIntersectionWithZPlane(eye, p2, planeNear);
        let n3 = lineIntersectionWithZPlane(eye, p3, planeNear);

        let f0 = lineIntersectionWithZPlane(eye, p0, planeFar);
        let f1 = lineIntersectionWithZPlane(eye, p1, planeFar);
        let f2 = lineIntersectionWithZPlane(eye, p2, planeFar);
        let f3 = lineIntersectionWithZPlane(eye, p3, planeFar);

      
        let minP = min(min(min(n0, n1), min(n2, n3)), min(min(f0, f1), min(f2, f3)));
        let maxP = max(max(max(n0, n1), max(n2, n3)), max(max(f0, f1), max(f2, f3)));

        clusterBuffer[tileIndex].minPoint = vec4(minP, 0.0);
        clusterBuffer[tileIndex].maxPoint = vec4(maxP, 0.0);
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

        
        let clipSpacePos: vec4<f32> = vec4<f32>(xNDC, yNDC, 0.0, 1.0);
        var viewCoord: vec4<f32> = params.inverseProjectionMatrix * clipSpacePos;
        viewCoord /= viewCoord.w;

        return viewCoord.xyz;
    }
`;