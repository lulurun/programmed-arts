# Fish Tessellation Lab

A browser-based editor for generating an elliptical fish tessellation from four parametric ellipses.

The app has two synchronized canvases:

- `Geometry Editor`: edits the four rotated ellipses, mirrored arcs, eye point, and vertical pitch.
- `Artwork Renderer`: repeats the fish module in alternating mirrored rows and columns, then applies palette and fill styles.

Each ellipse exposes:

- center `cx`, `cy`
- semi-major axis `a`
- semi-minor axis `b`
- rotation `theta`
- arc start and end angles

The geometry canvas highlights calculated ellipse intersections and supports dragging ellipse centers or the eye point. The artwork canvas updates immediately as parameters change.

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
