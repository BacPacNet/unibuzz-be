# development stage
FROM node:14 as base

WORKDIR /usr/src/app

ENV NODE_OPTIONS="--max-old-space-size=8192"

COPY package.json yarn.lock tsconfig.json ecosystem.config.json ./

COPY ./src ./src

RUN ls -a

EXPOSE 8000

RUN yarn install --pure-lockfile && yarn compile

# production stage

#FROM base as production

#WORKDIR /usr/prod/app

#ENV NODE_ENV=production

#COPY package.json yarn.lock ecosystem.config.json ./

#RUN yarn install --production=false --pure-lockfile

#COPY --from=base /usr/src/app/dist ./dist

CMD [ "yarn", "run", "dev"]