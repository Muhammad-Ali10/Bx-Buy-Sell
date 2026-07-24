# ---------- Stage 1: Build ----------
    FROM node:18-alpine AS builder

    # Set working dir
    WORKDIR /usr/src/app
    
    # Copy dependencies
    COPY package*.json ./
    
    # Install ALL deps (dev + prod)
    RUN npm install
    
    
    # Copy source
    COPY . .

    RUN npx prisma generate


    # Build NestJS (dist folder)
    RUN npm run build
    
    
    # ---------- Stage 2: Production ----------
    FROM node:18-alpine
    
    WORKDIR /usr/src/app
    
    # Copy only package files again for prod deps
    COPY package*.json ./
    
    
    # Install only production deps
    RUN npm install --only=production

    # Copy built code from builder stage
    COPY --from=builder /usr/src/app/dist ./dist

    # Copy Prisma schema
    COPY --from=builder /usr/src/app/prisma ./prisma
    
    # Install Prisma
    RUN npx prisma generate
    
    
    
    # Copy built code from builder stage
    COPY --from=builder /usr/src/app/dist ./dist
    
    # Expose port
    EXPOSE 1230
    
    # Run app
    CMD ["node", "dist/src/main.js"]
    