FROM node:20-alpine

WORKDIR /app

# Accept build args
ARG VITE_API_URL=http://localhost:8000

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Serve with vite preview
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
