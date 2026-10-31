# Busora admin image: the static React build, served by Caddy on port 80.
#
# The admin calls the API at the relative /api/admin, so it works on any
# domain whose proxy sends /api/* to the API (see infra/Caddyfile.demo).

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV REACT_APP_API_URL=/api/admin \
    GENERATE_SOURCEMAP=false
RUN npm run build

FROM caddy:2-alpine
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/build /srv
EXPOSE 80
