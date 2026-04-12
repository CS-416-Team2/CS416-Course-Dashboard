# Use an official Python runtime as a parent image
FROM python:3.12-slim-bookworm

# Install system dependencies for MySQL and building tools
RUN apt-get update && apt-get install -y \
    pkg-config \
    default-libmysqlclient-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your application code
COPY . .

# Expose the port Flask runs on
EXPOSE 5000

# Command to run the application
# Using 0.0.0.0 is CRITICAL for Docker access
CMD ["gunicorn", "-b", "0.0.0.0:5000", "app:app"]
