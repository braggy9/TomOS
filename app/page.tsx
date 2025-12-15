"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Stats {
  total: number;
  urgent: number;
  important: number;
  quickWins: number;
  highEnergy: number;
  dueToday: number;
}

interface SuggestionsData {
  taskCount: number;
  stats: Stats;
  suggestions: string;
}

export default function DashboardPage() {
  const [suggestions, setSuggestions] = useState<SuggestionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const response = await fetch("/api/suggestions");
      if (!response.ok) throw new Error("Failed to fetch suggestions");
      const data = await response.json();
      setSuggestions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const formatMarkdown = (text: string) => {
    return text
      .split("\n")
      .map((line, i) => {
        if (line.startsWith("### ")) {
          return (
            <h3 key={i} className="text-lg font-bold text-gray-900 mt-4 mb-2">
              {line.replace("### ", "")}
            </h3>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="text-xl font-bold text-gray-900 mt-6 mb-3">
              {line.replace("## ", "")}
            </h2>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <h1
              key={i}
              className="text-2xl font-bold text-gray-900 mt-8 mb-4"
            >
              {line.replace("# ", "")}
            </h1>
          );
        }

        if (line.includes("**")) {
          const parts = line.split("**");
          return (
            <p key={i} className="text-gray-700 mb-2">
              {parts.map((part, j) =>
                j % 2 === 1 ? (
                  <strong key={j} className="font-semibold">
                    {part}
                  </strong>
                ) : (
                  part
                )
              )}
            </p>
          );
        }

        if (line.trim().startsWith("-") || line.trim().startsWith("•")) {
          return (
            <li key={i} className="text-gray-700 ml-4 mb-1">
              {line.replace(/^[\s-•]+/, "")}
            </li>
          );
        }

        if (line.match(/^\d+\./)) {
          return (
            <li key={i} className="text-gray-700 ml-4 mb-1">
              {line.replace(/^\d+\.\s*/, "")}
            </li>
          );
        }

        if (line.trim() === "---") {
          return <hr key={i} className="my-6 border-gray-200" />;
        }

        if (!line.trim()) {
          return <div key={i} className="h-2" />;
        }

        return (
          <p key={i} className="text-gray-700 mb-2">
            {line}
          </p>
        );
      });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              ✅ TomOS Dashboard
            </h1>
            <div className="flex gap-3">
              <Link
                href="/query"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                🔍 Query Tasks
              </Link>
              <button
                onClick={fetchSuggestions}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {suggestions && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Total Tasks</div>
              <div className="text-3xl font-bold text-gray-900">
                {suggestions.stats.total}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Urgent</div>
              <div className="text-3xl font-bold text-red-600">
                {suggestions.stats.urgent}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Important</div>
              <div className="text-3xl font-bold text-orange-600">
                {suggestions.stats.important}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Quick Wins</div>
              <div className="text-3xl font-bold text-green-600">
                {suggestions.stats.quickWins}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">High Energy</div>
              <div className="text-3xl font-bold text-purple-600">
                {suggestions.stats.highEnergy}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Due Today</div>
              <div className="text-3xl font-bold text-blue-600">
                {suggestions.stats.dueToday}
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                🧠 Smart Suggestions
              </h2>

              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  <p className="font-semibold">Error</p>
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {suggestions && (
                <div className="prose prose-sm max-w-none">
                  {formatMarkdown(suggestions.suggestions)}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                ⚡ Quick Capture
              </h3>
              <div className="space-y-3">
                <div className="text-center text-sm text-gray-600 mb-2">
                  Use keyboard shortcuts:
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-100">
                  <div className="text-center">
                    <div className="text-xs text-gray-600 mb-2">Raycast / Menu Bar / Browser</div>
                    <kbd className="px-4 py-2 bg-white rounded-lg border-2 border-purple-300 font-mono text-lg font-bold">
                      ⌘⇧T
                    </kbd>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                🛠️ Tools
              </h3>
              <div className="space-y-2">
                <Link
                  href="/query"
                  className="block px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  🔍 Search Tasks
                </Link>
                <a
                  href="https://notion.so/739144099ebc4ba1ba619dd1a5a08d25"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  📋 Open Notion
                </a>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-100">
              <h3 className="text-lg font-bold text-gray-900 mb-3">
                ⌨️ All Shortcuts
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Quick Capture</span>
                  <kbd className="px-2 py-1 bg-white rounded border border-gray-300 font-mono text-xs">
                    ⌘⇧T
                  </kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Raycast Custom</span>
                  <kbd className="px-2 py-1 bg-white rounded border border-gray-300 font-mono text-xs">
                    Set in Config
                  </kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
