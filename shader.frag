#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uCamTarget;
uniform int uShapeCount;
// Per-shape data: type(0 sphere,1 box,2 torus,3 capsule)
uniform vec4 uShapeA[24]; // xyz pos, w type
uniform vec4 uShapeB[24]; // xyz size/radii
uniform vec4 uShapeC[24]; // rgb color, w smooth-union factor k (0 = hard union)

float sdSphere(vec3 p, float r){ return length(p)-r; }
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }
float sdTorus(vec3 p, vec2 t){ vec2 q=vec2(length(p.xz)-t.x,p.y); return length(q)-t.y; }

float smin(float a, float b, float k){
  float h = clamp(0.5+0.5*(b-a)/k, 0.0, 1.0);
  return mix(b,a,h) - k*h*(1.0-h);
}

vec2 shapeSD(int i, vec3 p){
  vec3 q = p - uShapeA[i].xyz;
  vec3 s = uShapeB[i].xyz;
  float d = 1e9;
  if(uShapeA[i].w < 0.5) d = sdSphere(q, s.x);
  else if(uShapeA[i].w < 1.5) d = sdBox(q, s);
  else if(uShapeA[i].w < 2.5) d = sdTorus(q, s.xy);
  else { // capsule along local Y
    vec3 pa=q, ba=vec3(0.0, uShapeB[i].x, 0.0);
    float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
    d = length(pa-ba*h)-uShapeB[i].y;
  }
  return vec2(d, float(i));
}

vec2 map(vec3 p){
  float d = 1e9; float id = -1.0;
  for(int i=0;i<24;i++){
    if(i>=uShapeCount) break;
    vec2 s = shapeSD(i, p);
    float prev = d;
    if(uShapeC[i].w > 0.001 && id >= 0.0){
      d = smin(d, s.x, uShapeC[i].w);
    } else {
      d = min(d, s.x);
    }
    if(s.x < prev) id = s.y;
  }
  return vec2(d, id);
}

vec3 calcNormal(vec3 p){
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(
    map(p+e.xyy).x - map(p-e.xyy).x,
    map(p+e.yxy).x - map(p-e.yxy).x,
    map(p+e.yyx).x - map(p-e.yyx).x));
}

float softShadow(vec3 ro, vec3 rd){
  float res=1.0, t=0.02;
  for(int i=0;i<48;i++){
    float h = map(ro+rd*t).x;
    res = min(res, 10.0*h/t);
    t += clamp(h, 0.02, 0.25);
    if(res<0.005 || t>12.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

float ao(vec3 p, vec3 n){
  float occ=0.0, sca=1.0;
  for(int i=0;i<5;i++){
    float h = 0.02 + 0.12*float(i)/4.0;
    occ += (h - map(p+n*h).x)*sca;
    sca *= 0.7;
  }
  return clamp(1.0-2.0*occ, 0.0, 1.0);
}

void main(){
  vec2 uv = (2.0*gl_FragCoord.xy - uRes)/uRes.y;

  vec3 ro = uCamPos;
  vec3 fw = normalize(uCamTarget - ro);
  vec3 rt = normalize(cross(fw, vec3(0.0,1.0,0.0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(uv.x*rt + uv.y*up + 1.7*fw);

  vec3 col = mix(vec3(0.16,0.19,0.24), vec3(0.05,0.06,0.09), clamp(uv.y*0.5+0.5,0.0,1.0));
  // ground grid via plane raycast y=0
  if(rd.y < -0.001){
    float tG = -ro.y/rd.y;
    if(tG > 0.0){
      vec3 gp = ro + rd*tG;
      vec2 w = fwidth(gp.xz*0.5);
      vec2 g = abs(fract(gp.xz*0.5+0.5)-0.5)/max(w, vec2(1e-4));
      float line = 1.0 - min(min(g.x,g.y),1.0);
      float fade = exp(-tG*0.18);
      col = mix(col, vec3(0.35,0.40,0.50), line*fade*0.5);
    }
  }

  float t = 0.0; float id = -1.0; bool hit=false;
  for(int i=0;i<128;i++){
    vec2 h = map(ro+rd*t);
    if(h.x < 0.001*t + 0.0008){ hit=true; id=h.y; break; }
    t += h.x*0.9;
    if(t > 30.0) break;
  }

  if(hit){
    int idx = int(id);
    vec3 p = ro + rd*t;
    vec3 n = calcNormal(p);
    vec3 base = uShapeC[idx].xyz;

    vec3 ldir = normalize(vec3(0.7, 1.0, 0.4));
    float dif = clamp(dot(n, ldir), 0.0, 1.0)*softShadow(p+n*0.01, ldir);
    float sky = clamp(0.5+0.5*n.y, 0.0, 1.0);
    float bou = clamp(0.3-0.7*n.y, 0.0, 1.0);
    float occ = ao(p, n);
    vec3 lin = vec3(0.0);
    lin += dif*vec3(1.30,1.15,0.95)*2.2;
    lin += sky*vec3(0.25,0.35,0.50)*occ;
    lin += bou*vec3(0.25,0.18,0.14)*occ;
    vec3 mat = base*lin;
    vec3 hv = normalize(ldir - rd);
    mat += pow(clamp(dot(n,hv),0.0,1.0), 48.0)*dif*vec3(0.6);
    col = mix(mat, col, 1.0-exp(-0.02*t*t));
    float fre = pow(clamp(1.0+dot(rd,n),0.0,1.0), 4.0);
    col += fre*0.25*vec3(0.5,0.7,1.0);
  }

  col = pow(col, vec3(0.4545));
  col *= 1.0 - 0.09*length(uv);
  outColor = vec4(col, 1.0);
}
