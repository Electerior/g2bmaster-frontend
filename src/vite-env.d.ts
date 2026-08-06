/// <reference types="vite/client" />

// 백엔드 주소는 배포 환경마다 다르다 — 빌드 시점 주입값이라 타입을 명시해 오타를 막는다.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /**
   * 베타 접수를 받는 구글 Apps Script 웹앱 주소(docs/beta-signup.gs).
   * 있으면 /beta 랜딩이 Spring 대신 여기로 붙는다. 비우면 /api/beta/* 로 돌아간다.
   */
  readonly VITE_BETA_SHEET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css';
