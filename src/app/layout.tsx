import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { APP_CONFIG } from '@/config/constants'
import { ToastProvider } from '@/components/ui'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: `${APP_CONFIG.name} — ${APP_CONFIG.tagline}`,
    template: `%s | ${APP_CONFIG.name}`,
  },
  description:
    'Enterprise Policy Intelligence & Compliance Command Center. Automate compliance workflows against large-scale policy corpora with AI-powered RAG.',
  keywords: ['compliance', 'RAG', 'enterprise', 'policy intelligence', 'AI', 'security'],
  authors: [{ name: 'AegisRAG' }],
  robots: 'noindex, nofollow', // Private private tool
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning data-scroll-behavior="smooth">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
        style={{ backgroundColor: '#080C14' }}
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}

