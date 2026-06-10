'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { Icon } from '@iconify/react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => void
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, type: ToastType = 'info', duration = 4000) => {
      const id = Math.random().toString(36).substring(2, 9)
      setToasts((prev) => [...prev, { id, message, type, duration }])
      setTimeout(() => removeToast(id), duration)
    },
    [removeToast]
  )

  const success = useCallback((msg: string, dur?: number) => toast(msg, 'success', dur), [toast])
  const error = useCallback((msg: string, dur?: number) => toast(msg, 'error', dur), [toast])
  const warning = useCallback((msg: string, dur?: number) => toast(msg, 'warning', dur), [toast])
  const info = useCallback((msg: string, dur?: number) => toast(msg, 'info', dur), [toast])

  const typeStyles: Record<ToastType, { bg: string; border: string; text: string; icon: string; iconColor: string }> = {
    success: {
      bg: 'rgba(16, 185, 129, 0.08)',
      border: '1px solid rgba(16, 185, 129, 0.25)',
      text: '#A7F3D0',
      icon: 'solar:check-circle-bold-duotone',
      iconColor: '#10B981',
    },
    error: {
      bg: 'rgba(239, 68, 68, 0.08)',
      border: '1px solid rgba(239, 68, 68, 0.25)',
      text: '#FCA5A5',
      icon: 'solar:danger-triangle-bold-duotone',
      iconColor: '#EF4444',
    },
    warning: {
      bg: 'rgba(245, 158, 11, 0.08)',
      border: '1px solid rgba(245, 158, 11, 0.25)',
      text: '#FDE68A',
      icon: 'solar:shield-warning-bold-duotone',
      iconColor: '#F59E0B',
    },
    info: {
      bg: 'rgba(56, 189, 248, 0.08)',
      border: '1px solid rgba(56, 189, 248, 0.25)',
      text: '#BAE6FD',
      icon: 'solar:info-circle-bold-duotone',
      iconColor: '#38BDF8',
    },
  }

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      {/* Toast container */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => {
          const style = typeStyles[t.type]
          return (
            <div
              key={t.id}
              style={{
                background: style.bg,
                border: style.border,
                borderRadius: '8px',
                padding: '12px 16px',
                color: style.text,
                fontSize: '0.8rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                minWidth: '280px',
                maxWidth: '400px',
                pointerEvents: 'auto',
                animation: 'toast-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              }}
            >
              <Icon icon={style.icon} width={18} style={{ color: style.iconColor, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{t.message}</span>
              <button
                onClick={() => removeToast(t.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  marginLeft: '8px',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
              >
                <Icon icon="solar:close-circle-bold" width={14} />
              </button>
            </div>
          )
        })}
      </div>
      <style jsx global>{`
        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </ToastContext.Provider>
  )
}
