FROM postgres:16-alpine

COPY apps/server/migrations/ /docker-entrypoint-initdb.d/
