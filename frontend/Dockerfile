FROM node:20-alpine

WORKDIR /app

# Accept build args
ARG VITE_API_URL=http://localhost:8000

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies in one step
RUN npm ci --only=production && npm install -g serve

# Copy source files
COPY . .

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Default port
ENV PORT=3000

# Expose port
EXPOSE 3000

# Serve built files with longer timeout
CMD ["serve", "-s", "dist", "-l", "3000", "--no-clipboard"]
