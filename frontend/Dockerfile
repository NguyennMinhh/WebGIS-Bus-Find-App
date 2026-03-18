FROM node:20-alpine

WORKDIR /app

# Cài dependencies trước (cache layer)
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

EXPOSE 5173

# --host expose ra ngoài container, cần thiết cho Docker
CMD ["npm", "run", "dev"]
