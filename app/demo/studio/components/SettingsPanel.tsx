'use client';

import { useState, useEffect } from 'react';
import { useStudioSettings } from '../hooks/useStudioSettings';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const {
    settings,
    loading,
    updateSettings,
    testNpuConnection,
    testCloudConnection,
  } = useStudioSettings();

  // Form state
  const [npuUrl, setNpuUrl] = useState('');
  const [cloudApiKey, setCloudApiKey] = useState('');
  const [cloudBaseUrl, setCloudBaseUrl] = useState('');
  const [cloudModel, setCloudModel] = useState('');
  const [azureApiVersion, setAzureApiVersion] = useState('');

  // Test results
  const [npuTestResult, setNpuTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [cloudTestResult, setCloudTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState<'npu' | 'cloud' | null>(null);
  const [saving, setSaving] = useState(false);

  // Populate form when settings load
  useEffect(() => {
    if (settings) {
      setNpuUrl(settings.npu_agent_url || '');
      setCloudBaseUrl(settings.cloud_base_url || '');
      setCloudModel(settings.cloud_model || '');
      setAzureApiVersion(settings.azure_api_version || '');
      // Don't populate API key - it's masked
    }
  }, [settings]);

  const isAzure = cloudBaseUrl.toLowerCase().includes('.azure.com');

  const handleTestNpu = async () => {
    setTesting('npu');
    setNpuTestResult(null);
    const result = await testNpuConnection(npuUrl);
    setNpuTestResult(result);
    setTesting(null);
  };

  const handleTestCloud = async () => {
    setTesting('cloud');
    setCloudTestResult(null);
    const result = await testCloudConnection({
      api_key: cloudApiKey || undefined,
      base_url: cloudBaseUrl || undefined,
      model: cloudModel || undefined,
    });
    setCloudTestResult(result);
    setTesting(null);
  };

  const handleSave = async () => {
    setSaving(true);

    const updates: Record<string, string> = {};

    if (npuUrl) updates.npu_agent_url = npuUrl;
    if (cloudApiKey) updates.cloud_api_key = cloudApiKey;
    if (cloudBaseUrl) updates.cloud_base_url = cloudBaseUrl;
    if (cloudModel) updates.cloud_model = cloudModel;
    if (azureApiVersion) updates.azure_api_version = azureApiVersion;

    await updateSettings(updates);
    setSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Settings</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* NPU Agent Configuration */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                  NPU Agent (Edge)
                </h3>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Agent URL</label>
                  <input
                    type="text"
                    value={npuUrl}
                    onChange={(e) => setNpuUrl(e.target.value)}
                    placeholder="http://localhost:8000"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  onClick={handleTestNpu}
                  disabled={testing === 'npu'}
                  className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 disabled:opacity-50 transition-colors"
                >
                  {testing === 'npu' ? 'Testing...' : 'Test Connection'}
                </button>

                {npuTestResult && (
                  <div className={`p-3 rounded-lg text-sm ${npuTestResult.success ? 'bg-green-900/50 text-green-300 border border-green-700' : 'bg-red-900/50 text-red-300 border border-red-700'}`}>
                    {npuTestResult.message}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-slate-800" />

              {/* Cloud Agent Configuration */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                  Cloud Agent (Azure/OpenAI)
                </h3>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Base URL</label>
                  <input
                    type="text"
                    value={cloudBaseUrl}
                    onChange={(e) => setCloudBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  {isAzure && (
                    <p className="mt-1 text-xs text-blue-400">Azure OpenAI endpoint detected</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    API Key {settings?.cloud_api_key_set && <span className="text-green-400">(set)</span>}
                  </label>
                  <input
                    type="password"
                    value={cloudApiKey}
                    onChange={(e) => setCloudApiKey(e.target.value)}
                    placeholder={settings?.cloud_api_key_set ? '••••••••••••' : 'sk-...'}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Model {isAzure && '(Deployment Name)'}
                  </label>
                  <input
                    type="text"
                    value={cloudModel}
                    onChange={(e) => setCloudModel(e.target.value)}
                    placeholder={isAzure ? 'your-deployment-name' : 'gpt-4o'}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {isAzure && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">API Version</label>
                    <input
                      type="text"
                      value={azureApiVersion}
                      onChange={(e) => setAzureApiVersion(e.target.value)}
                      placeholder="2024-08-01-preview"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                <button
                  onClick={handleTestCloud}
                  disabled={testing === 'cloud'}
                  className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 disabled:opacity-50 transition-colors"
                >
                  {testing === 'cloud' ? 'Testing...' : 'Test Connection'}
                </button>

                {cloudTestResult && (
                  <div className={`p-3 rounded-lg text-sm ${cloudTestResult.success ? 'bg-green-900/50 text-green-300 border border-green-700' : 'bg-red-900/50 text-red-300 border border-red-700'}`}>
                    {cloudTestResult.message}
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t border-slate-800">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
