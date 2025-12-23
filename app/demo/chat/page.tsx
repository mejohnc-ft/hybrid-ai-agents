'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BadgeAlert,
  BadgeCheck,
  Clock3,
  Cloud,
  Cpu,
  Loader2,
  MessageCircle,
  Shield,
} from 'lucide-react';

type ChatMessage = {
  id: string;
  role: 'user' | 'agent';
  content: string;
  route?: 'npu' | 'cloud';
  confidence?: number | null;
  latency_ms?: number | null;
  escalated?: boolean;
  created_at: number;
};

const confidenceClass = (value?: number | null) => {
  if (value === undefined || value === null) return 'bg-gray-100 text-gray-700';
  if (value >= 0.8) return 'bg-green-100 text-green-800';
  if (value >= 0.6) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
};

const formatTimestamp = (timestamp: number) =>
  new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).format(new Date(timestamp));

const deriveRoute = (messages: ChatMessage[]): 'npu' | 'cloud' => {
  const latestAgent = [...messages].reverse().find(message => message.role === 'agent');
  return latestAgent?.route === 'cloud' ? 'cloud' : 'npu';
};

export default function ChatDemoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [route, setRoute] = useState<'npu' | 'cloud'>('npu');

  useEffect(() => {
    const paramSession = searchParams.get('session');
    if (sessionId) return;

    const newSession = paramSession || crypto.randomUUID();
    setSessionId(newSession);

    if (!paramSession) {
      router.replace(`?session=${newSession}`);
    }
  }, [router, searchParams, sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/demo/chat?sessionId=${sessionId}`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
          setRoute(data.route || deriveRoute(data.messages || []));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [sessionId]);

  const sendMessage = async () => {
    if (!input.trim() || !sessionId) return;

    setSending(true);
    try {
      const response = await fetch('/api/demo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input.trim(), sessionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      setMessages(data.history || []);
      setRoute(data.route || deriveRoute(data.history || []));
      router.replace(`?session=${data.sessionId}`);
      setInput('');
    } catch (error) {
      console.error(error);
      alert('Unable to send message. Check the console for details.');
    } finally {
      setSending(false);
    }
  };

  const startNewSession = () => {
    const nextId = crypto.randomUUID();
    setSessionId(nextId);
    setMessages([]);
    setRoute('npu');
    router.replace(`?session=${nextId}`);
  };

  const currentRouteLabel = useMemo(
    () =>
      route === 'npu'
        ? {
            label: 'Local (NPU)',
            description: 'Fast, on-device handling for T1 scenarios',
            icon: <Cpu className="w-4 h-4 text-indigo-600" />,
          }
        : {
            label: 'Cloud',
            description: 'Escalated to cloud for deeper analysis',
            icon: <Cloud className="w-4 h-4 text-amber-600" />,
          },
    [route]
  );

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm uppercase text-slate-500 tracking-wide">Demo</p>
              <h1 className="text-2xl font-semibold text-slate-900">
                Hybrid Agent Chat
              </h1>
              <p className="text-slate-600">
                Chat with the local NPU agent and view routing decisions with confidence
                and escalation signals.
              </p>
            </div>
            <button
              onClick={startNewSession}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
              disabled={sending}
            >
              Start fresh session
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                route === 'npu' ? 'bg-indigo-50 text-indigo-800' : 'bg-amber-50 text-amber-800'
              }`}
            >
              {currentRouteLabel.icon}
              <div>
                <p className="text-xs uppercase font-semibold tracking-wide">
                  {currentRouteLabel.label}
                </p>
                <p className="text-sm text-slate-600">{currentRouteLabel.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Shield className="w-4 h-4" />
              <span>Session ID: {sessionId.slice(0, 8)}...</span>
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col gap-4 min-h-[70vh]">
            <div className="flex items-center gap-2 text-slate-700">
              <MessageCircle className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Conversation transcript</h2>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loading ? (
                <div className="flex items-center justify-center text-slate-500 h-full">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading history...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-slate-500 py-12">
                  No messages yet. Say hello to the NPU agent to begin.
                </div>
              ) : (
                messages.map(message => {
                  const isAgent = message.role === 'agent';
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-xl rounded-xl p-4 shadow-sm ${
                          isAgent
                            ? 'bg-white border border-slate-200 text-slate-900'
                            : 'bg-indigo-600 text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="font-semibold uppercase tracking-wide">
                            {isAgent ? 'Agent' : 'You'}
                          </span>
                          <span className={isAgent ? 'text-slate-500' : 'text-indigo-100'}>
                            {formatTimestamp(message.created_at)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>

                        {isAgent && (
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            <span
                              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                                message.route === 'cloud'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {message.route === 'cloud' ? (
                                <Cloud className="w-3 h-3" />
                              ) : (
                                <Cpu className="w-3 h-3" />
                              )}
                              {message.route === 'cloud' ? 'Cloud' : 'Local'}
                            </span>

                            <span
                              className={`text-xs px-2 py-1 rounded-full ${confidenceClass(
                                message.confidence
                              )}`}
                            >
                              Confidence:{' '}
                              {message.confidence !== null && message.confidence !== undefined
                                ? `${Math.round(message.confidence * 100)}%`
                                : 'n/a'}
                            </span>

                            {message.latency_ms !== null && message.latency_ms !== undefined && (
                              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                                <Clock3 className="w-3 h-3" />
                                {message.latency_ms} ms
                              </span>
                            )}

                            {message.escalated && (
                              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-100 text-red-800">
                                <BadgeAlert className="w-3 h-3" />
                                Escalation recommended
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-end gap-3">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Describe an issue or ask the NPU agent for help..."
                  className="flex-1 border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[80px]"
                  disabled={sending}
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !input.trim()}
                  className="h-[80px] px-5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send
                </button>
              </div>
            </div>
          </section>

          <aside className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 text-slate-700">
              <BadgeCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold">Routing & health</h2>
            </div>
            <div className="space-y-3 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-600" />
                <span>
                  Local routing keeps sensitive data on-device with lower latency for T1 tasks.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-amber-600" />
                <span>
                  Cloud routing engages larger models when confidence drops or escalation is needed.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <BadgeAlert className="w-4 h-4 text-red-600" />
                <span>
                  Escalation badges highlight turns where the NPU recommended cloud or human
                  assistance.
                </span>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
