FROM node:20-alpine

WORKDIR /app

# Install server dependencies
COPY server/package.json ./server/
RUN cd server && npm install --production

# Copy server code and public files
COPY server/ ./server/
COPY public/ ./public/

EXPOSE 8080

CMD ["node", "server/server.js"]
