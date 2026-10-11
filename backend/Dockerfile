# ---- build stage -----------------------------------------------------------
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY . .
# Static binary (no cgo), trimmed paths, stripped symbols.
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/phibio-server .

# ---- runtime stage ---------------------------------------------------------
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata \
 && addgroup -S phibio && adduser -S -G phibio -h /data phibio \
 && mkdir -p /data && chown phibio:phibio /data
COPY --from=build /out/phibio-server /usr/local/bin/phibio-server
ENV PORT=8080 \
    DATA_DIR=/data
USER phibio
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
ENTRYPOINT ["/usr/local/bin/phibio-server"]
