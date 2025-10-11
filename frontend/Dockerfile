FROM node:20-alpine

WORKDIR /app

# Accept build args
ARG VITE_API_URL=http://localhost:8000

# Copy package files
COPY package*.json ./

# Install dependencies and serve
RUN npm ci && npm install -g serve

# Copy source files
COPY . .

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL

# Build the application
RUN npm run build

# Default port
ENV PORT=3000

# Expose port
EXPOSE ${PORT}

# Serve built files with serve
CMD ["sh", "-c", "serve -s dist -l ${PORT}"]
