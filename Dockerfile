# Build Stage for React Frontend
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime Stage for Python Backend + Playwright
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# Check if user 1000 exists, if not create it.
# We use numeric ID 1000 for HF Spaces compatibility.
RUN id -u 1000 &>/dev/null || useradd -m -u 1000 user

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code with numeric ownership (safe for any username)
COPY --chown=1000:1000 backend ./backend

# Copy built frontend with numeric ownership
COPY --chown=1000:1000 --from=build /app/dist ./static

# Switch to non-root user 1000
USER 1000
ENV HOME=/tmp \
    PATH=/tmp/.local/bin:$PATH

# Expose Hugging Face Spaces default port
EXPOSE 7860

# Run FastAPI app on port 7860
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
