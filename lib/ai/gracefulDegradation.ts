export const UNITY_INTELLIGENCE_DEGRADED_USER_MESSAGE_EN =
  'Unity Intelligence insights are updating, but your bank data is 100% accurate and live.'

export function unityIntelligenceDegradedMessage(params?: { disclaimer?: string }) {
  const d = String(params?.disclaimer || '').trim()
  return d ? `${UNITY_INTELLIGENCE_DEGRADED_USER_MESSAGE_EN}\n\n${d}` : UNITY_INTELLIGENCE_DEGRADED_USER_MESSAGE_EN
}


