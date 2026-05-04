import { createShader, render } from "./lib.js";

/////////////////////////////////////////////////////////
// GPU and CPU Settings

// Sizes in bytes
const sizes = {
  f32: 4,
  u32: 4,
  i32: 4,
  vec2: 8,
  vec4: 16,
};

const uniforms = {
  rez: 512,
  time: 0,
  count: 1000,
};

// CPU-only settings
const settings = {
  scale:
    (0.95 * Math.min(window.innerHeight, window.innerWidth)) / uniforms.rez,
  pixelWorkgroups: Math.ceil(uniforms.rez ** 2 / 256),
  agentWorkgroups: Math.ceil(uniforms.count / 256),
};

/////////////////////////////////////////////////////////
// Main
async function main() {
  ///////////////////////
  // Initial setup
  const adapter = await navigator.gpu.requestAdapter();
  const gpu = await adapter.requestDevice();

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = uniforms.rez * settings.scale;
  document.body.appendChild(canvas);
  const context = canvas.getContext("webgpu");
  const format = "bgra8unorm";
  context.configure({
    device: gpu,
    format: format,
    alphaMode: "premultiplied",
  });

  /////////////////////////
  // Set up memory resources
  const visibility = GPUShaderStage.COMPUTE;

  // Pixel buffer
  const pixelBuffer = gpu.createBuffer({
    size: uniforms.rez ** 2 * sizes.vec4,
    usage: GPUBufferUsage.STORAGE,
  });
  const pixelBufferLayout = gpu.createBindGroupLayout({
    entries: [{ visibility, binding: 0, buffer: { type: "storage" } }],
  });
  const pixelBufferBindGroup = gpu.createBindGroup({
    layout: pixelBufferLayout,
    entries: [{ binding: 0, resource: { buffer: pixelBuffer } }],
  });

  // Uniform buffers
  const rezBuffer = gpu.createBuffer({
    size: sizes.f32,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
  });
  gpu.queue.writeBuffer(rezBuffer, 0, new Float32Array([uniforms.rez]));

  const timeBuffer = gpu.createBuffer({
    size: sizes.f32,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
  });
  gpu.queue.writeBuffer(timeBuffer, 0, new Float32Array([uniforms.time]));

  const countBuffer = gpu.createBuffer({
    size: sizes.f32,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
  });
  gpu.queue.writeBuffer(countBuffer, 0, new Uint32Array([uniforms.count]));

  const uniformsLayout = gpu.createBindGroupLayout({
    entries: [
      { visibility, binding: 0, buffer: { type: "uniform" } },
      { visibility, binding: 1, buffer: { type: "uniform" } },
      { visibility, binding: 2, buffer: { type: "uniform" } },
    ],
  });
  const uniformsBuffersBindGroup = gpu.createBindGroup({
    layout: uniformsLayout,
    entries: [
      { binding: 0, resource: { buffer: rezBuffer } },
      { binding: 1, resource: { buffer: timeBuffer } },
      { binding: 2, resource: { buffer: countBuffer } },
    ],
  });

  // Other buffers
  const positionsBuffer = gpu.createBuffer({
    size: sizes.vec2 * uniforms.count,
    usage: GPUBufferUsage.STORAGE,
  });

  const velocitiesBuffer = gpu.createBuffer({
    size: sizes.vec2 * uniforms.count,
    usage: GPUBufferUsage.STORAGE,
  });

  const agentsLayout = gpu.createBindGroupLayout({
    entries: [
      { visibility, binding: 0, buffer: { type: "storage" } },
      { visibility, binding: 1, buffer: { type: "storage" } },
    ],
  });
  const agentsBuffersBindGroup = gpu.createBindGroup({
    layout: agentsLayout,
    entries: [
      { binding: 0, resource: { buffer: positionsBuffer } },
      { binding: 1, resource: { buffer: velocitiesBuffer } },
    ],
  });

  /////
  // Overall memory layout
  const layout = gpu.createPipelineLayout({
    bindGroupLayouts: [pixelBufferLayout, uniformsLayout, agentsLayout],
  });

  /////////////////////////
  // Set up code instructions
  const module = await createShader(gpu, "agents.wgsl");

  const resetPipeline = gpu.createComputePipeline({
    layout,
    compute: { module, entryPoint: "reset" },
  });

  const simulatePipeline = gpu.createComputePipeline({
    layout,
    compute: { module, entryPoint: "simulate" },
  });

  const fadePipeline = gpu.createComputePipeline({
    layout,
    compute: { module, entryPoint: "fade" },
  });

  /////////////////////////
  // RUN the reset shader function
  const reset = () => {
    const encoder = gpu.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(resetPipeline);
    pass.setBindGroup(0, pixelBufferBindGroup);
    pass.setBindGroup(1, uniformsBuffersBindGroup);
    pass.setBindGroup(2, agentsBuffersBindGroup);
    pass.dispatchWorkgroups(settings.agentWorkgroups);
    pass.end();
    gpu.queue.submit([encoder.finish()]);
  };
  reset();

  /////////////////////////
  // RUN the sim compute function and render pixels
  const draw = () => {
    // Compute sim function
    const encoder = gpu.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setBindGroup(0, pixelBufferBindGroup);
    pass.setBindGroup(1, uniformsBuffersBindGroup);
    pass.setBindGroup(2, agentsBuffersBindGroup);

    pass.setPipeline(fadePipeline);
    pass.dispatchWorkgroups(settings.pixelWorkgroups);

    pass.setPipeline(simulatePipeline);
    pass.dispatchWorkgroups(settings.agentWorkgroups);

    pass.end();

    // Render the pixels buffer to the canvas
    render(gpu, uniforms.rez, pixelBuffer, format, context, encoder);

    gpu.queue.submit([encoder.finish()]);

    gpu.queue.writeBuffer(timeBuffer, 0, new Float32Array([uniforms.time++]));

    setTimeout(draw, 10);
  };
  draw();
}
main();
