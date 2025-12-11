"use client";
import Link from "next/link";

const tiles = [
  { href: "/legal-deadline-tracker", title: "Legal Deadline Tracker", desc: "Track matters, milestones and due dates" },
  { href: "/compliance-checklists", title: "Compliance Checklists", desc: "GDPR, Security, and Privacy checklists" },
  { href: "/adhd-productivity-dashboard", title: "ADHD Productivity Dashboard", desc: "Focus, quick wins, and day planning" },
  { href: "/playbook-comparison-engine", title: "Playbook Comparison Engine", desc: "Compare contract text to your playbook" },
];

export default function Page() {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Welcome</h2>
      <p className="text-gray-600 mb-6">Pick a tool to open it. Each page is client-side and fully interactive.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="block p-4 bg-white rounded-xl shadow hover:shadow-md transition">
            <h3 className="font-medium">{t.title}</h3>
            <p className="text-sm text-gray-500">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
