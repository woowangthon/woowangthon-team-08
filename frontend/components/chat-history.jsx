"use client"

import { usePathname } from "next/navigation"
import { Trash2 } from "lucide-react"
import { useChatSession } from "@/components/chat-session-provider"

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
})

export function ChatHistory({ className = "" }) {
  const pathname = usePathname()
  const { userId, history, historyLoading, historyBusy, historyNotice, activeId, status, openSession, deleteSession } =
    useChatSession()
  if (!userId) return null

  const disabled = historyBusy || status === "submitted" || status === "streaming"

  return (
    <section className={`chat-history ${className}`} aria-label="저장한 대화">
      <h2 className="chat-history-heading">저장한 대화 <span>{history.length}/5</span></h2>
      {historyLoading && <p className="chat-history-empty">목록을 불러오는 중이에요.</p>}
      {!historyLoading && history.length === 0 && !historyNotice && (
        <p className="chat-history-empty">저장한 대화가 없어요.</p>
      )}
      <ul className="chat-history-list">
        {history.map(({ id, created_at }) => {
          const title = `${dateFormat.format(new Date(created_at))} 대화`
          return (
            <li key={id} className="chat-history-item">
              <button type="button" className="chat-history-open focus-ring" disabled={disabled}
                aria-current={id === activeId ? "true" : undefined} onClick={() => void openSession(id)}>
                {title}
              </button>
              <button type="button" className="chat-history-delete focus-ring" disabled={disabled}
                aria-label={`${title} 삭제`} onClick={() => {
                  if (window.confirm("저장한 대화를 삭제할까요?")) void deleteSession(id)
                }}>
                <Trash2 aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
      {pathname !== "/chat" && historyNotice && <p className="chat-history-empty" role="status">{historyNotice}</p>}
    </section>
  )
}
