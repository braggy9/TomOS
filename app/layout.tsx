export const metadata = {
  title: "TSX Tools Suite",
  description: "Tom's TSX tools wrapped in a Next.js app",
};

import "./globals.css";
import Link from "next/link";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b bg-white">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-lg font-semibold">TSX Tools Suite</h1>
            <nav className="text-sm space-x-4">
              <Link href="/">Home</Link>
              <Link href="/legal-deadline-tracker">Legal Deadlines</Link>
              <Link href="/compliance-checklists">Compliance</Link>
              <Link href="/adhd-productivity-dashboard">ADHD Dashboard</Link>
              <Link href="/playbook-comparison-engine">Playbook Engine</Link>
              <a href="/clause-comparison-tool">Clause Comparison</a>
  <a href="/contract-template-builder">Template Builder</a>
</nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
