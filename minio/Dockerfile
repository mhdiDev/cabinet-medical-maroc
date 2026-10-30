# MinIO ne publie plus d'image Docker (ni sur Docker Hub, ni sur quay.io) :
# on compile la dernière release communautaire depuis le code source officiel.
FROM golang:1.24-alpine AS build
ARG MINIO_RELEASE=RELEASE.2025-10-15T17-29-55Z
RUN CGO_ENABLED=0 go install github.com/minio/minio@${MINIO_RELEASE}

FROM alpine:3.22
COPY --from=build /go/bin/minio /usr/local/bin/minio
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
