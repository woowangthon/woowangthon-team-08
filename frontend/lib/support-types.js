const typeRules = [
  ["심리상담", /(?:심리|정서|정신건강|마음건강|전문|개인|집단|일대일|1[:대]1)상담(?!비|료)|상담서비스/],
  ["상담비·바우처", /상담비|상담료|마음투자|(?:심리|상담|마음건강).{0,10}바우처|바우처.{0,10}(?:심리|상담)/],
  ["심리검사", /심리(?:종합)?검사|정서검사|정신건강(?:선별)?검사|심리평가/],
  ["집단 프로그램", /(?:집단|그룹)(?:프로그램|상담|치료)|자조모임/],
  ["치료비·의료 지원", /치료비|의료비|입원비|진료비|약제비|치료지원|심리치료/],
]
const otherType = "기타 지원"

export const supportTypes = [...typeRules.map(([label]) => label), otherType]

export function classifySupportTypes(title, support) {
  const fields = [title, support].map((text) => text.replace(/\s+/g, ""))
  const types = typeRules.filter(([, pattern]) => fields.some((text) => pattern.test(text))).map(([label]) => label)
  return types.length ? types : [otherType]
}
