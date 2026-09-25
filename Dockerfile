FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The port the embed origin is published on. It has to be the HOST-side port,
# because the browser is what resolves it — so this and the compose port
# mapping change together. Unset, the app falls back to same-origin, which is
# safe but cannot draw the chart.
ARG VITE_EMBED_PORT=8081
ENV VITE_EMBED_PORT=$VITE_EMBED_PORT
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 8081
