# Multi-stage Dockerfile for MotivateMe dApp
# Stage 1: Build frontend with Node.js
FROM node:20-alpine AS frontend-builder

WORKDIR /build

# Copy package files
COPY app/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source files
COPY app/src/static ./src/static
COPY app/vite.config.js ./

# Build frontend
RUN npm run build

# Stage 2: Build Go binary
FROM golang:1.21-alpine AS backend-builder

WORKDIR /build

# Copy go.mod if it exists, otherwise we'll use go mod init
COPY app/src/go.* ./src/ 2>/dev/null || true

# Copy Go source
COPY app/src/*.go ./src/

# Build Go binary
WORKDIR /build/src
RUN if [ ! -f go.mod ]; then go mod init motivateme; fi && \
    CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /app/server .

# Stage 3: Runtime - minimal production image
FROM alpine:latest

# Add ca-certificates for HTTPS requests (if needed)
RUN apk --no-cache add ca-certificates

WORKDIR /app

# Copy Go binary from builder
COPY --from=backend-builder /app/server .

# Copy built frontend from frontend-builder
COPY --from=frontend-builder /build/dist ./dist

# Expose port 8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Run the binary
CMD ["./server"]

