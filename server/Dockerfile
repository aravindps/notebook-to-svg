FROM node:20-alpine

# Alpine 3.19+ splits ImageMagick format support into sub-packages.
RUN apk add --no-cache \
    bash \
    potrace \
    imagemagick \
    imagemagick-jpeg \
    imagemagick-png \
    imagemagick-webp \
    imagemagick-heic \
    imagemagick-tiff

WORKDIR /app

COPY notebook-to-svg.sh ./
COPY server/package.json server/server.js ./

RUN chmod +x notebook-to-svg.sh \
    && magick -version \
    && magick identify -list format | grep -E '^(\s+)(JPEG|PNG|HEIC|WEBP)' || true

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
