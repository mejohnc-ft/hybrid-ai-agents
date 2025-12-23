"""
NPU Agent Service - FastAPI backend for local T1 incident resolution
Uses Phi-3.5 ONNX model with DirectML for NPU acceleration
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import onnxruntime as ort
import chromadb
from chromadb.utils import embedding_functions
import json
import re
from pathlib import Path

app = FastAPI(title="NPU Agent Service", version="1.0.0")

# Enable CORS for Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class IncidentRequest(BaseModel):
    id: str
    summary: str
    description: str
    category: str | None = None
    user: dict
    metadata: dict = {}

class ResolutionResponse(BaseModel):
    confidence: float
    resolution: str
    reasoning: str
    similar_incidents: list[str]
    should_escalate: bool
    escalation_reason: str | None = None
    # Token usage tracking for Studio metrics
    tokens_input: int = 0
    tokens_output: int = 0

class KnowledgeEntry(BaseModel):
    incident_summary: str
    resolution: str
    category: str
    confidence: float

# Global variables for model and vector DB
phi_session = None
chroma_client = None
kb_collection = None

CONFIDENCE_THRESHOLD = 0.70
MODEL_PATH = Path("models/phi-3.5-mini-instruct.onnx")


def initialize_services():
    """Initialize ONNX Runtime and ChromaDB"""
    global phi_session, chroma_client, kb_collection

    # Initialize ChromaDB for RAG
    chroma_client = chromadb.PersistentClient(path="./kb_vectordb")

    # Use default embedding function (all-MiniLM-L6-v2)
    embedding_fn = embedding_functions.DefaultEmbeddingFunction()

    kb_collection = chroma_client.get_or_create_collection(
        name="incident_resolutions",
        embedding_function=embedding_fn,
        metadata={"description": "T1 incident resolutions knowledge base"}
    )

    # Initialize ONNX Runtime with DirectML (if model exists)
    if MODEL_PATH.exists():
        try:
            session_options = ort.SessionOptions()
            session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

            # DirectML execution provider for NPU/GPU
            providers = [
                ('DmlExecutionProvider', {
                    'device_id': 0,
                    'disable_metacommands': False
                }),
                'CPUExecutionProvider'  # Fallback
            ]

            phi_session = ort.InferenceSession(
                str(MODEL_PATH),
                sess_options=session_options,
                providers=providers
            )
            print(f"✓ Phi-3.5 model loaded with providers: {phi_session.get_providers()}")
        except Exception as e:
            print(f"⚠ Warning: Could not load ONNX model: {e}")
            print("  Service will use mock responses until model is available")
    else:
        print(f"⚠ Warning: Model not found at {MODEL_PATH}")
        print("  Service will use mock responses until model is available")

    print("✓ ChromaDB initialized")


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    initialize_services()


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": phi_session is not None,
        "vector_db_ready": kb_collection is not None,
        "kb_entries": kb_collection.count() if kb_collection else 0
    }


@app.post("/resolve", response_model=ResolutionResponse)
async def resolve_incident(incident: IncidentRequest):
    """
    Resolve incident using local NPU agent with RAG
    """
    try:
        # Step 1: RAG - Find similar resolved incidents
        similar_incidents = []
        context_docs = []

        if kb_collection and kb_collection.count() > 0:
            query = f"{incident.summary}\n{incident.description}"
            results = kb_collection.query(
                query_texts=[query],
                n_results=min(5, kb_collection.count())
            )

            if results['ids'] and results['ids'][0]:
                similar_incidents = results['ids'][0]
                context_docs = results['documents'][0] if results['documents'] else []

        # Step 2: Generate resolution
        # For now, use rule-based approach until model is available
        # In production, this would call run_phi_inference()
        resolution_text, reasoning = generate_resolution_rule_based(
            incident, context_docs
        )

        # Step 3: Calculate confidence
        confidence = calculate_confidence(resolution_text, reasoning, context_docs)

        # Step 4: Calculate token usage (estimation based on text length)
        # Approximation: ~4 characters per token for English text
        input_text = f"{incident.summary}\n{incident.description}"
        context_text = "\n".join(context_docs) if context_docs else ""
        full_input = input_text + context_text

        tokens_input = estimate_tokens(full_input)
        tokens_output = estimate_tokens(resolution_text + reasoning)

        return ResolutionResponse(
            confidence=confidence,
            resolution=resolution_text,
            reasoning=reasoning,
            similar_incidents=similar_incidents,
            should_escalate=confidence < CONFIDENCE_THRESHOLD,
            escalation_reason=(
                f"Confidence {confidence:.2f} below threshold {CONFIDENCE_THRESHOLD}"
                if confidence < CONFIDENCE_THRESHOLD else None
            ),
            tokens_input=tokens_input,
            tokens_output=tokens_output
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/kb/add")
async def add_knowledge_entry(entry: KnowledgeEntry):
    """Add a new resolution to the knowledge base"""
    try:
        if not kb_collection:
            raise HTTPException(status_code=503, detail="Vector DB not initialized")

        # Generate unique ID
        doc_id = f"kb_{kb_collection.count() + 1}"

        # Add to ChromaDB
        kb_collection.add(
            documents=[f"{entry.incident_summary}\n\nResolution:\n{entry.resolution}"],
            metadatas=[{
                "category": entry.category,
                "confidence": entry.confidence
            }],
            ids=[doc_id]
        )

        return {"success": True, "id": doc_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def generate_resolution_rule_based(incident: IncidentRequest, context_docs: list[str]) -> tuple[str, str]:
    """
    Generate resolution using rule-based approach
    This is a placeholder until the Phi-3.5 model is available
    """
    summary_lower = incident.summary.lower()
    desc_lower = incident.description.lower()

    # T1 incident patterns
    if any(kw in summary_lower or kw in desc_lower for kw in ['password', 'reset', 'forgot']):
        resolution = """1. Navigate to the password reset portal at [portal URL]
2. Enter the user's email address
3. Verify identity using security questions or MFA
4. Set a new temporary password
5. Instruct user to change password on first login
6. Verify user can successfully log in"""
        reasoning = "Standard password reset procedure for account access issues"
        return resolution, reasoning

    elif any(kw in summary_lower or kw in desc_lower for kw in ['license', 'activation', 'product key']):
        resolution = """1. Verify user's license entitlement in admin portal
2. Check if license is already assigned to another device
3. If available, assign license to user's device
4. Provide activation key and instructions
5. Guide user through activation process
6. Verify successful activation"""
        reasoning = "Standard license assignment and activation procedure"
        return resolution, reasoning

    elif any(kw in summary_lower or kw in desc_lower for kw in ['locked', 'account locked', 'disabled']):
        resolution = """1. Check account status in Active Directory/admin panel
2. Review recent login attempts and lockout reason
3. Unlock the account
4. Reset password if needed (security best practice)
5. Notify user of unlock and new credentials
6. Monitor for repeat lockouts"""
        reasoning = "Account unlock procedure with security verification"
        return resolution, reasoning

    elif any(kw in summary_lower or kw in desc_lower for kw in ['email', 'outlook', 'mail']):
        resolution = """1. Verify user's email account is active
2. Check mailbox quota and storage limits
3. Verify email client configuration (SMTP, IMAP/POP3)
4. Test send/receive functionality
5. Clear cache and restart email client if needed
6. Verify connectivity to mail server"""
        reasoning = "Standard email troubleshooting procedure"
        return resolution, reasoning

    elif any(kw in summary_lower or kw in desc_lower for kw in ['printer', 'print', 'printing']):
        resolution = """1. Verify printer is online and connected to network
2. Check printer queue for stuck jobs
3. Clear print queue if necessary
4. Reinstall printer driver if needed
5. Test print functionality
6. Verify user has appropriate permissions"""
        reasoning = "Standard printer troubleshooting procedure"
        return resolution, reasoning

    # If we have similar incidents from RAG, use them
    if context_docs:
        resolution = f"""Based on similar past incidents, recommended resolution:

{context_docs[0] if context_docs else 'No specific resolution found'}

Please verify this applies to the current situation."""
        reasoning = f"Found {len(context_docs)} similar incident(s) in knowledge base"
        return resolution, reasoning

    # Default response for unknown incidents
    resolution = """This incident requires further investigation. Recommended next steps:

1. Gather additional information from the user
2. Review system logs and error messages
3. Check for related incidents or known issues
4. Consult technical documentation
5. Consider escalation to specialist team

Due to limited information, this incident should be escalated to a human agent."""

    reasoning = "Incident pattern not recognized in T1 knowledge base - requires specialist attention"
    return resolution, reasoning


def estimate_tokens(text: str) -> int:
    """
    Estimate token count for text.
    Uses a simple approximation: ~4 characters per token for English text.
    For more accurate counts, could use tiktoken or the model's tokenizer.
    """
    if not text:
        return 0
    # Rough approximation: ~4 chars per token for English
    return max(1, len(text) // 4)


def calculate_confidence(resolution: str, reasoning: str, context_docs: list[str]) -> float:
    """
    Calculate confidence score for the resolution
    """
    score = 0.5  # Base score

    # Boost if we found similar incidents
    if len(context_docs) > 0:
        score += 0.2

    # Boost if resolution has clear steps
    if '1.' in resolution and '2.' in resolution:
        score += 0.15

    # Boost if reasoning is provided and substantial
    if len(reasoning) > 20:
        score += 0.15

    # Penalize if escalation is recommended in the resolution
    if 'escalat' in resolution.lower() or 'specialist' in resolution.lower():
        score -= 0.3

    # Ensure score is between 0 and 1
    return max(0.0, min(1.0, score))


def run_phi_inference(prompt: str) -> str:
    """
    Run inference using Phi-3.5 ONNX model
    This is a placeholder for actual ONNX model inference
    """
    # TODO: Implement actual ONNX model inference
    # This will require:
    # 1. Tokenization of input prompt
    # 2. Running inference through phi_session
    # 3. Decoding output tokens
    # 4. Parsing structured response

    if phi_session is None:
        raise RuntimeError("ONNX model not loaded")

    # Placeholder implementation
    return "Model inference not yet implemented"


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
