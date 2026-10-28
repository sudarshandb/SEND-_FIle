FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production UPLOAD_DIR=/app/uploads
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server.js ./server.js
COPY models ./models
# Render Persistent Disk should be mounted at this exact path.
RUN mkdir -p /app/uploads
CMD ["npm", "start"]
