export class WebGPUTexture {
    public texture!: GPUTexture;
    public view!: GPUTextureView;
    public sampler!: GPUSampler;

    public static async create(device: GPUDevice, url: string): Promise<WebGPUTexture> {
        const response = await fetch(url);
        const blob = await response.blob();
        
       
        const imageBitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });

        const tex = new WebGPUTexture();

        tex.texture = device.createTexture({
            size: [imageBitmap.width, imageBitmap.height, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | 
                   GPUTextureUsage.COPY_DST | 
                   GPUTextureUsage.RENDER_ATTACHMENT
        });

        
        device.queue.copyExternalImageToTexture(
            { source: imageBitmap, flipY: false }, 
            { texture: tex.texture },
            [imageBitmap.width, imageBitmap.height]
        );

      
        tex.view = tex.texture.createView();

        tex.sampler = device.createSampler({
            magFilter: 'nearest', 
            minFilter: 'nearest', 
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
        });

        return tex;
    }
}