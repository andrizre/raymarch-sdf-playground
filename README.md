# Raymarch SDF Playground

An interactive WebGL raymarching playground for **signed distance fields (SDFs)**.
Compose up to 24 primitives (spheres, boxes, tori, capsules), blend them with
polynomial smooth-min for organic merges, and watch the scene render live with
soft shadows, ambient occlusion, and fog — all in a single fragment shader.

## Features

- Live fragment-shader raymarcher (sphere tracing, 128 steps)
- 4 primitive types with position, size, blend (smooth-union k), and color controls
- Drag to orbit, scroll to zoom, right-drag to pan (touch supported)
- Presets (Blob / Sculpt / Tower), random scene generator
- Export your scene as a JS shape array
- Ground grid, fresnel rim lighting, gamma-correct output

## Run

Any static file server works (ES module script):

```sh
cd raymarch-sdf-playground
python3 -m http.server 8080
# open http://localhost:8080
```

No dependencies, no build step, no backend.
