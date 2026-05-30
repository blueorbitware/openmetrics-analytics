FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

# Copy go.mod files first for better caching
COPY services/worker/go.mod services/worker/go.sum* ./services/worker/
COPY packages/gocommon/go.mod packages/gocommon/go.sum* ./packages/gocommon/

# Copy source code
COPY packages/gocommon ./packages/gocommon
COPY services/worker ./services/worker

WORKDIR /app/services/worker
RUN go mod tidy && go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /worker ./cmd/main.go

FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /worker /worker

CMD ["/worker"]
