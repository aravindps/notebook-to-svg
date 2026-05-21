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

ImageMagick, Potrace, and format delegates (JPEG, PNG, HEIC, WebP) are **installed inside the image** — nothing on the host is required except Docker.

```bash
make setup
make up             # docker compose up --build -d  (rebuild after Dockerfile changes)
make down           # docker compose down
make logs           # follow container logs
```

**Health:** `GET http://127.0.0.1:8080/health` → `ok`

**Convert:** `POST http://127.0.0.1:8080/` with raw image bytes (JPEG/PNG/HEIC from iPhone). Uploads are saved with the correct extension so ImageMagick can decode them.

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

The API expects **raw image bytes** in the POST body — not JSON, not a URL string, not Form text fields.

1. **Receive** image from Share sheet (or **Select Photos**).
2. **Get contents of URL**
   - URL: `https://your-host/`
   - Method: **POST**
   - Headers: `Authorization` = `Bearer YOUR_TOKEN`
   - **Request Body: File** ← important (choose the image variable, not “Form”)
   - Do not set Content-Type manually unless you use File; the server sniffs JPEG/PNG/HEIC from bytes
3. **Text** — wrap the response:

   ```
   <div class="notebook-svg">
   [Contents of URL]
   </div>
   ```

4. Copy to clipboard → paste into your editor.

If you see `insufficient image data` or `image too small`, the Shortcut is not sending the photo file — fix **Request Body** to **File**.

Use your own host (home server, VPS, `make serve` behind a tunnel, etc.).


## Demo

Live example on a Bear Blog with theme-aware notebook ink: [inkandstillness.com](https://inkandstillness.com) (post: [Putting lines to thoughts](https://inkandstillness.com/putting-lines-to-thoughts/)). That site wraps SVG in `.ink-svg`; this repo uses `.notebook-svg` in examples — same idea, different class name.

## Prior art

The tracing step is well known (ImageMagick + Potrace gists since 2012). This repo packages **notebook-photo defaults**, **inline-embed SVG cleanup**, and an optional **self-contained Docker** API around one bash script.

## License

MIT — see [LICENSE](LICENSE).
