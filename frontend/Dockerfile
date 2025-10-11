# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build args
ARG VITE_API_URL=http://localhost:8000

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --prefer-offline --no-audit

# Copy source files
COPY . .

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install serve
RUN npm install -g serve

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Default port
ENV PORT=3000

# Expose port
EXPOSE 3000

# Serve built files
CMD ["serve", "-s", "dist", "-l", "3000", "--no-clipboard"]
