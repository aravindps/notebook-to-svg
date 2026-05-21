FROM node:20-bookworm-slim

# Debian bundles ImageMagick delegates in one package (avoids Alpine sub-package drift on Render).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        potrace \
        imagemagick \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY notebook-to-svg.sh ./
COPY server/package.json server/server.js ./

RUN chmod +x notebook-to-svg.sh \
    && magick -version \
    && magick identify -list format | grep -iE 'JPEG|PNG|WEBP|HEIC' | head -8 || true

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
