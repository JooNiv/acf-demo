FROM node:24.10

WORKDIR /app

# Copy package files first to leverage docker layer caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --silent || npm install --silent

# Copy source
COPY . .

EXPOSE 5173

# Run dev server; Vite binds to 0.0.0.0 with --host
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
