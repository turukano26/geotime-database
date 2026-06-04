FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json .npmrc ./
RUN npm install

COPY . .

EXPOSE 8082

CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "8082"]
