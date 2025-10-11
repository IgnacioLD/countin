# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build args
ARG VITE_API_URL=http://localhost:8000

# Copy package files
COPY package*.json ./

# Install dependencies with optimizations
RUN npm ci --prefer-offline --no-audit --legacy-peer-deps 2>&1 | grep -v "deprecated" || true

# Copy source files
COPY . .

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL \
    NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=2048"

# Build the application
RUN npm run build

# Production stage - using minimal alpine base
FROM node:20-alpine

WORKDIR /app

# Install serve with minimal output
RUN npm install -g serve --quiet

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Default port
ENV PORT=3000

# Expose port
EXPOSE 3000

# Serve built files
CMD ["serve", "-s", "dist", "-l", "3000", "--no-clipboard"]
