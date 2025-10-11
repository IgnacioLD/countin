FROM python:3.11-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache gcc musl-dev postgresql-dev postgresql-client

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY ./app /app/app

# Expose port
EXPOSE 8000

# Run with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
