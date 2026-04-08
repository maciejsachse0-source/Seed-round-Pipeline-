import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'latin-ext'] })

export const metadata: Metadata = {
  title: 'Seed Round Pipeline',
  description: 'Handmade seller lead generation pipeline',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl">
      <body className={`${inter.className} min-h-screen bg-gray-50/50 text-gray-900`}>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  )
}
