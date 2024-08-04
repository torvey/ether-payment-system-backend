FROM node:20

WORKDIR /app

COPY package.json ./

COPY yarn.lock ./

RUN yarn

COPY src ./src

COPY . .

RUN yarn build

CMD [ "yarn", "start:dev" ]