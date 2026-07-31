# Fish Tessellation Lab

A browser-based editor for generating an elliptical fish tessellation from four parametric ellipses.

The app has two synchronized pages:

- `Pattern`: creates the single repeatable fish module from four center-line-symmetric ellipses, mirrored arcs, and a circular eye fixed on the center axis. Eye and E1-E4 are selected from the same five-button row.
- `Artwork`: uses the current module to create the final tessellated art with layout, spacing, scale, color palette, and fill style parameters.

Each ellipse exposes:

- leftmost x position
- width
- height
- percent visible from the left

All ellipses are symmetric around the center line. E1 and E4 always share width and height. E2 and E3 always share the same leftmost x position.
E1/E2 and E3/E4 are constrained as closed arc pairs: each pair has shared start and end points. The dependent arc controls are shown as fitted values when they are derived from the pair constraint.

The pattern canvas keeps its original aspect ratio, highlights calculated ellipse intersections, and supports dragging ellipse handles or the eye horizontally along the center line. There is no vertical pan or vertical element movement in the pattern editor. The artwork page updates immediately from the current pattern.

Parameter changes are saved to browser local storage in real time and restored on reload.

Use `Save Pattern` on the Pattern page to persist the current reusable pattern to the server under `saved-art/fish-pattern/`.

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
