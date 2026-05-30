FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

# Copy go.mod files first for better caching
COPY services/collector/go.mod services/collector/go.sum* ./services/collector/
COPY packages/gocommon/go.mod packages/gocommon/go.sum* ./packages/gocommon/

# Copy source code
COPY packages/gocommon ./packages/gocommon
COPY services/collector ./services/collector

WORKDIR /app/services/collector
RUN go mod tidy && go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /collector ./cmd/main.go

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /collector /collector
COPY --from=builder /app/services/collector/static /static

EXPOSE 8081

CMD ["/collector"]
