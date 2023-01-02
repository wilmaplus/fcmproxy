FROM node:18

WORKDIR /usr/src/app
COPY . .
RUN npm install

VOLUME /usr/src/app/data
ENV FCM_PATH=/usr/src/app/data/fcmcred.json
ENV SENDER_ID=${SENDER_ID}


CMD ["node", "/usr/src/app/main.js"]
