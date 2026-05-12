import { createShader, render } from "./lib.js?v=3";

const sizes = {
  f32:  4,
  vec4: 16,
};

const uniforms = {
  rez:            1024,
  predatorCount:  3,
  preyCount:      16000,
  time:           0,
  // Tunable params
  perceptionRadius:   20,
  predatorAggression: 0.26,
  preyEvasion:        0.04,
  predatorSpeed:      0.5,
  preySpeed:          0.3,
  trailPersistence:   0.95,
  // Visual params
  pulseSpeed:         100,
  preyMaxSize:        8,
  preyEmission:       0.008,
  colorMultiplier:    3.0,
  vignetteRadius:     0.89,
  // Predator growth params
  sizeGrowth:         0.2,
  sizeDecay:          0.995,
  predatorMaxSize:    24,
  predatorEmission:   0.2,
};

const settings = {
  agentWorkGroups: 256,
};

async function main() {
  const adapter = await navigator.gpu.requestAdapter();
  const gpu     = await adapter.requestDevice();

  // Measure after GPU setup so the DOM is fully laid out
  const ctrlW  = (document.getElementById('controls')?.offsetWidth ?? 300) + 24;
  const availW = Math.max(window.innerWidth - ctrlW, window.innerWidth * 0.5);
  const availH = Math.max(window.innerHeight - 80, 300);
  const scale  = Math.min(Math.min(availW, availH) / uniforms.rez, 0.9);

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = uniforms.rez;
  canvas.style.width = canvas.style.height = `${Math.floor(uniforms.rez * scale)}px`;
  (document.getElementById("canvas-area") || document.body).appendChild(canvas);

  function resizeCanvas() {
    const ctrlW  = (document.getElementById('controls')?.offsetWidth ?? 300) + 24;
    const availW = Math.max(window.innerWidth - ctrlW, window.innerWidth * 0.5);
    const availH = Math.max(window.innerHeight - 80, 300);
    const s = Math.min(Math.min(availW, availH) / uniforms.rez, 0.9);
    canvas.style.width = canvas.style.height = `${Math.floor(uniforms.rez * s)}px`;
  }
  window.addEventListener('resize', resizeCanvas);
  const context = canvas.getContext("webgpu");
  const format  = "bgra8unorm";
  context.configure({ device: gpu, format, alphaMode: "premultiplied" });

  const visibility = GPUShaderStage.COMPUTE;

  // ── pixel buffer ──────────────────────────────────────────────
  const pixelBuffer = gpu.createBuffer({
    size:  uniforms.rez ** 2 * sizes.vec4,
    usage: GPUBufferUsage.STORAGE,
  });
  const pixelBufferLayout = gpu.createBindGroupLayout({
    entries: [{ visibility, binding: 0, buffer: { type: "storage" } }],
  });
  const pixelBufferBindGroup = gpu.createBindGroup({
    layout:  pixelBufferLayout,
    entries: [{ binding: 0, resource: { buffer: pixelBuffer } }],
  });

  // ── uniform buffer (packed struct — avoids maxUniformBuffersPerShaderStage = 12 limit) ──
  const FIELD_OFFSETS = {
    rez:                0,
    time:               4,
    predatorCount:      8,
    preyCount:          12,
    perceptionRadius:   16,
    predatorAggression: 20,
    preyEvasion:        24,
    predatorSpeed:      28,
    preySpeed:          32,
    trailPersistence:   36,
    pulseSpeed:         40,
    preyMaxSize:        44,
    preyEmission:       48,
    colorMultiplier:    52,
    vignetteRadius:     56,
    sizeGrowth:         60,
    sizeDecay:          64,
    predatorMaxSize:    68,
    predatorEmission:   72,
  };

  const uniformBuf = gpu.createBuffer({
    size:  80,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
  });
  gpu.queue.writeBuffer(uniformBuf, 0, new Float32Array([
    uniforms.rez, uniforms.time, uniforms.predatorCount, uniforms.preyCount,
    uniforms.perceptionRadius, uniforms.predatorAggression, uniforms.preyEvasion,
    uniforms.predatorSpeed, uniforms.preySpeed, uniforms.trailPersistence,
    uniforms.pulseSpeed, uniforms.preyMaxSize, uniforms.preyEmission,
    uniforms.colorMultiplier, uniforms.vignetteRadius,
    uniforms.sizeGrowth, uniforms.sizeDecay, uniforms.predatorMaxSize, uniforms.predatorEmission,
  ]));

  const uniformsLayout = gpu.createBindGroupLayout({
    entries: [{ visibility, binding: 0, buffer: { type: "uniform" } }],
  });
  const uniformsBindGroup = gpu.createBindGroup({
    layout:  uniformsLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuf } }],
  });

  // ── agent buffers ─────────────────────────────────────────────
  const predatorBuf     = gpu.createBuffer({ size: sizes.vec4 * uniforms.predatorCount, usage: GPUBufferUsage.STORAGE });
  const predatorSizeBuf = gpu.createBuffer({ size: sizes.f32  * uniforms.predatorCount, usage: GPUBufferUsage.STORAGE });
  const preyBuf         = gpu.createBuffer({ size: sizes.vec4 * uniforms.preyCount,     usage: GPUBufferUsage.STORAGE });
  const preyStatesBuf   = gpu.createBuffer({ size: sizes.f32  * uniforms.preyCount,     usage: GPUBufferUsage.STORAGE });

  const agentsLayout = gpu.createBindGroupLayout({
    entries: [
      { visibility, binding: 0, buffer: { type: "storage" } },
      { visibility, binding: 1, buffer: { type: "storage" } },
      { visibility, binding: 2, buffer: { type: "storage" } },
      { visibility, binding: 3, buffer: { type: "storage" } },
    ],
  });
  const agentsBindGroup = gpu.createBindGroup({
    layout: agentsLayout,
    entries: [
      { binding: 0, resource: { buffer: predatorBuf } },
      { binding: 1, resource: { buffer: predatorSizeBuf } },
      { binding: 2, resource: { buffer: preyBuf } },
      { binding: 3, resource: { buffer: preyStatesBuf } },
    ],
  });

  const layout = gpu.createPipelineLayout({
    bindGroupLayouts: [pixelBufferLayout, uniformsLayout, agentsLayout],
  });

  const module = await createShader(gpu, "agents.wgsl?v=3");

  const resetPipeline    = gpu.createComputePipeline({ layout, compute: { module, entryPoint: "reset" } });
  const predatorPipeline = gpu.createComputePipeline({ layout, compute: { module, entryPoint: "predatorSim" } });
  const preyPipeline     = gpu.createComputePipeline({ layout, compute: { module, entryPoint: "preySim" } });
  const fadePipeline     = gpu.createComputePipeline({ layout, compute: { module, entryPoint: "fade" } });

  const reset = () => {
    const encoder = gpu.createCommandEncoder();
    const pass    = encoder.beginComputePass();
    pass.setPipeline(resetPipeline);
    pass.setBindGroup(0, pixelBufferBindGroup);
    pass.setBindGroup(1, uniformsBindGroup);
    pass.setBindGroup(2, agentsBindGroup);
    pass.dispatchWorkgroups(
      Math.ceil(Math.max(uniforms.preyCount, uniforms.predatorCount) / settings.agentWorkGroups)
    );
    pass.end();
    gpu.queue.submit([encoder.finish()]);
  };
  reset();

  const draw = () => {
    const encoder = gpu.createCommandEncoder();
    const pass    = encoder.beginComputePass();
    pass.setBindGroup(0, pixelBufferBindGroup);
    pass.setBindGroup(1, uniformsBindGroup);
    pass.setBindGroup(2, agentsBindGroup);

    pass.setPipeline(predatorPipeline);
    pass.dispatchWorkgroups(Math.ceil(uniforms.predatorCount / settings.agentWorkGroups));

    pass.setPipeline(preyPipeline);
    pass.dispatchWorkgroups(Math.ceil(uniforms.preyCount / settings.agentWorkGroups));

    pass.setPipeline(fadePipeline);
    pass.dispatchWorkgroups(Math.ceil(uniforms.rez / 16), Math.ceil(uniforms.rez / 16));

    pass.end();
    render(gpu, uniforms.rez, pixelBuffer, format, context, encoder);
    gpu.queue.submit([encoder.finish()]);
    gpu.queue.writeBuffer(uniformBuf, FIELD_OFFSETS.time, new Float32Array([uniforms.time++]));
    requestAnimationFrame(draw);
  };
  draw();

  window.simParams = {
    update(key, value) {
      uniforms[key] = value;
      const offset = FIELD_OFFSETS[key];
      if (offset !== undefined) gpu.queue.writeBuffer(uniformBuf, offset, new Float32Array([value]));
    },
    reset,
  };
}
main().catch(console.error);
