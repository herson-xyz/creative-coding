// Pixels
@group(0) @binding(0)
  var<storage, read_write> pixels : array<vec4f>;

// Uniforms
@group(1) @binding(0)
  var<uniform> rez : f32;

@group(1) @binding(1)
  var<uniform> time : f32;

@group(1) @binding(2)
  var<uniform> preyCount : u32;

@group(1) @binding(3)
  var<uniform> predatorCount : u32;

@group(1) @binding(4)
  var<uniform> awarenessRange : f32;

@group(1) @binding(5)
  var<uniform> fearResponse : f32;

@group(1) @binding(6)
  var<uniform> flightSpeed : f32;

@group(1) @binding(7)
  var<uniform> huntSpeed : f32;

// Other buffers
@group(2) @binding(0)
  var<storage, read_write> positions : array<vec2f>;

@group(2) @binding(1)
  var<storage, read_write> velocities : array<vec2f>;

@group(2) @binding(2)
  var<storage, read_write> predatorPositions : array<vec2f>;

@group(2) @binding(3)
  var<storage, read_write> predatorVelocities : array<vec2f>;

fn r(n: f32) -> f32 {
  let x = sin(n) * 43758.5453;
  return fract(x);
}

fn index(p: vec2f) -> i32 {
  return i32(p.x) + i32(p.y) * i32(rez);
}

@compute @workgroup_size(256)
fn reset(@builtin(global_invocation_id) id : vec3u) {
  let seed = f32(id.x)/f32(preyCount);
  var p = vec2(r(seed), r(seed + 0.1));
  p *= rez;
  positions[id.x] = p;
  velocities[id.x] = vec2(r(f32(id.x+1)), r(f32(id.x + 2))) - 0.5;

  predatorPositions[id.x] = vec2(r(f32(id.x+1)), r(f32(id.x + 2))) * rez;
  predatorVelocities[id.x] = vec2(r(f32(id.x+1)), r(f32(id.x + 2))) - 0.5;
}

@compute @workgroup_size(256)
fn simulatePrey(@builtin(global_invocation_id) id : vec3u) {
  var p = positions[id.x];
  var v = velocities[id.x];

  // Update position
  p += v;
  positions[id.x] = (p + rez) % rez;

  // Update velocity — flee predators
  var acceleration = vec2(0.0);
  let radius = 2 + (p.x / rez) * awarenessRange;

  for(var i=0u; i<predatorCount; i++) {
    var other = predatorPositions[i];
    var d = distance(other, p);
    if(d < radius) {
      acceleration += p - other;
    }
  }

  v += fearResponse * acceleration;
  v += (vec2(r(f32(id.x)+time), r(f32(id.x+1)+time)) - 0.5) * 0.02;
  velocities[id.x] = normalize(v) * flightSpeed;

  pixels[index(p)] = vec4(0.5 + 0.5 * f32(id.x)/f32(preyCount));
}

@compute @workgroup_size(256)
fn simulatePredators(@builtin(global_invocation_id) id : vec3u) {
  if(id.x >= predatorCount) {
    return;
  }

  var p = predatorPositions[id.x];
  var v = predatorVelocities[id.x];

  // Update position
  p += v;
  predatorPositions[id.x] = (p + rez) % rez;

  // Update velocity — chase prey
  var acceleration = vec2(0.0);
  let radius = 2 + (p.x / rez) * awarenessRange;

  for(var i=0u; i < preyCount; i++) {
    var other = positions[i];
    var d = distance(other, p);
    if(d < radius) {
      acceleration += other - p;
    }
  }

  v += fearResponse * acceleration;
  v += (vec2(r(f32(id.x)+time), r(f32(id.x+1)+time)) - 0.5) * 0.1;
  predatorVelocities[id.x] = normalize(v) * huntSpeed;

  pixels[index(p)] = vec4(1, 0.0, 0.0, 1.0);
}

@compute @workgroup_size(256)
fn fade(@builtin(global_invocation_id) id : vec3u) {
  pixels[id.x] *= 0.99;
}
