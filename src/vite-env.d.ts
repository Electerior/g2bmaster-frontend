/// <reference types="vite/client" />

// 백엔드 주소는 배포 환경마다 다르다 — 빌드 시점 주입값이라 타입을 명시해 오타를 막는다.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css';
