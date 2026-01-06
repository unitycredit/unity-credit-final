FROM node:20-alpine

# Build + run the Brain service (dist-brain) deterministically for AWS App Runner.
# If you need unity-brain instead, change SERVICE below to unity-brain.
ARG SERVICE=dist-brain

WORKDIR /app

# Install dependencies (better layer caching)
COPY ${SERVICE}/package.json ${SERVICE}/package-lock.json ./${SERVICE}/
RUN cd ${SERVICE} && npm ci

# Copy service source
COPY ${SERVICE} ./${SERVICE}

# Build TypeScript -> dist/
RUN cd ${SERVICE} && npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "cd ${SERVICE} && npm start"]


