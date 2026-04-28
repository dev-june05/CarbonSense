# Use an official, lightweight Python image
FROM python:3.11-slim

# Set the working directory
WORKDIR /app

# Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy your FastAPI server, the ONNX model, and everything else
COPY . .

# Cloud Run injects a $PORT environment variable (usually 8080). 
# We tell Uvicorn to bind to 0.0.0.0 so the outside world can reach it.
CMD exec uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}