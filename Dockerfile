FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
RUN bun run build

COPY ./dist ./public .

CMD ["bun", "run", "start"]
