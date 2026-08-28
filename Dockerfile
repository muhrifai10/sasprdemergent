FROM node:22-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY frontend/ ./
ARG REACT_APP_BACKEND_URL=
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
RUN yarn build

FROM python:3.13-slim
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/*.py ./
COPY --from=frontend /app/build ./frontend_dist
EXPOSE 8000
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
