# Multi-stage build for React frontend
FROM node:18-alpine AS base

WORKDIR /app

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "start"]

# Build stage
FROM base AS build
ENV NODE_ENV=production
RUN npm ci --only=production
COPY . .
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine AS production

# Copy built React app
COPY --from=build /app/build /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user
RUN addgroup -g 1001 -S nginx-user && \
    adduser -S nginx-user -u 1001 -G nginx-user

# Set proper permissions
RUN chown -R nginx-user:nginx-user /usr/share/nginx/html && \
    chown -R nginx-user:nginx-user /var/cache/nginx && \
    chown -R nginx-user:nginx-user /var/log/nginx && \
    chown -R nginx-user:nginx-user /etc/nginx/conf.d

# Switch to non-root user
USER nginx-user

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]