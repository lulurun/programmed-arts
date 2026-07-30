# Fish Tessellation Lab

A browser-based editor for generating an elliptical fish tessellation from four parametric ellipses.

The app has two synchronized pages:

- `Pattern`: creates the single repeatable fish module from four rotated ellipses, mirrored arcs, eye point, and stroke settings.
- `Artwork`: uses the current module to create the final tessellated art with layout, spacing, scale, color palette, and fill style parameters.

Each ellipse exposes:

- center `cx`, `cy`
- semi-major axis `a`
- semi-minor axis `b`
- rotation `theta`
- arc start and end angles

The pattern canvas highlights calculated ellipse intersections and supports dragging ellipse centers or the eye point. The artwork page updates immediately from the current pattern.

Artwork layout controls include:

- row and column counts
- vertical pitch `Sy`
- horizontal spacing
- pattern scale
- x/y offsets
- color cell and background grid size
- palette preset and coloring style

## Run

From the repo root:

```bash
npm start
```

Then visit:

```text
http://localhost:4174/fish-pattern/
```

You can also open `fish-pattern/index.html` directly in a browser.

## Export

Use the controls at the bottom of the side panel:

- `Export SVG` downloads the current tessellated artwork as vector paths.
- `Export PNG` downloads a high-resolution raster image.

## Notes

The current implementation is dependency-free vanilla JavaScript and Canvas. Region coloring is implemented as deterministic sampled cells clipped inside the fish module, with an overlap style derived from ellipse containment counts. A full planar graph / minimal-cycle boolean face detector remains the natural next step if exact mathematical face extraction is required.

The previous single-fish pattern/layout tool is preserved on the `v1` branch.
