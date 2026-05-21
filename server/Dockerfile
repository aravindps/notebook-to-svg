FROM node:20-bookworm-slim

# NOT Alpine — Render must build from aravindps/notebook-to-svg @ main

RUN echo "BUILD: debian-bookworm imagemagick (not apk)" \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        potrace \
        imagemagick \
        libmagickcore-6.q16-6-extra \
    && rm -rf /var/lib/apt/lists/* \
    && for policy in /etc/ImageMagick-6/policy.xml /etc/ImageMagick/policy.xml; do \
        if [ -f "$policy" ]; then \
            sed -i 's/rights="none" pattern="@\*"/rights="read|write" pattern="@*"/' "$policy"; \
            sed -i 's/name="memory" value="256MiB"/name="memory" value="512MiB"/' "$policy"; \
            sed -i 's/name="width" value="16KP"/name="width" value="32KP"/' "$policy"; \
            sed -i 's/name="height" value="16KP"/name="height" value="32KP"/' "$policy"; \
        fi; \
    done

WORKDIR /app

COPY notebook-to-svg.sh ./
COPY server/package.json server/server.js ./

RUN chmod +x notebook-to-svg.sh \
    && (command -v magick || command -v convert) \
    && (magick -version 2>/dev/null || convert -version) \
    && (magick identify -list format 2>/dev/null || convert -list format) \
        | grep -iE 'JPEG|PNG|WEBP|HEIC' | head -8 || true

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
