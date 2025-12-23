import { NextRequest, NextResponse } from 'next/server';
import { settingsStore, SETTING_KEYS } from '@/lib/settings-store';
import { NPUAgentClient } from '@/lib/agents/npu-client';
import OpenAI from 'openai';

// GET - Retrieve current settings (with masked API keys)
export async function GET() {
  try {
    const settings = settingsStore.getAllForDisplay();

    return NextResponse.json({
      settings,
      configured: {
        npu: settingsStore.isNpuConfigured(),
        cloud: settingsStore.isCloudConfigured(),
      },
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PUT - Update settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const validKeys = Object.values(SETTING_KEYS);
    const updates: Record<string, string> = {};

    for (const [key, value] of Object.entries(body)) {
      if (validKeys.includes(key as any) && typeof value === 'string') {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid settings to update' },
        { status: 400 }
      );
    }

    settingsStore.updateMultiple(updates);

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      updated: Object.keys(updates),
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}

// POST - Test connections
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'test-npu':
        return await testNpuConnection(body.url);

      case 'test-cloud':
        return await testCloudConnection(body);

      default:
        return NextResponse.json(
          { error: 'Unknown action. Use test-npu or test-cloud' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Settings action error:', error);
    return NextResponse.json(
      { error: 'Action failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function testNpuConnection(url?: string) {
  const targetUrl = url || settingsStore.get(SETTING_KEYS.NPU_AGENT_URL);

  if (!targetUrl) {
    return NextResponse.json(
      { success: false, message: 'NPU agent URL not configured' },
      { status: 400 }
    );
  }

  try {
    const client = NPUAgentClient.createWithUrl(targetUrl);
    const health = await client.healthCheck();

    return NextResponse.json({
      success: health.status === 'healthy',
      message: health.status === 'healthy'
        ? 'NPU agent is healthy and ready'
        : 'NPU agent responded but is not healthy',
      details: {
        status: health.status,
        model_loaded: health.model_loaded,
        vector_db_ready: health.vector_db_ready,
        kb_entries: health.kb_entries,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: `Failed to connect to NPU agent at ${targetUrl}`,
      details: error instanceof Error ? error.message : 'Connection failed',
    });
  }
}

async function testCloudConnection(config: {
  api_key?: string;
  base_url?: string;
  model?: string;
}) {
  const apiKey = config.api_key || settingsStore.get(SETTING_KEYS.CLOUD_API_KEY);
  const baseUrl = config.base_url || settingsStore.get(SETTING_KEYS.CLOUD_BASE_URL);
  const model = config.model || settingsStore.get(SETTING_KEYS.CLOUD_MODEL);

  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: 'Cloud API key not configured' },
      { status: 400 }
    );
  }

  const isAzure = baseUrl.toLowerCase().includes('.azure.com');

  try {
    let client: OpenAI;

    if (isAzure) {
      const apiVersion = settingsStore.get(SETTING_KEYS.AZURE_API_VERSION);
      client = new OpenAI({
        baseURL: baseUrl,
        defaultHeaders: { 'api-key': apiKey },
        defaultQuery: { 'api-version': apiVersion },
      });
    } else {
      client = new OpenAI({
        apiKey,
        baseURL: baseUrl || 'https://api.openai.com/v1',
      });
    }

    // Simple health check - minimal API call
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Say OK' }],
      max_tokens: 5,
    });

    if (response.choices[0]?.message?.content) {
      return NextResponse.json({
        success: true,
        message: 'Cloud API connection successful',
        details: {
          model,
          endpoint_type: isAzure ? 'azure' : 'openai',
          response_received: true,
        },
      });
    }

    return NextResponse.json({
      success: false,
      message: 'Cloud API connected but no response received',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Provide helpful error messages for common issues
    let helpfulMessage = `Failed to connect to cloud API: ${errorMessage}`;

    if (errorMessage.includes('401')) {
      helpfulMessage = 'Invalid API key. Please check your credentials.';
    } else if (errorMessage.includes('404')) {
      helpfulMessage = isAzure
        ? 'Deployment not found. Check your model/deployment name.'
        : 'Model not found. Check the model name.';
    } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
      helpfulMessage = 'Cannot reach the API endpoint. Check the base URL.';
    }

    return NextResponse.json({
      success: false,
      message: helpfulMessage,
      details: errorMessage,
    });
  }
}
