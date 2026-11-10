import { google } from "@ai-sdk/google"
import { convertToModelMessages, safeValidateUIMessages, streamText } from "ai"
export const maxDuration = 30
const focusInstructions = {
  situation:
    "대화에서는 상황을 먼저 살펴봅니다. 무슨 일이 있었는지, 언제부터인지, 일상에 어떤 영향을 주는지 한 번에 하나씩 묻고 성급하게 원인을 추측하지 않습니다.",
  feelings:
    "대화에서는 사용자가 직접 표현한 감정과 몸의 신호를 살펴봅니다. 감정의 이름을 대신 붙이거나 강도를 추측하지 말고, 사용자의 표현을 바탕으로 부드럽게 질문합니다.",
  consultation:
    "대화에서는 전문가 상담을 준비하도록 돕습니다. 상담에서 다루고 싶은 주제, 최근 상황, 원하는 도움, 전문가에게 물어보고 싶은 내용을 정리하되 답변을 강요하지 않습니다.",
}
const baseInstructions = `당신은 한국 청년의 마음 정리와 전문가 상담 준비를 돕는 대화 도우미 '마음결'입니다.

- 의료진이나 상담 전문가인 척하지 않습니다. 진단, 치료, 약 복용·중단 조언을 하지 않습니다.
- 사용자의 말을 공감적이고 중립적으로 반영합니다. 판단, 낙인, 성급한 긍정, 확정적인 원인 추측을 피합니다.
- 한국어로 짧고 자연스럽게 답하고, 한 번에 하나의 부담 없는 후속 질문만 합니다. 사용자가 답하고 싶지 않으면 건너뛰어도 된다고 알려줍니다.
- 사용자의 말에서 확인된 내용만 정리합니다. 정보가 부족하면 단정하지 말고 먼저 확인합니다.
- 자해·자살 생각이나 당장의 위험이 언급되면 다른 질문보다 안전을 우선합니다. 한국에서 즉각적인 위험이면 112 또는 119에 연락하고, 자살예방상담전화 109 또는 가까운 믿을 수 있는 사람에게 지금 바로 도움을 요청하도록 안내합니다. 혼자 있지 말고 안전한 곳으로 이동하도록 권합니다.
- 위기 상황이 아닌 경우에도 전문적인 도움이 필요해 보이면 지역 정신건강복지센터나 적절한 전문가와 연결할 수 있다고 안내합니다.
- 개인정보 보호를 과장하거나 '아무에게도 전달되지 않는다'고 약속하지 않습니다.
- 목표는 정신건강 문제를 해결하는 것이 아니라, 사용자가 자신의 고민을 정리하고 실제 도움을 받기까지의 진입장벽을 낮추는 것입니다.`
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
function normalizeMessages(input) {
  return input.slice(-24).flatMap((candidate, index) => {
    if (!isRecord(candidate) || !Array.isArray(candidate.parts)) return []
    if (candidate.role !== "user" && candidate.role !== "assistant") return []
    const parts = candidate.parts
      .filter((part) => isRecord(part) && part.type === "text" && typeof part.text === "string")
      .slice(0, 8)
      .map((part) => ({
        type: "text",
        text: String(part.text).slice(0, 2000),
      }))
      .filter((part) => part.text.trim().length > 0)
    if (parts.length === 0) return []
    return [
      {
        id: typeof candidate.id === "string" ? candidate.id.slice(0, 128) : `message-${index}`,
        role: candidate.role,
        parts,
      },
    ]
  })
}
export async function POST(request) {
  try {
    const body = await request.json()
    if (!isRecord(body) || !Array.isArray(body.messages) || body.messages.length > 24) {
      return Response.json({ error: "대화 내용을 확인해 주세요." }, { status: 400 })
    }
    const messages = normalizeMessages(body.messages)
    const latestMessage = messages.at(-1)
    const totalCharacters = messages.reduce(
      (total, message) =>
        total +
        message.parts.reduce(
          (messageTotal, part) => messageTotal + (part.type === "text" ? part.text.length : 0),
          0,
        ),
      0,
    )
    if (messages.length === 0 || latestMessage?.role !== "user" || totalCharacters > 12000) {
      return Response.json({ error: "메시지가 너무 길거나 올바르지 않습니다." }, { status: 400 })
    }
    const validation = await safeValidateUIMessages({ messages })
    if (!validation.success) {
      return Response.json({ error: "대화 내용을 확인해 주세요." }, { status: 400 })
    }
    const focus = body.focus
    const selectedFocus =
      focus === "situation" || focus === "consultation" || focus === "feelings" ? focus : "feelings"
    const result = streamText({
      model: google("gemini-3.8-flash"),
      instructions: `${baseInstructions}\n\n대화 방향: ${focusInstructions[selectedFocus]}`,
      messages: await convertToModelMessages(validation.data),
      temperature: 0.35,
      maxOutputTokens: 420,
    })
    return result.toUIMessageStreamResponse()
  } catch {
    return Response.json(
      { error: "응답을 준비하지 못했어요. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    )
  }
}
