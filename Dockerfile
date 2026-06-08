FROM node:20-alpine AS build
WORKDIR /usr/src/app
COPY package*.json .npmrc ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8082
