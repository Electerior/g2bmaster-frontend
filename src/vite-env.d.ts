/// <reference types="vite/client" />

// 백엔드 주소는 배포 환경마다 다르다 — 빌드 시점 주입값이라 타입을 명시해 오타를 막는다.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /**
   * 앱 API 키. 쓰기·비용 경로(@RequireAppAuth)를 백엔드가 이 키로 가린다.
   * 비우면 헤더를 붙이지 않는다(백엔드도 키가 없으면 인증을 끈다 = 개발 모드).
   * 자세한 배선은 lib/apiClient.ts 참고.
   */
  readonly VITE_APP_API_KEY?: string;
  /**
   * 공고 단순 요약(POST /api/notice-summary)을 부를지.
   * 'true'일 때만 호출하며 백엔드 g2b.ai.enabled와 짝을 이룬다. 기본(미설정)은 꺼짐이다.
   * LLM 장애는 HTTP 200 aiFallback 응답으로 처리한다. 자세한 건 api/config.ts 참고.
   * 로컬 첨부 색인을 읽는 scan-attachments 는 이 플래그의 대상이 아니다.
   */
  readonly VITE_AI_ENABLED?: string;
  /**
   * 베타 접수를 받는 구글 Apps Script 웹앱 주소(docs/beta-signup.gs).
   *
   * 보통 설정하지 않는다 — 기본 주소가 src/api/beta.ts 에 있어 /beta 랜딩은 그것으로 돈다.
   * 여기에 다른 주소를 주면 그쪽이 이기고, 빈 문자열을 명시하면 Spring 의 /api/beta/* 로
   * 돌아간다. 자세한 판단 근거는 api/beta.ts 의 DEFAULT_SHEET_URL 주석 참고.
   */
  readonly VITE_BETA_SHEET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css';
