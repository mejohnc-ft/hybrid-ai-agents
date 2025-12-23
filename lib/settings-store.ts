import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { getDemoDB } from './demo-db';

// Settings keys
export const SETTING_KEYS = {
  NPU_AGENT_URL: 'npu_agent_url',
  CLOUD_API_KEY: 'cloud_api_key',
  CLOUD_BASE_URL: 'cloud_base_url',
  CLOUD_MODEL: 'cloud_model',
  AZURE_API_VERSION: 'azure_api_version',
  MCP_SERVER_ENABLED: 'mcp_server_enabled',
} as const;

// Default values
const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.NPU_AGENT_URL]: 'http://localhost:8000',
  [SETTING_KEYS.CLOUD_BASE_URL]: 'https://api.openai.com/v1',
  [SETTING_KEYS.CLOUD_MODEL]: 'gpt-4o',
  [SETTING_KEYS.AZURE_API_VERSION]: '2024-08-01-preview',
  [SETTING_KEYS.MCP_SERVER_ENABLED]: 'true',
};

// Keys that should be encrypted
const ENCRYPTED_KEYS = new Set([SETTING_KEYS.CLOUD_API_KEY]);

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

// Derive encryption key from a secret (using machine-specific data + app secret)
function deriveKey(): Buffer {
  // Use a combination of app secret and process-level entropy
  const appSecret = process.env.SETTINGS_ENCRYPTION_KEY || 'hybrid-ai-agents-default-key-change-in-prod';
  const salt = Buffer.from('studio-settings-salt-v1');
  return scryptSync(appSecret, salt, 32);
}

function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(ciphertext: string): string {
  try {
    const key = deriveKey();
    const parts = ciphertext.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    console.error('Failed to decrypt setting value');
    return '';
  }
}

// Mask sensitive values for display
export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '****';
  return `${key.substring(0, 4)}****${key.substring(key.length - 4)}`;
}

export interface StudioSettings {
  npu_agent_url: string;
  cloud_api_key: string;
  cloud_base_url: string;
  cloud_model: string;
  azure_api_version: string;
  mcp_server_enabled: boolean;
}

export interface StudioSettingsDisplay {
  npu_agent_url: string;
  cloud_api_key: string; // Masked
  cloud_api_key_set: boolean;
  cloud_base_url: string;
  cloud_model: string;
  azure_api_version: string;
  is_azure: boolean;
  mcp_server_enabled: boolean;
}

class SettingsStore {
  private cache: Map<string, string> = new Map();
  private initialized = false;

  private initialize(): void {
    if (this.initialized) return;

    const db = getDemoDB();
    const allSettings = db.getAllSettings();

    for (const setting of allSettings) {
      const value = setting.encrypted ? decrypt(setting.value) : setting.value;
      this.cache.set(setting.key, value);
    }

    this.initialized = true;
  }

  get(key: string): string {
    this.initialize();

    // Check cache first
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    // Check environment variables as fallback
    const envKey = this.keyToEnvVar(key);
    if (process.env[envKey]) {
      return process.env[envKey] as string;
    }

    // Return default
    return DEFAULTS[key] || '';
  }

  set(key: string, value: string): void {
    this.initialize();

    const db = getDemoDB();
    const shouldEncrypt = ENCRYPTED_KEYS.has(key);
    const storedValue = shouldEncrypt ? encrypt(value) : value;

    db.setSetting(key, storedValue, shouldEncrypt);
    this.cache.set(key, value);
  }

  delete(key: string): void {
    this.initialize();

    const db = getDemoDB();
    db.deleteSetting(key);
    this.cache.delete(key);
  }

  getAll(): StudioSettings {
    this.initialize();

    return {
      npu_agent_url: this.get(SETTING_KEYS.NPU_AGENT_URL),
      cloud_api_key: this.get(SETTING_KEYS.CLOUD_API_KEY),
      cloud_base_url: this.get(SETTING_KEYS.CLOUD_BASE_URL),
      cloud_model: this.get(SETTING_KEYS.CLOUD_MODEL),
      azure_api_version: this.get(SETTING_KEYS.AZURE_API_VERSION),
      mcp_server_enabled: this.get(SETTING_KEYS.MCP_SERVER_ENABLED) === 'true',
    };
  }

  getAllForDisplay(): StudioSettingsDisplay {
    const settings = this.getAll();
    const isAzure = settings.cloud_base_url.toLowerCase().includes('.azure.com');

    return {
      npu_agent_url: settings.npu_agent_url,
      cloud_api_key: maskApiKey(settings.cloud_api_key),
      cloud_api_key_set: settings.cloud_api_key.length > 0,
      cloud_base_url: settings.cloud_base_url,
      cloud_model: settings.cloud_model,
      azure_api_version: settings.azure_api_version,
      is_azure: isAzure,
      mcp_server_enabled: settings.mcp_server_enabled,
    };
  }

  updateMultiple(updates: Partial<Record<string, string>>): void {
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        this.set(key, value);
      }
    }
  }

  // Check if cloud is configured (has API key)
  isCloudConfigured(): boolean {
    const apiKey = this.get(SETTING_KEYS.CLOUD_API_KEY);
    return apiKey.length > 0;
  }

  // Check if NPU is configured (URL set)
  isNpuConfigured(): boolean {
    const url = this.get(SETTING_KEYS.NPU_AGENT_URL);
    return url.length > 0;
  }

  // Invalidate cache to reload from database
  invalidateCache(): void {
    this.cache.clear();
    this.initialized = false;
  }

  private keyToEnvVar(key: string): string {
    const mapping: Record<string, string> = {
      [SETTING_KEYS.NPU_AGENT_URL]: 'NPU_AGENT_URL',
      [SETTING_KEYS.CLOUD_API_KEY]: 'CLOUD_AI_API_KEY',
      [SETTING_KEYS.CLOUD_BASE_URL]: 'CLOUD_AI_BASE_URL',
      [SETTING_KEYS.CLOUD_MODEL]: 'CLOUD_AI_MODEL',
      [SETTING_KEYS.AZURE_API_VERSION]: 'AZURE_OPENAI_API_VERSION',
    };
    return mapping[key] || key.toUpperCase();
  }
}

// Singleton instance
export const settingsStore = new SettingsStore();
