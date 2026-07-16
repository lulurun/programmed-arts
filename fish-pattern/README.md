# Fish Pattern

A browser-based tool for digitizing one hand-drawn fish motif before turning it into a repeatable A0 poster layout.

The fish is built from the hand-drawn pattern:

- 4 ellipse arcs
- 1 filled circle for the eye
- all four ellipse centers and the eye center stay on the same horizontal center line

The renderer exposes sliders for each ellipse instance:

- X position
- width
- height
- how much of the ellipse is visible from the left side

The Y position is fixed for every component so the motif stays aligned. Ellipse 4 reuses ellipse 1's width and height, so they always have the same ellipse shape while using different X positions and visible-left amounts.
Ellipse 3 always shows 100 percent from the left side.

The app has two views:

- `Pattern`: edit one basic fish pattern, then save or load parameter sets.
- `Layout`: save/load full layouts, see saved parameter sets, add fish instances from them, adjust each fish's X position, add an X-flipped instance when needed, and export an A0 landscape SVG.

Saved patterns and saved layouts are stored in the browser's local storage.

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
When served through `npm start`, saved patterns and layouts are persisted as JSON files under `saved-art/fish-pattern/`.
To migrate old browser-local saves, open DevTools on `http://localhost:4174/fish-pattern/` and run `exportLocalStorageToServer()`.

## Export Workflow

1. Adjust each ellipse's X position, width, height, and visible-left amount until the body, tail, and eye match the hand-drawn motif.
   You can use either the slider or the numeric input beside it.
2. Keep `Guides` enabled to verify the four ellipse centers and eye center share the same horizontal axis.
3. Turn on `Full ellipses` when you want to inspect the underlying ellipse shapes.
4. Save the pattern, switch to `Layout`, then add normal or flipped fish instances from the saved list.
5. Tune layout X positions and layout zoom against the A0 frame.
6. Use `Export Layout SVG` for an A0 landscape SVG, or `Export Layout PNG` for a raster preview.

## Files

- `index.html` - browser app shell
- `src/art.js` - pattern and layout drawing logic
- `src/styles.css` - UI styles
- `exports/fish-layout.svg` - example generated layout export
- `references/` - source sketch photo
