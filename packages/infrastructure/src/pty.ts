import type { PtyMessage } from './types'

export const parsePtyMessage = (value: unknown): PtyMessage => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('pty 消息必须是对象')
  const message = value as Record<string, unknown>
  if (message.type === 'input' && typeof message.data === 'string' && message.data.length <= 4096) return { type: 'input', data: message.data }
  if (message.type === 'resize' && Number.isInteger(message.cols) && Number.isInteger(message.rows) && Number(message.cols) > 0 && Number(message.rows) > 0 && Number(message.cols) <= 500 && Number(message.rows) <= 200) return { type: 'resize', cols: Number(message.cols), rows: Number(message.rows) }
  if (message.type === 'heartbeat' && typeof message.timestamp === 'string' && Number.isFinite(Date.parse(message.timestamp))) return { type: 'heartbeat', timestamp: message.timestamp }
  throw new Error('不支持或超限的 pty-v1 消息')
}

export const encodePtyMessage = (message: PtyMessage): string => JSON.stringify(message)
