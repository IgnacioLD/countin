FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Serve with vite preview
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
