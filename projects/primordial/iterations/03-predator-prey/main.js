import { createShader, render } from "./lib.js";

const sizes = {
  f32: 4,
  u32: 4,
  vec2: 8,
  vec4: 16,
};

const uniforms = {
  rez: 512,
  time: 0,
  preyCount: 64 * 256,
  predatorCount: 3,
  awarenessRange: 200,
  fearResponse: 0.5,
  flightSpeed: 0.2,
  huntSpeed: 0.3,
};

const availW = window.innerWidth - 380;
const availH = window.innerHeight - 80;
const scale  = Math.min(Math.min(availW, availH) / uniforms.rez, 1.2);

const settings = {
  scale,
  pixelWorkgroups:    Math.ceil(uniforms.rez ** 2 / 256),
  preyWorkgroups:     Math.ceil(uniforms.preyCount / 256),
  predatorWorkgroups: Math.ceil(uniforms.predatorCount / 256),
};

async function main() {
  const adapter = await navigator.gpu.requestAdapter();
  const gpu = await adapter.requestDevice();

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = uniforms.rez * settings.scale;
  (document.getElementById('canvas-area') || document.body).appendChild(canvas);
  const context = canvas.getContext("webgpu");
  const format = "bgra8unorm";
  context.configure({ device: gpu, format, alphaMode: "premultiplied" });

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
  const rezBuffer = gpu.createBuffer({ size: sizes.f32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM });
  gpu.queue.writeBuffer(rezBuffer, 0, new Float32Array([uniforms.rez]));

  const timeBuffer = gpu.createBuffer({ size: sizes.f32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM });
  gpu.queue.writeBuffer(timeBuffer, 0, new Float32Array([uniforms.time]));

  const preyCountBuffer = gpu.createBuffer({ size: sizes.u32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM });
  gpu.queue.writeBuffer(preyCountBuffer, 0, new Uint32Array([uniforms.preyCount]));

  const predatorCountBuffer = gpu.createBuffer({ size: sizes.u32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM });
  gpu.queue.writeBuffer(predatorCountBuffer, 0, new Uint32Array([uniforms.predatorCount]));

  const awarenessRangeBuffer = gpu.createBuffer({ size: sizes.f32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM });
  gpu.queue.writeBuffer(awarenessRangeBuffer, 0, new Float32Array([uniforms.awarenessRange]));

  const fearResponseBuffer = gpu.createBuffer({ size: sizes.f32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM });
  gpu.queue.writeBuffer(fearResponseBuffer, 0, new Float32Array([uniforms.fearResponse]));

  const flightSpeedBuffer = gpu.createBuffer({ size: sizes.f32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM });
  gpu.queue.writeBuffer(flightSpeedBuffer, 0, new Float32Array([uniforms.flightSpeed]));

  const huntSpeedBuffer = gpu.createBuffer({ size: sizes.f32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM });
  gpu.queue.writeBuffer(huntSpeedBuffer, 0, new Float32Array([uniforms.huntSpeed]));

  const uniformsLayout = gpu.createBindGroupLayout({
    entries: [
      { visibility, binding: 0, buffer: { type: "uniform" } },
      { visibility, binding: 1, buffer: { type: "uniform" } },
      { visibility, binding: 2, buffer: { type: "uniform" } },
      { visibility, binding: 3, buffer: { type: "uniform" } },
      { visibility, binding: 4, buffer: { type: "uniform" } },
      { visibility, binding: 5, buffer: { type: "uniform" } },
      { visibility, binding: 6, buffer: { type: "uniform" } },
      { visibility, binding: 7, buffer: { type: "uniform" } },
    ],
  });
  const uniformsBuffersBindGroup = gpu.createBindGroup({
    layout: uniformsLayout,
    entries: [
      { binding: 0, resource: { buffer: rezBuffer } },
      { binding: 1, resource: { buffer: timeBuffer } },
      { binding: 2, resource: { buffer: preyCountBuffer } },
      { binding: 3, resource: { buffer: predatorCountBuffer } },
      { binding: 4, resource: { buffer: awarenessRangeBuffer } },
      { binding: 5, resource: { buffer: fearResponseBuffer } },
      { binding: 6, resource: { buffer: flightSpeedBuffer } },
      { binding: 7, resource: { buffer: huntSpeedBuffer } },
    ],
  });

  // Agent buffers
  const positionsBuffer = gpu.createBuffer({ size: sizes.vec2 * uniforms.preyCount, usage: GPUBufferUsage.STORAGE });
  const velocitiesBuffer = gpu.createBuffer({ size: sizes.vec2 * uniforms.preyCount, usage: GPUBufferUsage.STORAGE });
  const predatorPositionBuffer = gpu.createBuffer({ size: sizes.vec2 * uniforms.predatorCount, usage: GPUBufferUsage.STORAGE });
  const predatorVelocityBuffer = gpu.createBuffer({ size: sizes.vec2 * uniforms.predatorCount, usage: GPUBufferUsage.STORAGE });

  const agentsLayout = gpu.createBindGroupLayout({
    entries: [
      { visibility, binding: 0, buffer: { type: "storage" } },
      { visibility, binding: 1, buffer: { type: "storage" } },
      { visibility, binding: 2, buffer: { type: "storage" } },
      { visibility, binding: 3, buffer: { type: "storage" } },
    ],
  });
  const agentsBuffersBindGroup = gpu.createBindGroup({
    layout: agentsLayout,
    entries: [
      { binding: 0, resource: { buffer: positionsBuffer } },
      { binding: 1, resource: { buffer: velocitiesBuffer } },
      { binding: 2, resource: { buffer: predatorPositionBuffer } },
      { binding: 3, resource: { buffer: predatorVelocityBuffer } },
    ],
  });

  const layout = gpu.createPipelineLayout({
    bindGroupLayouts: [pixelBufferLayout, uniformsLayout, agentsLayout],
  });

  const module = await createShader(gpu, "agents.wgsl");

  const resetPipeline          = gpu.createComputePipeline({ layout, compute: { module, entryPoint: "reset" } });
  const simulatePreyPipeline   = gpu.createComputePipeline({ layout, compute: { module, entryPoint: "simulatePrey" } });
  const simulatePredatorsPipeline = gpu.createComputePipeline({ layout, compute: { module, entryPoint: "simulatePredators" } });
  const fadePipeline           = gpu.createComputePipeline({ layout, compute: { module, entryPoint: "fade" } });

  const reset = () => {
    const encoder = gpu.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(resetPipeline);
    pass.setBindGroup(0, pixelBufferBindGroup);
    pass.setBindGroup(1, uniformsBuffersBindGroup);
    pass.setBindGroup(2, agentsBuffersBindGroup);
    pass.dispatchWorkgroups(settings.preyWorkgroups);
    pass.end();
    gpu.queue.submit([encoder.finish()]);
  };
  reset();

  const draw = () => {
    const encoder = gpu.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setBindGroup(0, pixelBufferBindGroup);
    pass.setBindGroup(1, uniformsBuffersBindGroup);
    pass.setBindGroup(2, agentsBuffersBindGroup);

    pass.setPipeline(fadePipeline);
    pass.dispatchWorkgroups(settings.pixelWorkgroups);

    pass.setPipeline(simulatePreyPipeline);
    pass.dispatchWorkgroups(settings.preyWorkgroups);

    pass.setPipeline(simulatePredatorsPipeline);
    pass.dispatchWorkgroups(settings.predatorWorkgroups);

    pass.end();
    render(gpu, uniforms.rez, pixelBuffer, format, context, encoder);
    gpu.queue.submit([encoder.finish()]);
    gpu.queue.writeBuffer(timeBuffer, 0, new Float32Array([uniforms.time++]));
    requestAnimationFrame(draw);
  };
  draw();

  const bufferMap = {
    awarenessRange: [awarenessRangeBuffer, 'f32'],
    fearResponse:   [fearResponseBuffer,   'f32'],
    flightSpeed:    [flightSpeedBuffer,     'f32'],
    huntSpeed:      [huntSpeedBuffer,       'f32'],
  };

  window.simParams = {
    update(key, value) {
      uniforms[key] = value;
      const entry = bufferMap[key];
      if (entry) gpu.queue.writeBuffer(entry[0], 0, new Float32Array([value]));
    },
    reset,
  };
}
main();
