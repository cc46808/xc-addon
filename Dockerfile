FROM node:20
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY . .
COPY start /start
EXPOSE 7000
CMD ["node", "addon.js"]
