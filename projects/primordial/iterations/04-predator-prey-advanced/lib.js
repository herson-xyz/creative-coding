const load = async (path) => {
  try {
    const response = await fetch(path);
    if (response.ok) {
      const content = await response.text();
      return content;
    } else {
      throw new Error(`Error loading: ${path}`);
    }
  } catch (error) {
    console.error(error);
  }
};

const createShader = async (gpu, file) => {
  const code = await load(file);
  const module = gpu.createShaderModule({ code });
  const info = await module.getCompilationInfo();
  if (info.messages.length > 0) {
    for (let message of info.messages) {
      console.warn(`${message.message} \n  at ${file} line ${message.lineNum}`);
    }
    throw new Error(`Could not compile ${file}`);
  }
  return module;
};

let rp;
const render = async (gpu, rez, buffer, format, context, encoder) => {
  if (rp) {
    rp(encoder);
    return;
  }

  let quadShader = gpu.createShaderModule({
    code: `
      @group(0) @binding(0)
      var<storage, read_write> pixels : array<vec4f>;

      struct VertexOutput {
        @builtin(position) Position : vec4f,
          @location(0) fragUV : vec2f,
      }

      @vertex
      fn vert(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {

        const pos = array(
          vec2( 1.0,  1.0),
          vec2( 1.0, -1.0),
          vec2(-1.0, -1.0),
          vec2( 1.0,  1.0),
          vec2(-1.0, -1.0),
          vec2(-1.0,  1.0),
        );

        const uv = array(
          vec2(1.0, 0.0),
          vec2(1.0, 1.0),
          vec2(0.0, 1.0),
          vec2(1.0, 0.0),
          vec2(0.0, 1.0),
          vec2(0.0, 0.0),
        );

        var output : VertexOutput;
        output.Position = vec4(pos[VertexIndex], 0.0, 1.0);
        output.fragUV = uv[VertexIndex];
        return output;
      }

      @fragment
      fn frag(@location(0) fragUV : vec2f) -> @location(0) vec4f {
        var color = vec4(0.0, 0.0, 0.0, 1.0);
        return color + pixels[i32((fragUV.x * ${rez}) + floor(fragUV.y * ${rez}) * ${rez})];
      }
    `,
  });

  const renderPipeline = gpu.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: quadShader,
      entryPoint: "vert",
    },
    fragment: {
      module: quadShader,
      entryPoint: "frag",
      targets: [{ format: format }],
    },
    primitive: {
      topology: "triangle-list",
    },
  });

  const bg = gpu.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: buffer,
          offset: 0,
          size: rez * rez * 16,
        },
      },
    ],
  });

  rp = (commandEncoder) => {
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    renderPass.setPipeline(renderPipeline);
    renderPass.setBindGroup(0, bg);
    renderPass.draw(6, 1, 0, 0);
    renderPass.end();
  };

  rp(encoder);
};

export { createShader, render };
