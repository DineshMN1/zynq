FROM postgres:16-alpine

COPY server/migrations/ /docker-entrypoint-initdb.d/
