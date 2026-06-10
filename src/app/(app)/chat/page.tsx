// Sprint 2B: /chat page — server component shell
// Auth is handled by the parent (app) layout.
// The ChatWorkspace client component owns all interactive state.
import type { Metadata } from 'next'
import { ChatWorkspace } from '@/features/chat/components/ChatWorkspace'

export const metadata: Metadata = {
  title: 'Chat — AegisRAG',
  description: 'Ask questions about your compliance documents and get cited answers powered by AegisRAG.',
}

export default function ChatPage() {
  // The app-content--flush class removes the outer padding + overflow-y:auto
  // so ChatWorkspace can own its own scroll architecture without a double scrollbar.
  return (
    <div className="app-content--flush" style={{ flex: 1, minHeight: 0 }}>
      <ChatWorkspace />
    </div>
  )
}
