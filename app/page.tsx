export default function Home() {
  return (
    <div className="min-h-screen p-8 pb-20 gap-16 sm:p-20 font-sans">
      <main className="flex flex-col gap-8 items-center">
        <h1 className="text-4xl font-bold text-center">
          Hybrid AI Agents
        </h1>
        <p className="text-center text-lg text-gray-600 dark:text-gray-400 max-w-2xl">
          Edge-to-Cloud AI Agent System for Service Desk Automation
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 w-full max-w-4xl">
          <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-2">NPU Agent (Local)</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              T1 incidents resolved locally using Phi-3.5 on Windows NPU
            </p>
          </div>

          <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-2">Cloud Agents (Azure)</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              T2+ complex incidents handled by Azure AI Foundry multi-agents
            </p>
          </div>

          <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-2">HaloPSA Integration</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Automated ticketing lifecycle with full documentation
            </p>
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <a
            href="/dashboard/incidents"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            View Incidents
          </a>
          <a
            href="/dashboard/analytics"
            className="px-6 py-3 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            Analytics
          </a>
        </div>
      </main>
    </div>
  );
}
