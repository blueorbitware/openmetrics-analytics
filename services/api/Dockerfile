FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

# Copy all go.mod and go.sum files
COPY services/api/go.mod services/api/go.sum* ./services/api/
COPY packages/gocommon/go.mod packages/gocommon/go.sum* ./packages/gocommon/

# Copy source code
COPY packages/gocommon ./packages/gocommon
COPY services/api ./services/api

WORKDIR /app/services/api

# Tidy and download dependencies
RUN go mod tidy && go mod download

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /api ./cmd/main.go

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /api /api

EXPOSE 8080

CMD ["/api"]
