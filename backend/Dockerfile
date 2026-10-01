FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

RUN mkdir -p /app/data
VOLUME ["/app/data"]

# Run as a non-root user
RUN addgroup -S flowbox && adduser -S flowbox -G flowbox
RUN chown -R flowbox:flowbox /app
USER flowbox

EXPOSE 4000
CMD ["node", "src/index.js"]
