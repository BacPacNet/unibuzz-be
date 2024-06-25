# development stage
FROM node:18 as base

WORKDIR /usr/src/app

COPY package.json yarn.lock tsconfig.json ecosystem.config.json ./

COPY ./src ./src

RUN ls -a

RUN yarn install --pure-lockfile && yarn compile

# CMD [ "yarn", "run", "dev"]
CMD [ "yarn", "start"]

# production stage

# FROM base as production

# WORKDIR /usr/prod/app

# ENV NODE_ENV=production

# COPY package.json yarn.lock ecosystem.config.json ./

# RUN yarn install --production=false --pure-lockfile

# COPY --from=base /usr/src/app/dist ./dist

# # CMD [ "yarn", "run", "dev"]
# CMD [ "yarn", "start"]
