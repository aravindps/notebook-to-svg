FROM node:20-alpine

RUN apk add --no-cache imagemagick potrace bash

WORKDIR /app

COPY notebook-to-svg.sh ./
COPY server/package.json server/server.js ./

RUN chmod +x notebook-to-svg.sh

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
