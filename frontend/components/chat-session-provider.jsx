"use client"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useRouter } from "next/navigation"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase/client"
export const chatFocusOptions = [
  {
    id: "situation",
    label: "상황부터 정리하기",
    description: "무슨 일이 있었는지 차분히 살펴봐요",
  },
  {
    id: "feelings",
    label: "감정 살펴보기",
    description: "지금 마음에 가까운 말을 찾아봐요",
  },
  {
    id: "consultation",
    label: "상담 준비하기",
    description: "전문가에게 전할 내용을 정리해요",
  },
]
const transport = new DefaultChatTransport({
  api: "/api/chat",
  prepareSendMessagesRequest({ body, messages }) {
    // Saved conversations can be longer than the chat endpoint's context limit.
    let start = messages.length
    let remaining = 12_000
    while (start > 0 && messages.length - start < 24) {
      const length = messages[start - 1].parts.reduce(
        (total, part) => total + (part.type === "text" ? part.text.length : 0),
        0,
      )
      if (length > remaining) break
      remaining -= length
      start -= 1
    }
    return { body: { ...body, messages: messages.slice(start) } }
  },
})
const ChatSessionContext = createContext(null)
const historyColumns = "id,created_at,updated_at"

function textMessages(messages) {
  return messages.flatMap((message) => {
    if (!message || typeof message.id !== "string" || !Array.isArray(message.parts) ||
      (message.role !== "user" && message.role !== "assistant")) return []
    const parts = message.parts
      .filter((part) => part?.type === "text" && typeof part.text === "string" && part.text.trim())
      .map(({ text }) => ({ type: "text", text }))
    return parts.length ? [{ id: message.id, role: message.role, parts }] : []
  })
}

async function listHistory(userId) {
  const { data, error } = await createClient().from("chat_sessions")
    .select(historyColumns).eq("user_id", userId).order("updated_at", { ascending: false })
  if (error) throw error
  return data
}

export function ChatSessionProvider({ children }) {
  const { user } = useAuth()
  return <AccountChatSession key={user?.id ?? "guest"} userId={user?.id}>{children}</AccountChatSession>
}

function AccountChatSession({ children, userId }) {
  const router = useRouter()
  const [focus, setFocus] = useState("feelings")
  const [summary, setSummary] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(Boolean(userId))
  const [historyBusy, setHistoryBusy] = useState(false)
  const [historyNotice, setHistoryNotice] = useState("")
  const [activeId, setActiveId] = useState(null)
  const [sessionVersion, setSessionVersion] = useState(0)
  const pending = useRef(false)
  const mounted = useRef(false)
  const draftId = useRef(null)
  const chat = useChat({ transport })
  const streaming = chat.status === "submitted" || chat.status === "streaming"

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    listHistory(userId).then((records) => {
      if (!cancelled) setHistory(records)
    }).catch(() => {
      if (!cancelled) setHistoryNotice("저장된 대화 목록을 불러오지 못했어요.")
    }).finally(() => {
      if (!cancelled) setHistoryLoading(false)
    })
    return () => { cancelled = true }
  }, [userId])

  async function runHistoryAction(action, errorMessage) {
    if (!userId || streaming || historyLoading || pending.current) return
    pending.current = true
    setHistoryBusy(true)
    setHistoryNotice("")
    try {
      await action(createClient())
    } catch (error) {
      if (error?.message === "chat_session_limit") {
        setHistoryNotice("대화는 5개까지 저장할 수 있어요. 기존 기록을 삭제한 후 다시 시도해 주세요.")
        try {
          setHistory(await listHistory(userId))
        } catch {
          // Keep the existing list if refreshing it also fails.
        }
      } else {
        setHistoryNotice(errorMessage)
      }
    } finally {
      pending.current = false
      setHistoryBusy(false)
    }
  }

  function saveSession() {
    const messages = textMessages(chat.messages)
    if (!messages.length) return
    return runHistoryAction(async (supabase) => {
      draftId.current ??= crypto.randomUUID()
      const { data, error } = activeId
        ? await supabase.from("chat_sessions")
          .update({ focus, messages, updated_at: new Date().toISOString() })
          .eq("id", activeId).eq("user_id", userId)
          .eq("updated_at", history.find((record) => record.id === activeId).updated_at)
          .select(historyColumns).maybeSingle()
        : await supabase.rpc("create_chat_session", {
          chat_id: draftId.current, chat_focus: focus, chat_messages: messages,
        }).single()
      if (error) throw error
      if (!data) {
        setHistoryNotice("다른 탭에서 이 대화를 변경했어요. 목록에서 다시 연 후 저장해 주세요.")
        return
      }
      setActiveId(data.id)
      setHistory((current) => [data, ...current.filter((record) => record.id !== data.id)])
      setHistoryNotice("대화를 저장했어요.")
    }, "대화를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.")
  }

  function openSession(id) {
    return runHistoryAction(async (supabase) => {
      const { data, error } = await supabase.from("chat_sessions")
        .select(`${historyColumns},focus,messages`).eq("id", id).eq("user_id", userId).single()
      if (error) throw error
      if (!mounted.current) return
      const { created_at, updated_at } = data
      setHistory((current) => current.map((record) => record.id === id ? { id, created_at, updated_at } : record))
      replaceSession(textMessages(data.messages), data.focus, id)
      router.push("/chat")
    }, "대화를 열지 못했어요. 목록을 새로고침한 후 다시 시도해 주세요.")
  }

  function deleteSession(id) {
    return runHistoryAction(async (supabase) => {
      const { error } = await supabase.from("chat_sessions")
        .delete().eq("id", id).eq("user_id", userId)
      if (error) throw error
      setHistory((current) => current.filter((record) => record.id !== id))
      if (activeId === id) replaceSession()
      setHistoryNotice("저장한 대화를 삭제했어요.")
    }, "대화를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.")
  }

  function replaceSession(messages = [], nextFocus = "feelings", id = null) {
    chat.setMessages(messages)
    chat.clearError()
    setFocus(nextFocus)
    setSummary(null)
    setActiveId(id)
    setSessionVersion((version) => version + 1)
    draftId.current = null
  }

  function resetSession() {
    if (pending.current) return
    if (streaming) void chat.stop()
    replaceSession()
    setHistoryNotice("")
  }
  return (
    <ChatSessionContext.Provider
      value={{
        messages: chat.messages,
        sendMessage: chat.sendMessage,
        status: chat.status,
        error: chat.error,
        stop: chat.stop,
        clearError: chat.clearError,
        setMessages: chat.setMessages,
        focus,
        setFocus,
        summary,
        setSummary,
        resetSession,
        userId,
        history,
        historyLoading,
        historyBusy,
        historyNotice,
        activeId,
        sessionVersion,
        saveSession,
        openSession,
        deleteSession,
      }}
    >
      {children}
    </ChatSessionContext.Provider>
  )
}
export function useChatSession() {
  const context = useContext(ChatSessionContext)
  if (!context) {
    throw new Error("useChatSession must be used inside ChatSessionProvider")
  }
  return context
}
