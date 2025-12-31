import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TomOS Task API',
  description: 'Task management API',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
