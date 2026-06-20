'use client'

import { usePathname } from 'next/navigation'

interface Props {
  children: React.ReactNode
}

export function AppContentWrapper({ children }: Props) {
  const pathname = usePathname()
  const isChat = pathname === '/chat'

  return (
    <div className={isChat ? 'app-content app-content--flush' : 'app-content'}>
      {children}
    </div>
  )
}
