FROM node:26-slim AS base

ADD .github/actions/package.json .github/actions/package-lock.json /action/
RUN cd /action && npm ci --omit=dev

ADD .github/actions/src /action/src
ENTRYPOINT ["node", "/action/src/index.js"]
