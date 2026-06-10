'use client'
import { useEffect, useRef } from 'react'
import { MessageBubble } from './MessageBubble'
import type { Message } from '../types'
import type { CitationRef } from '@/features/retrieval'

interface Props {
  messages:          Message[]
  activeCitationIdx: number | null
  onCitationClick:   (c: CitationRef) => void
}

export function MessageList({ messages, activeCitationIdx, onCitationClick }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastMessageContent = messages[messages.length - 1]?.content
  const messagesCount = messages.length

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messagesCount, lastMessageContent])

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 28px 160px' }}>
      {messages.map((msg) => (
        <div key={msg.id} style={{ width: '100%', maxWidth: '850px', margin: '0 auto' }}>
          <MessageBubble message={msg} activeCitationIdx={activeCitationIdx} onCitationClick={onCitationClick} />
        </div>
      ))}
      <div ref={bottomRef} style={{ width: '100%', maxWidth: '850px', margin: '0 auto' }} />
    </div>
  )
}
