FROM node:20
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 7000
CMD ["node", "addon.js"]
