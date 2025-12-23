# Hybrid AI Agents - Service Desk Automation

Edge-to-Cloud AI Agent System for intelligent service desk automation. Routes incidents between local NPU-powered agents (Microsoft Phi-3.5/Phi-4) and cloud-based Azure AI Foundry agents using confidence scoring, complexity detection, and knowledge gap analysis.

## Architecture Overview

```
Incident Intake (N8N/Email/Chat)
    ↓
Next.js API Route (/api/incidents/intake)
    ↓
Decision Engine (TypeScript)
    ├─→ NPU Agent (Local - Phi-3.5 + DirectML) → 70% T1 incidents
    └─→ Azure AI Foundry (Cloud - GPT-4o) → 30% T2+ incidents
         ↓
    Resolution OR Escalation to Human
         ↓
HaloPSA Ticket Updates + Documentation
```

## Features

- **Local NPU Agent**: T1 incidents resolved locally using Phi-3.5 on Windows NPU (zero cloud cost)
- **Cloud Agents**: Multi-agent system with GPT-4o for complex T2+ incidents
- **Smart Routing**: Confidence threshold (<70%), complexity detection, knowledge gaps, SLA enforcement
- **HaloPSA Integration**: Full ticket lifecycle automation
- **Analytics**: Real-time metrics and performance tracking

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- Windows machine with NPU (Intel Core Ultra, AMD Ryzen AI, or Qualcomm Snapdragon) - optional
- Supabase account
- Azure OpenAI access (for cloud agents)
- HaloPSA instance with API access

### Installation

1. **Clone and install dependencies**:
```bash
cd C:\Users\mejohnc\Documents\hybrid-ai-agents
npm install
```

2. **Set up Python NPU agent**:
```bash
cd src/services/npu-agent
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

3. **Configure environment variables**:
```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

4. **Set up Supabase**:
- Create a new Supabase project
- Run migrations from `supabase/migrations/` in the Supabase SQL editor
- Copy connection details to `.env.local`

### Running the Application

**Option 1: Run both services together**
```bash
npm run dev
```

**Option 2: Run services separately**
```bash
# Terminal 1: Next.js frontend/API
npm run dev

# Terminal 2: NPU Agent service
cd src/services/npu-agent
.venv\Scripts\activate
uvicorn server:app --reload --port 8000
```

**Option 3: Use VSCode debugger**
- Press F5 and select "Full Stack Debug"

### Access the Application

- **Frontend**: http://localhost:3000
- **NPU Agent API**: http://localhost:8000
- **API Docs (Swagger)**: http://localhost:8000/docs

## Project Structure

```
hybrid-ai-agents/
├── app/                    # Next.js 15 App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   └── page.tsx           # Home page
├── lib/                   # Shared TypeScript code
│   ├── agents/           # Agent clients
│   ├── integrations/     # HaloPSA, N8N
│   ├── orchestration/    # Decision engine
│   ├── supabase.ts       # Database client
│   └── types.ts          # Shared types
├── src/services/
│   └── npu-agent/        # Python NPU service
│       ├── server.py     # FastAPI backend
│       └── models/       # ONNX models
├── supabase/
│   └── migrations/       # Database schema
└── .vscode/              # VSCode config
```

## Configuration

### Environment Variables

See [.env.example](.env.example) for all required environment variables.

Key variables:
- `AZURE_OPENAI_ENDPOINT` - Azure OpenAI endpoint
- `AZURE_OPENAI_KEY` - Azure OpenAI API key
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `NPU_AGENT_URL` - NPU agent service URL (default: http://localhost:8000)
- `HALOPSA_BASE_URL` - HaloPSA instance URL
- `HALOPSA_CLIENT_ID` - HaloPSA OAuth client ID
- `HALOPSA_CLIENT_SECRET` - HaloPSA OAuth client secret

## API Endpoints

### Incident Intake

**POST /api/incidents/intake**
```json
{
  "summary": "User cannot access email",
  "description": "User John Doe reports unable to log into Outlook",
  "priority": "medium",
  "category": "Email",
  "user": {
    "email": "john@example.com",
    "name": "John Doe"
  }
}
```

Response:
```json
{
  "success": true,
  "incidentId": "uuid",
  "routing": {
    "route": "npu",
    "reasoning": "Resolved by local NPU agent",
    "confidence": 0.85
  },
  "resolution": {
    "agent": "npu",
    "resolution": "1. Navigate to password reset portal...",
    "confidence": 0.85
  }
}
```

**GET /api/incidents/intake?status=open&limit=50**

Fetch incidents with optional filtering.

## Development

### NPU Agent Service

The NPU agent currently uses rule-based resolution until the Phi-3.5 ONNX model is downloaded:

**To add the Phi-3.5 model**:
1. Download from Hugging Face: https://huggingface.co/microsoft/Phi-3.5-mini-instruct-onnx
2. Place `phi-3.5-mini-instruct.onnx` in `src/services/npu-agent/models/`
3. Restart the service

### Adding Knowledge Base Entries

```bash
curl -X POST http://localhost:8000/kb/add \
  -H "Content-Type: application/json" \
  -d '{
    "incident_summary": "Password reset request",
    "resolution": "1. Navigate to portal...",
    "category": "Access",
    "confidence": 0.9
  }'
```

## Testing

### Test NPU Agent

```bash
cd src/services/npu-agent
pytest tests/
```

### Test Next.js API

```bash
npm test
```

## Implementation Phases

This is **Phase 1: Foundation** ✅

- [x] Next.js 15 project initialized
- [x] Supabase database schema created
- [x] Python NPU agent service (rule-based)
- [x] NPU agent TypeScript client
- [x] Incident intake API route
- [x] VSCode development environment

### Next Steps (Phase 2: Cloud Integration)

- [ ] Implement Classifier Agent (Azure OpenAI)
- [ ] Build Specialist Resolver Agents
- [ ] Integrate Azure AI Search for RAG
- [ ] Create Multi-Agent Orchestrator

### Future Phases

- **Phase 3**: Routing & Orchestration (Decision Engine)
- **Phase 4**: HaloPSA Integration (Ticketing automation)
- **Phase 5**: Observability & Production (Monitoring, analytics)

## Success Metrics (Target)

- **NPU handling**: 70%+ T1 incidents (zero cloud cost)
- **Auto-resolution rate**: 85%+ incidents resolved without human
- **NPU inference**: <1.5s p95 latency
- **Cloud inference**: <8s p95 latency
- **Routing accuracy**: 95%+ correct T1/T2+ classification

## Resources

- **Plan Document**: `.claude/plans/eager-snacking-babbage.md`
- **Existing Patterns**:
  - PartnerProfit Azure foundry integration
  - Tabot Zustand store patterns
  - N8N HaloPSA workflows

## License

Private - Internal use only

## Support

For issues or questions, refer to the plan document or contact the development team.
