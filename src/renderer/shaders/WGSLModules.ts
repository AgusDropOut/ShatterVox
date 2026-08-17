

export const MotionVectorMath = `
fn calculateMotionVector(currentClip: vec4<f32>, previousClip: vec4<f32>) -> vec2<f32> {
    let currentNDC = currentClip.xy / currentClip.w;
    let previousNDC = previousClip.xy / previousClip.w;
    let velocityNDC = currentNDC - previousNDC;
    return vec2<f32>(velocityNDC.x * 0.5, velocityNDC.y * -0.5);
}
`;