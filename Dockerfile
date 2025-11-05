# -----------------------------------------------------
# Stage 1: Build frontend with Node.js (Vite)
# -----------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY app/package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy source files and config
COPY app/vite.config.js ./
COPY app/src ./src

# Build frontend
RUN npm run build


# -----------------------------------------------------
# Stage 2: Build Go backend
# -----------------------------------------------------
FROM golang:1.24-alpine AS backend-builder

WORKDIR /build/src

# Copy Go module files (if present)
COPY app/src/go.* ./

# Copy Go source
COPY app/src/*.go ./

# Build binary
RUN if [ ! -f go.mod ]; then go mod init motivateme; fi && \
    go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -o /app/server .


# -----------------------------------------------------
# Stage 3: Final runtime image
# -----------------------------------------------------
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /app

# Copy Go binary
COPY --from=backend-builder /app/server .

# Copy built frontend
COPY --from=frontend-builder /app/dist ./dist

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

CMD ["./server"]
