/**
 * 공고 단순 요약(POST /api/notice-summary)을 호출할 것인가.
 *
 * 화면은 이 플래그가 켜졌을 때만 요약을 부른다. 백엔드 AI 설정과 짝을 이루는 프론트
 * 스위치이며, LLM 장애는 HTTP 200 `aiFallback` 응답으로 화면에 표시한다.
 * `POST /api/scan-attachments`는 로컬 첨부 색인 조회라 이 게이트를 타지 않는다.
 *
 * 런타임 설정·모델 목록 API는 현재 Spring 계약에 없고 소비 화면도 없어 제거했다.
 * 요약 활성화 여부의 단일 출처는 빌드타임 환경변수다.
 */
export function isAiEnabled(): boolean {
  return import.meta.env.VITE_AI_ENABLED === 'true';
}
