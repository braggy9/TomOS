"use client";

import { useState } from "react";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  context: string[];
  energy: string;
  time: string;
  dueDate: string | null;
  url: string;
}

interface QueryResult {
  success: boolean;
  query: string;
  filters: any;
  count: number;
  tasks: Task[];
}

export default function QueryPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const examples = [
    "show me urgent tasks",
    "what's due today",
    "quick tasks with low energy",
    "client projects in progress",
    "show overdue tasks",
    "upcoming tasks this week",
  ];

  const handleQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    setLoading(true);
    setError(null);
    setQuery(queryText);

    try {
      const response = await fetch("/api/tasks/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryText }),
      });

      if (!response.ok) {
        throw new Error("Failed to query tasks");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Urgent":
        return "text-red-600 bg-red-50 border-red-200";
      case "Important":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "Someday":
        return "text-gray-600 bg-gray-50 border-gray-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Done":
        return "text-green-600 bg-green-50";
      case "In Progress":
        return "text-blue-600 bg-blue-50";
      case "Blocked":
        return "text-red-600 bg-red-50";
      case "Todo":
        return "text-purple-600 bg-purple-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString("en-AU", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            ✅ TomOS Task Query
          </h1>
          <p className="text-gray-600">
            Ask me anything about your tasks in plain English
          </p>
        </div>

        {/* Search Box */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleQuery(query);
            }}
            className="flex gap-3"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., 'show me urgent tasks' or 'what's due today'"
              className="flex-1 px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </form>

          {/* Examples */}
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-2">Try these examples:</p>
            <div className="flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  onClick={() => handleQuery(example)}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
                  disabled={loading}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8">
            <p className="font-semibold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Result Summary */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Query</p>
                  <p className="font-semibold text-gray-900">{result.query}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Results</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {result.count}
                  </p>
                </div>
              </div>
            </div>

            {/* Tasks */}
            {result.tasks.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-600 text-lg">No tasks found</p>
                <p className="text-gray-500 text-sm mt-2">
                  Try a different query or adjust your filters
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {result.tasks.map((task) => (
                  <a
                    key={task.id}
                    href={task.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 border-l-4 hover:border-l-blue-500"
                    style={{
                      borderLeftColor:
                        task.priority === "Urgent"
                          ? "#dc2626"
                          : task.priority === "Important"
                          ? "#ea580c"
                          : "#9ca3af",
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg mb-2">
                          {task.title}
                        </h3>

                        <div className="flex flex-wrap gap-2 mb-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(
                              task.priority
                            )} border`}
                          >
                            {task.priority}
                          </span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              task.status
                            )}`}
                          >
                            {task.status}
                          </span>
                          {task.context.map((ctx) => (
                            <span
                              key={ctx}
                              className="px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700"
                            >
                              {ctx}
                            </span>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                          <span>⚡ {task.energy}</span>
                          <span>⏱️ {task.time}</span>
                          {task.dueDate && (
                            <span className="text-orange-600 font-medium">
                              📅 {formatDate(task.dueDate)}
                            </span>
                          )}
                        </div>
                      </div>

                      <svg
                        className="w-5 h-5 text-gray-400 ml-4 mt-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
