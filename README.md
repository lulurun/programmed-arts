# Programmed Arts

Parametric browser-based tools for creating printable programmed art.

## Projects

- [fish-pattern](fish-pattern/) - an interactive four-ellipse fish tessellation editor.

## Run

Run the fish-pattern tool:

```bash
npm start
```

Then open:

```text
http://localhost:4174/fish-pattern/
```

## Public Access

The API/static server can run as a user `systemd` service:

```bash
cp programmed-arts.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now programmed-arts.service
```

The public nginx proxy is managed by Eiger. Its tunnel mapping includes:

```text
programmed-arts 4174 2174
```

External URL:

```text
http://157.120.33.185:7700/programmed-arts/fish-pattern/
```

The previous single-fish pattern/layout implementation is preserved on the `v1` branch.

## Checks

```bash
npm run check
```
