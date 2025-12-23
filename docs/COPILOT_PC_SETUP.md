# Entra Nexus Studio - Copilot+ PC Setup Guide

This guide covers how to set up and run the Hybrid AI Agents demo on a Windows 11 Copilot+ PC with NPU acceleration.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        BROWSER (localhost:3000)                         │
│                     Entra Nexus Studio React UI                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     NEXT.JS APP (localhost:3000)                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ /api/demo/      │  │ /api/demo/      │  │ /api/demo/      │         │
│  │ studio/stream   │  │ studio/health   │  │ settings        │         │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │
│           │                    │                    │                   │
│           └────────────────────┼────────────────────┘                   │
│                                ▼                                        │
│              ┌─────────────────────────────────────┐                    │
│              │    Studio Decision Engine          │                    │
│              │    (3-Tier Orchestration)          │                    │
│              └─────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────────┘
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐
│  TIER 1: MCP    │    │  TIER 2: EDGE   │    │  TIER 3: CLOUD          │
│  localhost:8001 │    │  localhost:8000 │    │  api.openai.com or      │
│                 │    │                 │    │  *.openai.azure.com     │
│  Windows Tools: │    │  NPU Agent:     │    │                         │
│  - PowerShell   │    │  - Phi-3.5-mini │    │  - GPT-4o               │
│  - WMI queries  │    │  - ONNX Runtime │    │  - Azure OpenAI         │
│  - Event logs   │    │  - DirectML/NPU │    │  - Token tracking       │
└─────────────────┘    └─────────────────┘    └─────────────────────────┘
```

---

## Prerequisites

### Hardware Requirements
- **Windows 11 Copilot+ PC** with one of:
  - Intel Core Ultra (Meteor Lake) with NPU
  - AMD Ryzen AI (Hawk Point) with NPU
  - Qualcomm Snapdragon X Elite/Plus with NPU
- Minimum 16GB RAM recommended
- 10GB free disk space (for model + dependencies)

### Software Requirements
- Windows 11 23H2 or later
- Python 3.11+ ([Download](https://www.python.org/downloads/))
- Node.js 18+ ([Download](https://nodejs.org/))
- Git ([Download](https://git-scm.com/))
- PowerShell 5.1+ (built-in) or PowerShell 7+

### API Keys (for Cloud Tier)
- OpenAI API key ([Get one](https://platform.openai.com/api-keys)), OR
- Azure OpenAI deployment ([Azure Portal](https://portal.azure.com/))

---

## Part 1: Clone and Install the Project

### Step 1.1: Clone the Repository

```powershell
# Open PowerShell and navigate to your projects folder
cd C:\Users\YourName\Projects

# Clone the repository
git clone https://github.com/mejohnc-ft/hybrid-ai-agents.git
cd hybrid-ai-agents
```

### Step 1.2: Install Node.js Dependencies

```powershell
# Install npm packages
npm install
```

### Step 1.3: Create Environment File

```powershell
# Copy the example environment file
copy .env.example .env
```

Edit `.env` with your settings:
```bash
# Required for Cloud Tier
CLOUD_AI_API_KEY=sk-your-openai-key-here
CLOUD_AI_BASE_URL=https://api.openai.com/v1
CLOUD_AI_MODEL=gpt-4o

# OR for Azure OpenAI
# CLOUD_AI_BASE_URL=https://your-instance.openai.azure.com/
# CLOUD_AI_API_KEY=your-azure-key
# CLOUD_AI_MODEL=gpt-4o

# Local services (defaults work fine)
NPU_AGENT_URL=http://localhost:8000
MCP_SERVER_URL=http://localhost:8001

# Demo settings
DEMO_MODE=true
```

---

## Part 2: Set Up the NPU Agent (Tier 2 - Edge)

The NPU Agent runs Phi-3.5-mini locally using your device's Neural Processing Unit for fast, cost-free inference.

### Step 2.1: Create Python Virtual Environment

```powershell
# Navigate to the NPU agent service
cd src\services\npu-agent

# Create virtual environment
python -m venv .venv

# Activate it
.\.venv\Scripts\Activate.ps1
```

### Step 2.2: Install Python Dependencies

```powershell
# Install all required packages
pip install -r requirements.txt
```

**Key packages installed:**
| Package | Version | Purpose |
|---------|---------|---------|
| `onnxruntime-directml` | 1.19.0 | NPU acceleration via DirectML |
| `fastapi` | 0.115.0 | REST API framework |
| `uvicorn` | 0.32.0 | ASGI server |
| `chromadb` | 0.6.0 | Vector database for RAG |
| `sentence-transformers` | 3.5.1 | Embedding model |
| `transformers` | 4.47.1 | Hugging Face utilities |

### Step 2.3: Download the Phi-3.5 ONNX Model

The model needs to be downloaded from Hugging Face:

```powershell
# Create models directory
mkdir models

# Option A: Use Hugging Face CLI (recommended)
pip install huggingface_hub
huggingface-cli download microsoft/Phi-3.5-mini-instruct-onnx --local-dir models/phi-3.5-mini-instruct

# Option B: Manual download from:
# https://huggingface.co/microsoft/Phi-3.5-mini-instruct-onnx
# Extract to: src/services/npu-agent/models/
```

**Expected model structure:**
```
src/services/npu-agent/
├── models/
│   └── phi-3.5-mini-instruct/
│       ├── model.onnx              # Main model file (~3.8GB)
│       ├── model.onnx.data         # Model weights
│       ├── tokenizer.json          # Tokenizer config
│       └── ...
├── server.py
└── requirements.txt
```

### Step 2.4: Start the NPU Agent

```powershell
# Make sure you're in the npu-agent directory with venv activated
cd src\services\npu-agent
.\.venv\Scripts\Activate.ps1

# Start the server
python server.py
```

**Expected output:**
```
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Initializing NPU Agent with DirectML...
INFO:     Loading Phi-3.5-mini ONNX model...
INFO:     Model loaded successfully on DmlExecutionProvider
INFO:     ChromaDB initialized with 0 entries
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Step 2.5: Verify NPU Agent is Running

Open a new PowerShell window:
```powershell
# Test health endpoint
Invoke-RestMethod http://localhost:8000/health | ConvertTo-Json
```

**Expected response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "vector_db_ready": true,
  "kb_entries": 0
}
```

### NPU Agent Endpoints Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health and model status |
| `/resolve` | POST | Resolve an incident using local AI |
| `/kb/add` | POST | Add knowledge base entry |

---

## Part 3: Set Up the MCP Server (Tier 1 - Windows Tools)

The MCP Server provides Windows system diagnostics via PowerShell and WMI.

### Step 3.1: Create Python Virtual Environment

```powershell
# Navigate to MCP server directory
cd src\services\mcp-server

# Create virtual environment
python -m venv .venv

# Activate it
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

### Step 3.2: Start the MCP Server

```powershell
# Start the server (in the mcp-server directory with venv activated)
python server.py
```

**Expected output:**
```
INFO:     Started server process [12346]
INFO:     Uvicorn running on http://0.0.0.0:8001
INFO:     MCP Server ready with 6 tools available
```

### Step 3.3: Verify MCP Server

```powershell
# Test health endpoint
Invoke-RestMethod http://localhost:8001/health | ConvertTo-Json
```

**Expected response:**
```json
{
  "status": "healthy",
  "powershell_available": true,
  "tools_available": [
    "get_power_usage_report",
    "get_network_adapter_stats",
    "query_security_log",
    "scan_large_files",
    "get_wer_report",
    "get_system_info"
  ],
  "platform": "win32",
  "timestamp": "2024-12-23T10:00:00Z"
}
```

### MCP Tools Reference

| Tool | Description | Permission |
|------|-------------|------------|
| `get_power_usage_report` | Battery drain analysis, top CPU processes | Standard User |
| `get_network_adapter_stats` | Network interface diagnostics | Standard User |
| `query_security_log` | Windows Security Event Log | **Administrator** |
| `scan_large_files` | Find large files consuming disk space | Standard User |
| `get_wer_report` | Windows Error Reporting crash dumps | Standard User |
| `get_system_info` | OS, CPU, memory, uptime info | Standard User |

**Note:** The `query_security_log` tool requires administrator privileges. Run PowerShell as Administrator if you need this tool.

### MCP Server Endpoints Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health and tool availability |
| `/tools` | GET | List all available tools |
| `/tools/call` | POST | Execute a specific tool |

**Example tool call:**
```powershell
$body = @{
    name = "get_system_info"
    arguments = @{}
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8001/tools/call" -Method Post -Body $body -ContentType "application/json"
```

---

## Part 4: Start the Next.js Frontend

### Step 4.1: Start Development Server

Open a new PowerShell window in the project root:

```powershell
cd C:\Users\YourName\Projects\hybrid-ai-agents

# Start Next.js development server
npm run dev
```

**Expected output:**
```
▲ Next.js 15.x.x
- Local:        http://localhost:3000
- Environments: .env

✓ Starting...
✓ Ready in 2.3s
```

### Step 4.2: Access the Demo

Open your browser to: **http://localhost:3000/demo/studio**

---

## Part 5: Configure API Keys via Web UI

The Entra Nexus Studio has a built-in settings panel for configuring API keys without editing files.

### Step 5.1: Open Settings Panel

1. Navigate to http://localhost:3000/demo/studio
2. Click the **gear icon** (⚙️) in the top-right corner
3. The settings panel will slide open

### Step 5.2: Configure Services

**NPU Agent Settings:**
- URL: `http://localhost:8000` (default)
- Click "Test Connection" to verify

**Cloud API Settings:**
- Provider: OpenAI or Azure OpenAI
- API Key: Enter your key (stored encrypted in SQLite)
- Base URL:
  - OpenAI: `https://api.openai.com/v1`
  - Azure: `https://your-instance.openai.azure.com/`
- Model: `gpt-4o` or your deployment name
- Click "Test Connection" to verify

**MCP Server Settings:**
- Enabled: Toggle on/off
- URL: `http://localhost:8001` (default)

### Step 5.3: Save Settings

Click **Save** to persist settings to the local SQLite database.

---

## Part 6: Running Demo Scenarios

### Available Scenarios

The demo includes two scenario categories:

**Windows IT Scenarios** (use MCP tools):
| Scenario | MCP Tool | Description |
|----------|----------|-------------|
| Battery Drain Analysis | `get_power_usage_report` | Diagnose rapid battery drain |
| Network Latency Check | `get_network_adapter_stats` | Troubleshoot slow connections |
| Security Audit | `query_security_log` | Check for suspicious logins |
| Storage Optimization | `scan_large_files` | Find disk space hogs |
| App Crash Debugging | `get_wer_report` | Analyze application crashes |

**Service Desk Scenarios** (knowledge-based):
| Scenario | Tier | Description |
|----------|------|-------------|
| Password Reset | T1 (Edge) | Standard password reset request |
| License Activation | T1 (Edge) | Software license assistance |
| Account Locked | T1 (Edge) | Unlock user account |
| VPN Connection Issue | T2+ (Cloud) | Complex VPN troubleshooting |
| Security Alert | T2+ (Cloud) | Investigate security incident |
| Integration Failure | T2+ (Cloud) | API/system integration issue |

### Running a Scenario

1. Select a scenario from the dropdown
2. Click **Run Scenario**
3. Watch the real-time console output showing:
   - Tier routing decisions
   - Tool executions
   - Agent reasoning
   - Token counts
   - Latency measurements
4. View the generated ticket output (HaloPSA format)

### Understanding the 3-Tier Flow

```
Scenario Input
      │
      ▼
┌─────────────────────────────────────────┐
│ TIER 1: MCP (if mcp_tool specified)     │
│ - Execute Windows system tool           │
│ - Gather diagnostic data                │
│ - Cost: $0 (local)                      │
└─────────────────────────────────────────┘
      │ Tool results passed to Edge
      ▼
┌─────────────────────────────────────────┐
│ TIER 2: EDGE (NPU Agent)                │
│ - Phi-3.5-mini inference                │
│ - RAG with knowledge base               │
│ - Confidence threshold: 70%             │
│ - Cost: $0 (local)                      │
└─────────────────────────────────────────┘
      │ If confidence < 70%, escalate
      ▼
┌─────────────────────────────────────────┐
│ TIER 3: CLOUD (if escalated)            │
│ - GPT-4o / Azure OpenAI                 │
│ - Full context from Edge attempt        │
│ - Token usage tracked                   │
│ - Cost: ~$0.01-0.05 per request         │
└─────────────────────────────────────────┘
```

---

## Part 7: Defining Custom MCP Tools

### Tool Definition Structure

MCP tools are defined in `src/services/mcp-server/server.py`:

```python
# Tool metadata registry
MCP_TOOLS = {
    "your_tool_name": {
        "description": "What this tool does",
        "parameters": {
            "param1": "Description of parameter 1",
            "param2": "Description of parameter 2"
        }
    }
}

# Tool handler mapping
TOOL_HANDLERS = {
    "your_tool_name": your_tool_function,
}
```

### Creating a New Tool

**Step 1:** Add tool metadata to `MCP_TOOLS` dict:

```python
MCP_TOOLS = {
    # ... existing tools ...

    "get_installed_software": {
        "description": "List installed software with version info",
        "parameters": {
            "filter": "Optional filter string for software name",
            "limit": "Maximum number of results (default: 20)"
        }
    }
}
```

**Step 2:** Implement the handler function:

```python
def get_installed_software(filter: str = "", limit: int = 20) -> dict:
    """Query installed software via WMI."""

    # Build PowerShell script
    script = f'''
    $software = Get-WmiObject -Class Win32_Product |
        Select-Object Name, Version, Vendor |
        Where-Object {{ $_.Name -like "*{filter}*" }} |
        Select-Object -First {limit}
    $software | ConvertTo-Json
    '''

    success, output = run_powershell(script)

    if not success:
        return {
            "error": output,
            "software": []
        }

    try:
        software_list = json.loads(output) if output else []
        return {
            "count": len(software_list),
            "software": software_list
        }
    except json.JSONDecodeError:
        return {
            "error": "Failed to parse output",
            "raw_output": output
        }
```

**Step 3:** Register the handler:

```python
TOOL_HANDLERS = {
    # ... existing handlers ...
    "get_installed_software": get_installed_software,
}
```

**Step 4:** Restart the MCP server to load the new tool.

### PowerShell Execution Helper

All tools use the `run_powershell()` helper:

```python
def run_powershell(script: str) -> tuple[bool, str]:
    """Execute PowerShell script and return (success, output)."""
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", script],
            capture_output=True,
            text=True,
            timeout=30  # 30-second timeout
        )
        return (result.returncode == 0, result.stdout or result.stderr)
    except subprocess.TimeoutExpired:
        return (False, "Command timed out after 30 seconds")
    except Exception as e:
        return (False, str(e))
```

### WMI Classes Reference

Common WMI classes for system tools:

| WMI Class | Data Available |
|-----------|----------------|
| `Win32_Battery` | Battery status, charge %, estimated runtime |
| `Win32_OperatingSystem` | OS name, version, uptime, memory |
| `Win32_Processor` | CPU name, cores, speed |
| `Win32_ComputerSystem` | Computer name, total memory |
| `Win32_DiskDrive` | Physical disks |
| `Win32_LogicalDisk` | Drive letters, free space |
| `Win32_NetworkAdapter` | Network interfaces |
| `Win32_Process` | Running processes |
| `Win32_Service` | Windows services |
| `Win32_Product` | Installed software |

---

## Part 8: Troubleshooting

### NPU Agent Issues

**Model not loading:**
```
INFO: Model file not found, running in fallback mode
```
- Verify model exists at `src/services/npu-agent/models/phi-3.5-mini-instruct/model.onnx`
- The service will use rule-based resolution until model is available

**DirectML not available:**
```
WARNING: DmlExecutionProvider not available, falling back to CPU
```
- Ensure Windows 11 is updated (23H2+)
- Update graphics drivers
- Service will still work using CPU (slower)

**Port 8000 in use:**
```powershell
# Find what's using the port
netstat -ano | findstr :8000

# Kill the process (replace PID)
taskkill /PID <PID> /F
```

### MCP Server Issues

**PowerShell execution policy:**
```powershell
# If scripts are blocked, run as Admin:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Security log access denied:**
- Run MCP server from an elevated PowerShell (Run as Administrator)
- Or accept that `query_security_log` returns simulated data

### Next.js Issues

**Port 3000 in use:**
```powershell
# Use a different port
npm run dev -- -p 3001
```

**Dependencies missing:**
```powershell
# Clean install
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### General Connection Issues

**Test all services:**
```powershell
# NPU Agent
Invoke-RestMethod http://localhost:8000/health

# MCP Server
Invoke-RestMethod http://localhost:8001/health

# Studio Health (requires Next.js running)
Invoke-RestMethod http://localhost:3000/api/demo/studio/health
```

---

## Part 9: Production Deployment

### Running Services in Background

**Using PM2 (Node.js process manager):**
```powershell
# Install PM2 globally
npm install -g pm2

# Start Next.js
pm2 start npm --name "nextjs" -- run start

# View logs
pm2 logs nextjs
```

**Using Python background service:**
```powershell
# NPU Agent (no reload for production)
cd src\services\npu-agent
.\.venv\Scripts\python.exe -m uvicorn server:app --host 0.0.0.0 --port 8000

# MCP Server
cd src\services\mcp-server
.\.venv\Scripts\python.exe -m uvicorn server:app --host 0.0.0.0 --port 8001
```

### Windows Service Installation

For persistent services, consider using NSSM (Non-Sucking Service Manager):

```powershell
# Download NSSM from https://nssm.cc/
# Install NPU Agent as service
nssm install NPUAgent "C:\path\to\npu-agent\.venv\Scripts\python.exe" "-m uvicorn server:app --host 0.0.0.0 --port 8000"
nssm set NPUAgent AppDirectory "C:\path\to\npu-agent"
nssm start NPUAgent
```

---

## Quick Reference: Default Ports

| Service | Port | URL |
|---------|------|-----|
| Next.js Frontend | 3000 | http://localhost:3000 |
| NPU Agent (Edge) | 8000 | http://localhost:8000 |
| MCP Server (Tools) | 8001 | http://localhost:8001 |
| Cloud API | 443 | https://api.openai.com/v1 |

---

## Quick Reference: File Locations

```
hybrid-ai-agents/
├── .env                              # Environment configuration
├── src/
│   └── services/
│       ├── npu-agent/
│       │   ├── server.py             # NPU agent FastAPI server
│       │   ├── requirements.txt      # Python dependencies
│       │   └── models/               # Phi-3.5 ONNX model
│       └── mcp-server/
│           ├── server.py             # MCP tools FastAPI server
│           └── requirements.txt      # Python dependencies
├── lib/
│   ├── agents/
│   │   ├── npu-client.ts             # NPU agent TypeScript client
│   │   ├── mcp-client.ts             # MCP tools TypeScript client
│   │   └── cloud-client.ts           # Cloud API client
│   ├── orchestration/
│   │   └── studio-decision-engine.ts # 3-tier routing logic
│   ├── settings-store.ts             # Encrypted settings storage
│   └── pricing.ts                    # Token cost calculations
└── app/
    └── demo/
        └── studio/
            ├── page.tsx              # Studio main page
            └── components/
                ├── EntraNexusStudio.tsx  # Main UI
                └── SettingsPanel.tsx     # Settings UI
```
