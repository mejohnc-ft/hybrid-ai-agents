# NPU Agent Service

FastAPI backend service for local T1 incident resolution using Phi-3.5 ONNX model with DirectML.

## Setup

1. Create virtual environment:
```bash
python -m venv .venv
.venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Download Phi-3.5 ONNX model (optional for now):
```bash
# Model will be downloaded from Hugging Face
# Place in ./models/phi-3.5-mini-instruct.onnx
```

## Running the Service

```bash
# Development mode
uvicorn server:app --reload --port 8000

# Production mode
uvicorn server:app --host 0.0.0.0 --port 8000
```

## API Endpoints

### POST /resolve
Resolve incident using local NPU agent with RAG

### GET /health
Health check and service status

### POST /kb/add
Add new resolution to knowledge base

## Notes

- Service currently uses rule-based resolution until Phi-3.5 model is downloaded
- ChromaDB vector database is automatically initialized on first run
- DirectML provider is used for NPU acceleration (falls back to CPU)
