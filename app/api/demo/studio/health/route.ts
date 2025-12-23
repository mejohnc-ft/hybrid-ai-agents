import { NextResponse } from 'next/server';
import { NPUAgentClient } from '@/lib/agents/npu-client';
import { MCPClient } from '@/lib/agents/mcp-client';
import { settingsStore, SETTING_KEYS } from '@/lib/settings-store';
import { getDemoDB } from '@/lib/demo-db';

interface TierHealth {
  status: 'healthy' | 'degraded' | 'unavailable';
  message: string;
  details?: Record<string, unknown>;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  tiers: {
    mcp: TierHealth;
    edge: TierHealth;
    cloud: TierHealth;
  };
  database: {
    connected: boolean;
    metrics_count: number;
  };
  settings: {
    npu_configured: boolean;
    cloud_configured: boolean;
    mcp_enabled: boolean;
  };
  timestamp: string;
}

export async function GET() {
  const health: SystemHealth = {
    overall: 'healthy',
    tiers: {
      mcp: { status: 'unavailable', message: 'Not checked' },
      edge: { status: 'unavailable', message: 'Not checked' },
      cloud: { status: 'unavailable', message: 'Not checked' },
    },
    database: {
      connected: false,
      metrics_count: 0,
    },
    settings: {
      npu_configured: false,
      cloud_configured: false,
      mcp_enabled: false,
    },
    timestamp: new Date().toISOString(),
  };

  // Check settings configuration
  const settings = settingsStore.getAll();
  health.settings.npu_configured = !!settings.npu_agent_url;
  health.settings.cloud_configured = !!settings.cloud_api_key;
  health.settings.mcp_enabled = settings.mcp_server_enabled;

  // Check database
  try {
    const db = getDemoDB();
    const analytics = db.getStudioAnalytics();
    health.database.connected = true;
    health.database.metrics_count = analytics.totalSessions;
  } catch {
    health.database.connected = false;
  }

  // Check MCP tier
  if (settings.mcp_server_enabled) {
    try {
      const mcpClient = new MCPClient();
      const mcpHealth = await mcpClient.healthCheck();

      if (mcpHealth.status === 'healthy') {
        health.tiers.mcp = {
          status: 'healthy',
          message: 'MCP server is running',
          details: {
            platform: mcpHealth.platform,
            tools_available: mcpHealth.tools_available.length,
            powershell: mcpHealth.powershell_available,
          },
        };
      } else {
        health.tiers.mcp = {
          status: 'degraded',
          message: 'MCP server is degraded',
          details: mcpHealth,
        };
      }
    } catch {
      health.tiers.mcp = {
        status: 'unavailable',
        message: 'MCP server is not reachable',
      };
    }
  } else {
    health.tiers.mcp = {
      status: 'unavailable',
      message: 'MCP server is disabled',
    };
  }

  // Check Edge/NPU tier
  if (settings.npu_agent_url) {
    try {
      const npuClient = NPUAgentClient.createWithUrl(settings.npu_agent_url);
      const npuHealth = await npuClient.healthCheck();

      if (npuHealth.status === 'healthy') {
        health.tiers.edge = {
          status: 'healthy',
          message: 'NPU agent is running',
          details: {
            model_loaded: npuHealth.model_loaded,
            vector_db_ready: npuHealth.vector_db_ready,
            kb_entries: npuHealth.kb_entries,
          },
        };
      } else {
        health.tiers.edge = {
          status: 'degraded',
          message: 'NPU agent is degraded',
          details: npuHealth,
        };
      }
    } catch {
      health.tiers.edge = {
        status: 'unavailable',
        message: 'NPU agent is not reachable',
      };
    }
  } else {
    health.tiers.edge = {
      status: 'unavailable',
      message: 'NPU agent URL not configured',
    };
  }

  // Check Cloud tier
  if (settings.cloud_api_key) {
    // We don't make an actual API call for health check to avoid costs
    // Just check if configuration looks valid
    const isAzure = settings.cloud_base_url.toLowerCase().includes('.azure.com');

    health.tiers.cloud = {
      status: 'healthy',
      message: 'Cloud API is configured',
      details: {
        endpoint_type: isAzure ? 'azure' : 'openai',
        model: settings.cloud_model,
        base_url: settings.cloud_base_url,
      },
    };
  } else {
    health.tiers.cloud = {
      status: 'unavailable',
      message: 'Cloud API key not configured',
    };
  }

  // Determine overall health
  const tierStatuses = [health.tiers.mcp, health.tiers.edge, health.tiers.cloud];
  const healthyCount = tierStatuses.filter((t) => t.status === 'healthy').length;
  const unavailableCount = tierStatuses.filter((t) => t.status === 'unavailable').length;

  if (healthyCount >= 2) {
    health.overall = 'healthy';
  } else if (unavailableCount === 3) {
    health.overall = 'unhealthy';
  } else {
    health.overall = 'degraded';
  }

  return NextResponse.json(health);
}
