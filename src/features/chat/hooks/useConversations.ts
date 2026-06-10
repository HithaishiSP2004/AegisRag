'use client'
// useConversations — fetch, create, rename, delete conversation list
import { useState, useCallback, useEffect } from 'react'

export interface ConversationMeta {
  id:         string
  title:      string
  created_at: string
  updated_at: string
}

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationMeta[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/conversations')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load conversations')
      setConversations(data.conversations ?? [])
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    Promise.resolve().then(() => {
      load()
    })
  }, [load])

  const createConversation = useCallback(async (title?: string): Promise<ConversationMeta | null> => {
    try {
      const res  = await fetch('/api/conversations', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title: title ?? 'New Conversation' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const conv: ConversationMeta = data.conversation
      setConversations((prev) => [conv, ...prev])
      return conv
    } catch { return null }
  }, [])

  const renameConversation = useCallback(async (id: string, title: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title }),
      })
      if (!res.ok) return false
      setConversations((prev) =>
        prev.map((c) => c.id === id ? { ...c, title } : c)
      )
      return true
    } catch { return false }
  }, [])

  const deleteConversation = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) return false
      setConversations((prev) => prev.filter((c) => c.id !== id))
      return true
    } catch { return false }
  }, [])

  const prependOrUpdate = useCallback((conv: ConversationMeta) => {
    setConversations((prev) => {
      const existing = prev.findIndex((c) => c.id === conv.id)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = conv
        return updated
      }
      return [conv, ...prev]
    })
  }, [])

  return {
    conversations, loading, error,
    reload: load,
    createConversation,
    renameConversation,
    deleteConversation,
    prependOrUpdate,
  }
}
