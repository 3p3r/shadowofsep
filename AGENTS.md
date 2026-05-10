# Agent notes — shadowofsep

Portfolio site: React + Vite hosts a single full-screen **Phaser 4** game. There is no separate “game” DOM tree beyond one div; Phaser owns the canvas.

## Rendering model

- Internal resolution is **256×240** (`VirtualCRT.WIDTH` / `HEIGHT`). Layers draw into one or more `VirtualCRT` instances (backing `canvas` + `ImageData`).
- Each pass is registered with Phaser as a `CanvasTexture`, scaled to the viewport, with **`FilterMode.NEAREST`** so upscaling stays crisp.
- **Do not** call `CanvasTexture.update()` on every frame unless necessary; we mutate our own buffer, `present()` via `putImageData`, then **`refresh()`** once per layer per frame (GPU upload cost is expected).

See `CRTScene` in [`src/PhaserGame.tsx`](src/PhaserGame.tsx): an ordered **`passes`** table drives texture registration, resize, per-frame `clear → renderTo → present → refresh`, and sub-pixel `image.x` from `fractionalScroll` (or Liberty parallax).

## Layout

| Path | Role |
|------|------|
| [`src/PhaserGame.tsx`](src/PhaserGame.tsx) | Phaser bootstrap, scene, input, pass loop |
| [`src/crt/VirtualCRT.ts`](src/crt/VirtualCRT.ts) | Framebuffer: `clear`, `setPixel`, `drawTextureSlice`, `drawAlphaSlice` |
| [`src/crt/layers/`](src/crt/layers/) | `Layer` subclasses (tiles or custom `renderTo`) |
| [`src/palette.ts`](src/palette.ts) | `palette` (`#RRGGBB`) + pre-decoded **`paletteRgb`** for hot paths |

## Conventions

- Prefer **`paletteRgb`** over parsing hex in layer modules.
- Shared opaque writes to tile buffers: [`src/crt/layers/pixels.ts`](src/crt/layers/pixels.ts) `writeRgba`.
- New background art: either tile strips on `Layer` + `tiles`, or override `renderTo` (see `ShootingStarLayer`, `LibertyLayer`).
- Keep [`src/crt/index.ts`](src/crt/index.ts) exports stable if anything imports from `./crt`.

## Commands

```bash
npm run dev      # Vite dev server
npm run build    # tsc --noEmit && vite build
npm run lint     # biome check
npm run format   # biome format --write
```

## Pitfalls

- Resize math adds **one CRT pixel** of width to the scale factor so sub-pixel negative `x` does not expose the Phaser clear color at the right edge.
- `libertyPixels.ts` uses `biome-ignore format` on the pixel grid; don’t run a blanket formatter that collapses those rows.
