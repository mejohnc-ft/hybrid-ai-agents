/**
 * MCP Client - TypeScript client for Windows MCP Server
 * Communicates with the Python MCP server via HTTP
 */

export interface MCPToolInfo {
  name: string;
  description: string;
  parameters: Record<string, string>;
}

export interface MCPToolResult {
  success: boolean;
  result: Record<string, unknown> | null;
  error: string | null;
  execution_time_ms: number;
}

export interface MCPHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  powershell_available: boolean;
  tools_available: string[];
  platform: string;
  timestamp: string;
}

// MCP Tool parameter types
export interface PowerUsageParams {
  duration?: string;
  sort_by?: string;
  include_processes?: boolean;
}

export interface NetworkStatsParams {
  interface?: string;
  check_period?: string;
  deep_analysis?: boolean;
}

export interface SecurityLogParams {
  event_ids?: number[];
  timeframe?: string;
  include_ip_geo?: boolean;
}

export interface LargeFilesParams {
  min_size?: string;
  path?: string;
  include_temp?: boolean;
}

export interface WERReportParams {
  app_name?: string;
  recent?: number;
  include_stack_trace?: boolean;
}

export class MCPClient {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.MCP_SERVER_URL || 'http://localhost:8001') {
    this.baseUrl = baseUrl;
  }

  /**
   * Create a client with a specific URL
   */
  static createWithUrl(url: string): MCPClient {
    return new MCPClient(url);
  }

  /**
   * Get the base URL this client is configured to use
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Check if the MCP server is healthy and available
   */
  async healthCheck(): Promise<MCPHealthStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return {
          status: 'unhealthy',
          powershell_available: false,
          tools_available: [],
          platform: 'unknown',
          timestamp: new Date().toISOString(),
        };
      }

      return await response.json();
    } catch {
      return {
        status: 'unhealthy',
        powershell_available: false,
        tools_available: [],
        platform: 'unknown',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * List available MCP tools
   */
  async listTools(): Promise<MCPToolInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/tools`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to list tools: ${response.statusText}`);
      }

      const data = await response.json();
      return data.tools || [];
    } catch (error) {
      throw new Error(`MCP tool list failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Call an MCP tool
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<MCPToolResult> {
    try {
      const response = await fetch(`${this.baseUrl}/tools/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, arguments: args }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          result: null,
          error: `HTTP ${response.status}: ${errorText}`,
          execution_time_ms: 0,
        };
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        execution_time_ms: 0,
      };
    }
  }

  // Typed tool methods

  /**
   * Get power usage report
   */
  async getPowerUsageReport(params: PowerUsageParams = {}): Promise<MCPToolResult> {
    return this.callTool('get_power_usage_report', params);
  }

  /**
   * Get network adapter statistics
   */
  async getNetworkAdapterStats(params: NetworkStatsParams = {}): Promise<MCPToolResult> {
    return this.callTool('get_network_adapter_stats', params);
  }

  /**
   * Query Windows Security Event Log
   */
  async querySecurityLog(params: SecurityLogParams = {}): Promise<MCPToolResult> {
    return this.callTool('query_security_log', params);
  }

  /**
   * Scan for large files
   */
  async scanLargeFiles(params: LargeFilesParams = {}): Promise<MCPToolResult> {
    return this.callTool('scan_large_files', params);
  }

  /**
   * Get Windows Error Reporting data
   */
  async getWERReport(params: WERReportParams = {}): Promise<MCPToolResult> {
    return this.callTool('get_wer_report', params);
  }

  /**
   * Get general system information
   */
  async getSystemInfo(): Promise<MCPToolResult> {
    return this.callTool('get_system_info', {});
  }
}

// Singleton instance for use across the app
export const mcpClient = new MCPClient();
