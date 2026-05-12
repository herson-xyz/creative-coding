// Pixels
@group(0) @binding(0)
  var<storage, read_write> pixels : array<vec4f>;

// All uniforms packed into a single buffer (stays within maxUniformBuffersPerShaderStage = 12)
struct Uniforms {
  rez:               f32,
  time:              f32,
  predatorCount:     f32,
  preyCount:         f32,
  perceptionRadius:  f32,
  predatorAggression: f32,
  preyEvasion:       f32,
  predatorSpeed:     f32,
  preySpeed:         f32,
  trailPersistence:  f32,
  pulseSpeed:        f32,
  preyMaxSize:       f32,
  preyEmission:      f32,
  colorMultiplier:   f32,
  vignetteRadius:    f32,
  sizeGrowth:        f32,
  sizeDecay:         f32,
  predatorMaxSize:   f32,
  predatorEmission:  f32,
}

@group(1) @binding(0)
  var<uniform> u : Uniforms;

// Agents
@group(2) @binding(0)
  var<storage, read_write> predators : array<vec4f>;

@group(2) @binding(1)
  var<storage, read_write> predatorSizes : array<f32>;

@group(2) @binding(2)
  var<storage, read_write> prey : array<vec4f>;

@group(2) @binding(3)
  var<storage, read_write> preyStates : array<f32>;


fn r(n: f32) -> f32 {
  let x = sin(n) * 43758.5453;
  return fract(x);
}

fn index(p: vec2f) -> i32 {
  return i32(p.x) + i32(p.y) * i32(u.rez);
}

@compute @workgroup_size(256)
fn reset(@builtin(global_invocation_id) id : vec3u) {
  let seed = f32(id.x);
  if(id.x < u32(u.predatorCount)) {
    var xy  = vec2(r(seed), r(seed + 1)) * u.rez;
    var vxy = vec2(r(seed + 4), r(seed + 5)) - 0.5;
    predators[id.x]     = vec4(xy, vxy);
    predatorSizes[id.x] = 4.0;
  }
  if(id.x < u32(u.preyCount)) {
    var xy  = vec2(r(seed + 2), r(seed + 3)) * u.rez;
    var vxy = vec2(r(seed + 4), r(seed + 5)) - 0.5;
    prey[id.x]       = vec4(xy, vxy);
    preyStates[id.x] = 1.0;
  }
}

// Fixed multipliers: prey detect at 4× base range, predators at 2×
const preyRadiusFactor     = 4.0;
const predatorRadiusFactor = 2.0;
const predatorrFactor      = 0.1;
const preyrFactor          = 0.01;


@compute @workgroup_size(256)
fn predatorSim(@builtin(global_invocation_id) id : vec3u) {
  if(f32(id.x) >= u.predatorCount) { return; }

  var p    = predators[id.x].xy;
  var v    = predators[id.x].zw;
  var size = predatorSizes[id.x];

  p += v;

  var eaten        = false;
  var acceleration = vec2(0.0);
  var count        = 0.0;

  // Seek prey
  for(var i = 0; i < i32(u.preyCount); i++) {
    if(preyStates[i] < 1) { continue; }
    let pp = prey[i];
    let d  = distance(pp.xy, p);
    if(d < size) {
      if(size < u.predatorMaxSize) {
        eaten = true;
        size += u.sizeGrowth;
      }
    } else if(d < u.perceptionRadius * predatorRadiusFactor) {
      count        += 1.0;
      acceleration += (pp.xy - p);
    }
  }

  // Avoid other predators
  for(var i = 0; i < i32(u.predatorCount); i++) {
    if(i == i32(id.x)) { continue; }
    let other     = predators[i];
    let otherSize = predatorSizes[i];
    let d         = distance(other.xy, p);
    if(d < u.perceptionRadius * 2.0 * otherSize / 8.0) {
      count += 1;
      v     += (p - other.xy) / d;
    }
  }

  if(count > 0) {
    v += (acceleration / count) * u.predatorAggression;
  }

  if(count == 0) {
    v += (vec2(r(f32(id.x) + p.x), r(f32(id.y) + p.y)) - 0.5) * predatorrFactor;
  } else {
    v += (vec2(r(f32(id.x) + p.x), r(f32(id.y) + p.y)) - 0.5) * predatorrFactor * 0.1;
  }

  if(length(v) > u.predatorSpeed) {
    v = u.predatorSpeed * (v / length(v));
  }

  p = (p + u.rez) % u.rez;
  predators[id.x] = vec4(p, v);

  if(size > 3) { size *= u.sizeDecay; }
  predatorSizes[id.x] = size;

  var color = vec4(0.9, 0.1, 0.0, 1.0);
  if(eaten) { color = vec4(0.0, 1.0, 1.0, 1.0); }

  let sizei = i32(ceil(size));
  for(var x = -sizei; x <= sizei; x++) {
    for(var y = -sizei; y <= sizei; y++) {
      let l = length(vec2(f32(x), f32(y)));
      if(l < size) {
        pixels[index(p + vec2(f32(x), f32(y)))] += u.predatorEmission * (color * (1 - l / size));
      }
    }
  }
}


@compute @workgroup_size(256)
fn preySim(@builtin(global_invocation_id) id : vec3u) {
  if(f32(id.x) >= u.preyCount) { return; }

  var p = prey[id.x].xy;
  var v = prey[id.x].zw;

  var color        : vec4f;
  var acceleration = vec2(0.0);

  p += v;

  var closest = 100.0;
  if(preyStates[id.x] >= 1) {
    for(var i = 0; i < i32(u.predatorCount); i++) {
      let predator = predators[i];
      let psize    = predatorSizes[i];
      let d        = distance(predator.xy, p);
      closest = min(d, closest);
      if(d < u.perceptionRadius * preyRadiusFactor * psize / 18.0) {
        acceleration += (p - predator.xy) / d;
      }
      if(d <= psize) {
        preyStates[id.x] = 0;
      }
    }
    v += acceleration * u.preyEvasion;
  }

  v += (vec2(r(f32(id.x) + p.x), r(f32(id.y) + p.y)) - 0.5) * preyrFactor;

  // Soft vortex toward center
  let angle = atan2(p.y - u.rez / 2, p.x - u.rez / 2);
  v -= vec2(sin(angle), -cos(angle)) * 0.0003;
  v -= vec2(p.x - u.rez / 2, p.y - u.rez / 2) * 0.000003;

  if(length(v) > u.preySpeed) {
    v = u.preySpeed * (v / length(v));
  }

  p = (p + u.rez) % u.rez;

  color = vec4((100 - closest) / 400, 1.0 - length(v) / u.preySpeed, closest / 100 - 0.7, 1.0);

  // Dying / respawning state
  if(preyStates[id.x] < 1) {
    v += (vec2(r(f32(id.x) + p.x), r(f32(id.y) + p.y)) - 0.5) * 0.01;
    p += v;
    if(length(v) > u.preySpeed * 0.4) {
      v = u.preySpeed * (v / length(v) * 0.4);
    }
    preyStates[id.x] += 0.0005;
  }

  if(preyStates[id.x] < 0.5) {
    color = vec4(0.20, 0, 0, 1);
  } else {
    color = mix(vec4(0.70, 0, 0, 1), color, preyStates[id.x]);
  }
  color *= u.colorMultiplier;

  prey[id.x] = vec4(p, v);

  var depth  = sin(u.time / u.pulseSpeed + f32(id.x)) + 0.8;
  let psize  = i32(1 + u.preyMaxSize * (f32(id.x) % 20.0) / 20.0 * 0.5 * (1.3 + sin(u.time / u.pulseSpeed + f32(id.x))));

  for(var x = -psize; x <= psize; x++) {
    for(var y = -psize; y <= psize; y++) {
      let l = length(vec2(f32(x), f32(y)));
      if(l < f32(psize)) {
        pixels[index(p + vec2(f32(x), f32(y)))] += depth * u.preyEmission * color * smoothstep(0.3, 0.4, 1 - l / f32(psize));
      }
    }
  }
}


@compute @workgroup_size(16, 16)
fn fade(@builtin(global_invocation_id) id : vec3u) {
  let i = id.x + id.y * u32(u.rez);
  pixels[i] *= 1.0 - smoothstep(u.vignetteRadius, u.vignetteRadius + 0.31, length(vec2f(id.xy) - u.rez / 2) / (u.rez / 2));
  pixels[i] *= u.trailPersistence;
}
