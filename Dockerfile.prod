# Build stage
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile --production=false

# Copy source code
COPY . .

# Build the application
RUN yarn compile

# Production stage
FROM node:18-alpine AS production

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /usr/src/app

# Copy package files
COPY package.json yarn.lock ./

# Install only production dependencies
RUN yarn install --frozen-lockfile --production=true && yarn cache clean

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/ecosystem.config.json ./

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["yarn", "start"] 