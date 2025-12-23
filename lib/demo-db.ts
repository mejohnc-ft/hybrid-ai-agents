import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';

const DB_PATH = path.join(process.cwd(), 'demo-data.db');

export interface DemoIncident {
  id: string;
  summary: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'escalated' | 'closed';
  created_at: number;
  updated_at: number;
}

export interface DemoResolution {
  id: string;
  incident_id: string;
  agent: 'npu' | 'cloud';
  resolution: string;
  confidence: number;
  agent_chain?: string;
  latency_ms: number;
  resolved_at: number;
}

export interface DemoRoutingDecision {
  id: string;
  incident_id: string;
  route: 'npu' | 'cloud';
  reasoning: string;
  confidence: number;
  timestamp: number;
}

export interface DemoActivityLog {
  id: string;
  incident_id: string;
  timestamp_ms: number;
  event_type: string;
  description: string;
  metadata?: string;
}

export interface DemoChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'agent';
  content: string;
  route?: 'npu' | 'cloud';
  confidence?: number;
  latency_ms?: number;
  escalated?: number;
  created_at: number;
}

// Studio Settings for runtime configuration
export interface StudioSetting {
  key: string;
  value: string;
  encrypted: number; // 0 or 1
  updated_at: number;
}

// Studio Metrics for tracking token usage and costs
export interface StudioMetric {
  id: string;
  session_id: string;
  scenario_id?: string;
  tier: 'mcp' | 'edge' | 'cloud';
  latency_ms: number;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  created_at: number;
}

export class DemoDB {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        summary TEXT NOT NULL,
        description TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS incident_resolutions (
        id TEXT PRIMARY KEY,
        incident_id TEXT NOT NULL,
        agent TEXT NOT NULL,
        resolution TEXT NOT NULL,
        confidence REAL NOT NULL,
        agent_chain TEXT,
        latency_ms INTEGER NOT NULL,
        resolved_at INTEGER NOT NULL,
        FOREIGN KEY (incident_id) REFERENCES incidents(id)
      );

      CREATE TABLE IF NOT EXISTS routing_decisions (
        id TEXT PRIMARY KEY,
        incident_id TEXT NOT NULL,
        route TEXT NOT NULL,
        reasoning TEXT NOT NULL,
        confidence REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (incident_id) REFERENCES incidents(id)
      );

      CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY,
        incident_id TEXT NOT NULL,
        timestamp_ms INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        description TEXT NOT NULL,
        metadata TEXT,
        FOREIGN KEY (incident_id) REFERENCES incidents(id)
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        route TEXT,
        confidence REAL,
        latency_ms INTEGER,
        escalated INTEGER,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
      CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_log_incident_id ON activity_log(incident_id, timestamp_ms);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);

      -- Studio settings for runtime API configuration
      CREATE TABLE IF NOT EXISTS studio_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        encrypted INTEGER DEFAULT 0,
        updated_at INTEGER NOT NULL
      );

      -- Studio metrics for tracking token usage and costs
      CREATE TABLE IF NOT EXISTS studio_metrics (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        scenario_id TEXT,
        tier TEXT NOT NULL,
        latency_ms INTEGER NOT NULL,
        tokens_input INTEGER NOT NULL,
        tokens_output INTEGER NOT NULL,
        cost_usd REAL NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_studio_metrics_session ON studio_metrics(session_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_studio_metrics_tier ON studio_metrics(tier);
    `);
  }

  // Incident CRUD
  createIncident(data: Omit<DemoIncident, 'id' | 'created_at' | 'updated_at'>): DemoIncident {
    const now = Date.now();
    const incident: DemoIncident = {
      id: randomUUID(),
      ...data,
      created_at: now,
      updated_at: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO incidents (id, summary, description, priority, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      incident.id,
      incident.summary,
      incident.description,
      incident.priority,
      incident.status,
      incident.created_at,
      incident.updated_at
    );

    return incident;
  }

  getIncident(id: string): DemoIncident | null {
    const stmt = this.db.prepare('SELECT * FROM incidents WHERE id = ?');
    return stmt.get(id) as DemoIncident | null;
  }

  updateIncidentStatus(id: string, status: DemoIncident['status']): void {
    const stmt = this.db.prepare(`
      UPDATE incidents
      SET status = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(status, Date.now(), id);
  }

  getAllIncidents(limit = 50): DemoIncident[] {
    const stmt = this.db.prepare(`
      SELECT * FROM incidents
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as DemoIncident[];
  }

  // Resolution CRUD
  createResolution(data: Omit<DemoResolution, 'id' | 'resolved_at'>): DemoResolution {
    const resolution: DemoResolution = {
      id: randomUUID(),
      ...data,
      resolved_at: Date.now(),
    };

    const stmt = this.db.prepare(`
      INSERT INTO incident_resolutions (id, incident_id, agent, resolution, confidence, agent_chain, latency_ms, resolved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      resolution.id,
      resolution.incident_id,
      resolution.agent,
      resolution.resolution,
      resolution.confidence,
      resolution.agent_chain || null,
      resolution.latency_ms,
      resolution.resolved_at
    );

    return resolution;
  }

  getResolution(incidentId: string): DemoResolution | null {
    const stmt = this.db.prepare('SELECT * FROM incident_resolutions WHERE incident_id = ?');
    return stmt.get(incidentId) as DemoResolution | null;
  }

  // Routing Decision CRUD
  createRoutingDecision(data: Omit<DemoRoutingDecision, 'id' | 'timestamp'>): DemoRoutingDecision {
    const decision: DemoRoutingDecision = {
      id: randomUUID(),
      ...data,
      timestamp: Date.now(),
    };

    const stmt = this.db.prepare(`
      INSERT INTO routing_decisions (id, incident_id, route, reasoning, confidence, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      decision.id,
      decision.incident_id,
      decision.route,
      decision.reasoning,
      decision.confidence,
      decision.timestamp
    );

    return decision;
  }

  getRoutingDecision(incidentId: string): DemoRoutingDecision | null {
    const stmt = this.db.prepare('SELECT * FROM routing_decisions WHERE incident_id = ?');
    return stmt.get(incidentId) as DemoRoutingDecision | null;
  }

  // Activity Log CRUD
  logActivity(data: Omit<DemoActivityLog, 'id'>): DemoActivityLog {
    const activity: DemoActivityLog = {
      id: randomUUID(),
      ...data,
    };

    const stmt = this.db.prepare(`
      INSERT INTO activity_log (id, incident_id, timestamp_ms, event_type, description, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      activity.id,
      activity.incident_id,
      activity.timestamp_ms,
      activity.event_type,
      activity.description,
      activity.metadata || null
    );

    return activity;
  }

  getActivityLog(incidentId: string): DemoActivityLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM activity_log
      WHERE incident_id = ?
      ORDER BY timestamp_ms ASC
    `);
    return stmt.all(incidentId) as DemoActivityLog[];
  }

  // Analytics
  getAnalytics(): {
    totalIncidents: number;
    npuResolved: number;
    cloudResolved: number;
    avgNpuLatency: number;
    avgCloudLatency: number;
    avgNpuConfidence: number;
    avgCloudConfidence: number;
  } {
    const totalIncidents = this.db.prepare('SELECT COUNT(*) as count FROM incidents').get() as { count: number };

    const npuStats = this.db.prepare(`
      SELECT COUNT(*) as count, AVG(latency_ms) as avg_latency, AVG(confidence) as avg_confidence
      FROM incident_resolutions
      WHERE agent = 'npu'
    `).get() as { count: number; avg_latency: number; avg_confidence: number };

    const cloudStats = this.db.prepare(`
      SELECT COUNT(*) as count, AVG(latency_ms) as avg_latency, AVG(confidence) as avg_confidence
      FROM incident_resolutions
      WHERE agent = 'cloud'
    `).get() as { count: number; avg_latency: number; avg_confidence: number };

    return {
      totalIncidents: totalIncidents.count,
      npuResolved: npuStats.count || 0,
      cloudResolved: cloudStats.count || 0,
      avgNpuLatency: npuStats.avg_latency || 0,
      avgCloudLatency: cloudStats.avg_latency || 0,
      avgNpuConfidence: npuStats.avg_confidence || 0,
      avgCloudConfidence: cloudStats.avg_confidence || 0,
    };
  }

  // Chat history
  createChatMessage(data: Omit<DemoChatMessage, 'id' | 'created_at'>): DemoChatMessage {
    const message: DemoChatMessage = {
      id: randomUUID(),
      ...data,
      created_at: Date.now(),
    };

    const stmt = this.db.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, route, confidence, latency_ms, escalated, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      message.id,
      message.session_id,
      message.role,
      message.content,
      message.route || null,
      message.confidence ?? null,
      message.latency_ms ?? null,
      message.escalated ?? null,
      message.created_at
    );

    return message;
  }

  getChatHistory(sessionId: string): DemoChatMessage[] {
    const stmt = this.db.prepare(`
      SELECT *
      FROM chat_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
    `);

    return stmt.all(sessionId) as DemoChatMessage[];
  }

  // Clear all data (for demo reset)
  clearAll(): void {
    this.db.exec(`
      DELETE FROM activity_log;
      DELETE FROM routing_decisions;
      DELETE FROM incident_resolutions;
      DELETE FROM incidents;
    `);
  }

  // Studio Settings CRUD
  getSetting(key: string): StudioSetting | null {
    const stmt = this.db.prepare('SELECT * FROM studio_settings WHERE key = ?');
    return stmt.get(key) as StudioSetting | null;
  }

  getAllSettings(): StudioSetting[] {
    const stmt = this.db.prepare('SELECT * FROM studio_settings ORDER BY key');
    return stmt.all() as StudioSetting[];
  }

  setSetting(key: string, value: string, encrypted: boolean = false): StudioSetting {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO studio_settings (key, value, encrypted, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        encrypted = excluded.encrypted,
        updated_at = excluded.updated_at
    `);
    stmt.run(key, value, encrypted ? 1 : 0, now);
    return { key, value, encrypted: encrypted ? 1 : 0, updated_at: now };
  }

  deleteSetting(key: string): void {
    const stmt = this.db.prepare('DELETE FROM studio_settings WHERE key = ?');
    stmt.run(key);
  }

  // Studio Metrics CRUD
  createMetric(data: Omit<StudioMetric, 'id' | 'created_at'>): StudioMetric {
    const metric: StudioMetric = {
      id: randomUUID(),
      ...data,
      created_at: Date.now(),
    };

    const stmt = this.db.prepare(`
      INSERT INTO studio_metrics (id, session_id, scenario_id, tier, latency_ms, tokens_input, tokens_output, cost_usd, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      metric.id,
      metric.session_id,
      metric.scenario_id || null,
      metric.tier,
      metric.latency_ms,
      metric.tokens_input,
      metric.tokens_output,
      metric.cost_usd,
      metric.created_at
    );

    return metric;
  }

  getSessionMetrics(sessionId: string): StudioMetric[] {
    const stmt = this.db.prepare(`
      SELECT * FROM studio_metrics
      WHERE session_id = ?
      ORDER BY created_at ASC
    `);
    return stmt.all(sessionId) as StudioMetric[];
  }

  getStudioAnalytics(): {
    totalSessions: number;
    totalTokensInput: number;
    totalTokensOutput: number;
    totalCost: number;
    avgLatencyByTier: { tier: string; avg_latency: number }[];
  } {
    const sessionCount = this.db.prepare(
      'SELECT COUNT(DISTINCT session_id) as count FROM studio_metrics'
    ).get() as { count: number };

    const tokenTotals = this.db.prepare(`
      SELECT
        COALESCE(SUM(tokens_input), 0) as total_input,
        COALESCE(SUM(tokens_output), 0) as total_output,
        COALESCE(SUM(cost_usd), 0) as total_cost
      FROM studio_metrics
    `).get() as { total_input: number; total_output: number; total_cost: number };

    const latencyByTier = this.db.prepare(`
      SELECT tier, AVG(latency_ms) as avg_latency
      FROM studio_metrics
      GROUP BY tier
    `).all() as { tier: string; avg_latency: number }[];

    return {
      totalSessions: sessionCount.count,
      totalTokensInput: tokenTotals.total_input,
      totalTokensOutput: tokenTotals.total_output,
      totalCost: tokenTotals.total_cost,
      avgLatencyByTier: latencyByTier,
    };
  }

  clearStudioMetrics(): void {
    this.db.exec('DELETE FROM studio_metrics');
  }

  close(): void {
    this.db.close();
  }
}

// Singleton instance
let demoDbInstance: DemoDB | null = null;

export function getDemoDB(): DemoDB {
  if (!demoDbInstance) {
    demoDbInstance = new DemoDB();
  }
  return demoDbInstance;
}
