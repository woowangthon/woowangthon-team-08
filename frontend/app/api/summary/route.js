import { google } from "@ai-sdk/google"
import { generateText } from "ai"
import { z } from "zod"
export const maxDuration = 30
const requestSchema = z.object({
  transcript: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(24),
  focus: z.enum(["situation", "feelings", "consultation"]).optional(),
})
const focusLabels = {
  situation: "상황을 먼저 살펴보기",
  feelings: "감정을 살펴보기",
  consultation: "전문가 상담을 준비하기",
}
export async function POST(request) {
  try {
    const body = await request.json()
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "대화 내용을 확인해 주세요." }, { status: 400 })
    }
    const totalCharacters = parsed.data.transcript.reduce(
      (total, message) => total + message.text.length,
      0,
    )
    if (totalCharacters > 12000) {
      return Response.json({ error: "대화가 너무 길어요." }, { status: 413 })
    }
    const focus = parsed.data.focus ?? "feelings"
    const conversation = parsed.data.transcript
      .map((message) => `${message.role === "user" ? "사용자" : "마음결"}: ${message.text}`)
      .join("\n")
    const result = await generateText({
      model: google("gemini-3.8-flash"),
      instructions: `당신은 청년의 상담 준비를 돕는 메모 작성 도우미입니다.
- 사용자가 직접 말한 정보만 사용하고 진단, 평가, 원인 추측을 하지 않습니다.
- 감정의 변화는 대화에서 분명하게 드러난 표현만 시간 순서로 정리합니다. 변화가 분명하지 않으면 그렇게 적고, 감정의 강도나 이유를 새로 만들어내지 않습니다.
- 짧고 따뜻한 한국어로 작성합니다. 상담 전문가의 치료 조언처럼 말하지 않습니다.
- 아래 네 개의 제목을 그대로 사용하고, 각 항목은 1~3개의 짧은 문장 또는 글머리표로 씁니다.
### 고민 요약
### 마음의 흐름
### 상담에서 나누고 싶은 점
### 다음 한 걸음
- 다음 한 걸음은 작고 선택 가능한 제안으로 씁니다. 위기 상황이 드러나면 실제 사람과 긴급 지원에 연결하는 내용을 우선합니다.`,
      prompt: `대화 방향: ${focusLabels[focus]}\n\n아래 대화를 상담 준비 메모로 정리해 주세요. 대화의 일부가 부족해도 추측하지 마세요.\n\n${conversation}`,
      temperature: 0.2,
      maxOutputTokens: 560,
    })
    return Response.json({ summary: result.text })
  } catch {
    return Response.json(
      { error: "요약을 준비하지 못했어요. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    )
  }
}
