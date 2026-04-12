FROM python:3.11-slim

# Install system dependencies and Node.js 20
RUN apt-get update && apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python backend dependencies first (better caching)
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Install frontend dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy the rest of the project
COPY . .

# Build the Next.js app
# We pass a temporary dummy secret so Next.js static generation doesn't crash.
# Render will inject your REAL secret at runtime via the dashboard env vars!
RUN BETTER_AUTH_SECRET=dummy_secret_for_build_step_only_12345 pnpm build

# Create a bash script to start both the Python backend and the Next.js frontend
RUN echo '#!/bin/bash' > start.sh && \
    echo 'cd /app/backend' >> start.sh && \
    echo '# Start Python backend on internal port 8000' >> start.sh && \
    echo 'python -m uvicorn main:app --host 127.0.0.1 --port 8000 &' >> start.sh && \
    echo 'cd /app' >> start.sh && \
    echo '# Start Next.js frontend on Render provided PORT or 3000' >> start.sh && \
    echo 'export PORT=${PORT:-3000}' >> start.sh && \
    echo 'pnpm start --port $PORT' >> start.sh && \
    chmod +x start.sh

# Expose the Render port
EXPOSE 3000

# Run the boot script
CMD ["./start.sh"]