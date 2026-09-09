import { AlertCircle, CheckCircle2, Info, LocateFixed, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ValidationMessage } from '../types'

export function ValidationPanel({ messages, onLocate }: { messages: ValidationMessage[]; onLocate: (message: ValidationMessage) => void }) {
  const errors = messages.filter((message) => message.severity === 'error')
  const warnings = messages.filter((message) => message.severity === 'warning')
  const infos = messages.filter((message) => message.severity === 'info')
  return <section className="validation-panel"><div className="validation-heading"><div><span className="panel-kicker">MAP CHECK</span><h2>结构校验</h2></div><span className={`validation-count ${errors.length ? 'has-error' : ''}`}>{errors.length ? `${errors.length} 个错误` : '可继续编排'}</span></div>{messages.length === 0 ? <div className="validation-empty"><CheckCircle2 size={17} />当前地图没有待处理项</div> : <div className="validation-groups">{errors.length > 0 && <MessageGroup title="错误" icon={<AlertCircle size={15} />} messages={errors} onLocate={onLocate} />}{warnings.length > 0 && <MessageGroup title="警告" icon={<TriangleAlert size={15} />} messages={warnings} onLocate={onLocate} />}{infos.length > 0 && <MessageGroup title="待补充" icon={<Info size={15} />} messages={infos} onLocate={onLocate} />}</div>}</section>
}

function MessageGroup({ title, icon, messages, onLocate }: { title: string; icon: ReactNode; messages: ValidationMessage[]; onLocate: (message: ValidationMessage) => void }) {
  return <div className="message-group"><div className="message-group-title">{icon}{title}<span>{messages.length}</span></div>{messages.slice(0, 6).map((message) => <button className="message-item" key={message.id} onClick={() => onLocate(message)}><span>{message.message}</span>{message.targetId && <LocateFixed size={13} />}</button>)}{messages.length > 6 && <span className="more-messages">还有 {messages.length - 6} 项</span>}</div>
}
