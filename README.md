# notebook-to-svg

Turn a **notebook page photo** into an inline **SVG** with transparent paper and strokes set to `fill="currentColor"` so your site CSS controls color in light and dark themes.

Built on [Potrace](http://potrace.sourceforge.net/) and [ImageMagick](https://imagemagick.org/) only — no external tracing APIs.

## CLI

**Requires:** `magick` and `potrace`

```bash
# macOS
brew install potrace imagemagick

./notebook-to-svg.sh page.jpg > page.svg
```

Tune via environment variables: `LEVEL`, `THRESHOLD`, `TURDSIZE`, `SMOOTH`, `MAX_WIDTH` (see script header).

**Smoke test** (synthetic fixture):

```bash
make test-cli
```

## Local development

### CLI only

```bash
make setup          # copies .env.example → .env if missing
make test-cli       # generates test-fixture.png and runs the script
```

### HTTP API (no Docker)

```bash
make setup
make serve          # Node on http://127.0.0.1:8080 (uses repo notebook-to-svg.sh)
```

In another terminal:

```bash
make test-api       # POST test-fixture.png, writes /tmp/notebook-test.svg
```

Set `TOKEN` in `.env` for auth; `make test-api` reads it automatically.

### HTTP API (Docker)

```bash
make setup
make up             # docker compose up --build -d
make down           # docker compose down
make logs           # follow container logs
```

**Health:** `GET http://127.0.0.1:8080/health` → `ok`

**Convert:** `POST http://127.0.0.1:8080/` with raw image bytes (JPEG/PNG).

- Header: `Authorization: Bearer <TOKEN>` (required when `TOKEN` is set)
- Response: `image/svg+xml` with `fill="currentColor"`

Optional env vars are passed through to the script (`LEVEL`, `THRESHOLD`, etc.).

## Embed in HTML

Wrap the SVG so theme `color` flows into `currentColor`:

```html
<div class="notebook-svg">
  <!-- paste SVG from CLI or API here -->
</div>
```

Example CSS:

```css
.notebook-svg {
  color: var(--text-color, currentColor);
}
.notebook-svg svg {
  display: block;
  max-width: 100%;
  height: auto;
}
```

## iOS Shortcut (sketch)

1. **Receive** image from Share sheet.
2. **Get contents of URL** — `POST` to `https://your-host/` with **Bearer** token; body = image; show “Converting…” while waiting.
3. **Text** — combine:

   ```
   <div class="notebook-svg">
   [Contents of URL]
   </div>
   ```

4. Copy to clipboard → paste into your editor.

Use your own host (home server, VPS, `make serve` behind a tunnel, etc.).

## Prior art

The tracing step is well known (ImageMagick + Potrace gists since 2012). This repo packages **notebook-photo defaults**, **inline-embed SVG cleanup**, and an optional **self-contained Docker** API around one bash script.

## License

MIT — see [LICENSE](LICENSE).
