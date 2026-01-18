# Build Stage for React Frontend
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime Stage for Python Backend + Playwright
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# Create a non-root user (standard for HF Spaces)
RUN useradd -m -u 1000 user

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code with ownership
COPY --chown=user:user backend ./backend

# Copy built frontend from build stage with ownership
COPY --chown=user:user --from=build /app/dist ./static

# Switch to non-root user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# Expose Hugging Face Spaces default port
EXPOSE 7860

# Run FastAPI app on port 7860
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
