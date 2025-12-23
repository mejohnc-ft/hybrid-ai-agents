'use client';

import { useState, useCallback, useEffect } from 'react';

export interface StudioSettings {
  npu_agent_url: string;
  cloud_api_key: string;
  cloud_api_key_set: boolean;
  cloud_base_url: string;
  cloud_model: string;
  azure_api_version: string;
  is_azure: boolean;
  mcp_server_enabled: boolean;
}

export interface SettingsState {
  settings: StudioSettings | null;
  loading: boolean;
  error: string | null;
  configured: {
    npu: boolean;
    cloud: boolean;
  };
}

export function useStudioSettings() {
  const [state, setState] = useState<SettingsState>({
    settings: null,
    loading: true,
    error: null,
    configured: { npu: false, cloud: false },
  });

  const fetchSettings = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch('/api/demo/settings');
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const data = await response.json();
      setState({
        settings: data.settings,
        loading: false,
        error: null,
        configured: data.configured,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  const updateSettings = useCallback(async (updates: Partial<Record<string, string>>) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch('/api/demo/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      // Refresh settings after update
      await fetchSettings();
      return true;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
      return false;
    }
  }, [fetchSettings]);

  const testNpuConnection = useCallback(async (url?: string) => {
    try {
      const response = await fetch('/api/demo/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test-npu', url }),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }, []);

  const testCloudConnection = useCallback(async (config?: {
    api_key?: string;
    base_url?: string;
    model?: string;
  }) => {
    try {
      const response = await fetch('/api/demo/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test-cloud', ...config }),
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    ...state,
    fetchSettings,
    updateSettings,
    testNpuConnection,
    testCloudConnection,
  };
}
