import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// 개발 중에는 Spring 백엔드(기본 8080)로 /api 를 그대로 프록시한다.
// 배포는 정적 번들을 별도 호스팅하고 VITE_API_BASE_URL 로 백엔드를 가리킨다.
const BACKEND = process.env.VITE_PROXY_TARGET ?? 'http://localhost:8080';

/**
 * 바인딩 주소. 기본은 로컬호스트다 — 개발 서버를 아무 이유 없이 LAN 에 열어 두지 않는다.
 * `npm run dev:host` 가 `0.0.0.0` 을 넣어 Tailscale·LAN 에서 붙을 수 있게 한다.
 */
const DEV_HOST = process.env.VITE_DEV_HOST;

/**
 * Vite 의 Host 헤더 검사 예외.
 *
 * IP 로 붙는 것은 기본 허용이지만 **MagicDNS 이름은 막힌다**
 * (`Blocked request. This host ("server") is not allowed.`).
 * Tailscale 이름으로 열려면 여기에 있어야 한다.
 *
 * `.ts.net` 은 모든 테일넷의 MagicDNS 도메인이고, 그 이름은 테일넷 안에서만 해석된다 —
 * 즉 이 예외가 공개 인터넷에 무언가를 여는 것은 아니다(DNS 리바인딩 방어가 목적인 검사인데,
 * 붙으려면 이미 VPN 안에 있어야 한다). 짧은 호스트명(`server`)은 도메인이 없으므로 따로 적는다.
 * 다른 이름이 필요하면 VITE_ALLOWED_HOSTS 에 콤마로 넘긴다.
 */
const ALLOWED_HOSTS = (process.env.VITE_ALLOWED_HOSTS ?? '.ts.net')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

/**
 * `test` 는 vitest 가 읽는 키다. vitest 2.x 는 자기만의 vite 사본을 물고 있어서
 * 'vitest/config' 의 defineConfig 를 쓰면 플러그인 타입이 두 vite 사이에서 충돌한다.
 * 실행에는 아무 영향이 없는 문제라, 타입만 여기서 넓혀 두고 vite 의 defineConfig 를 쓴다.
 */
type ViteConfigWithTest = UserConfig & {
  test?: {
    environment?: string;
    globals?: boolean;
    setupFiles?: string[];
  };
};

const config: ViteConfigWithTest = {
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    ...(DEV_HOST ? { host: DEV_HOST } : {}),
    allowedHosts: ALLOWED_HOSTS,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/healthz': { target: BACKEND, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    /**
     * 청크 이름표(dist/.vite/manifest.json).
     *
     * 빌드 뒤에 도는 /beta 프리렌더(scripts/prerender-beta.mjs)가 이것을 읽는다. 그 단계는
     * 정적 HTML 안에 랜딩 청크의 CSS 링크와 modulepreload 를 직접 써 넣어야 하는데,
     * 파일 이름에 콘텐츠 해시가 박혀 있어(landing-CRKkmEkO.css) 빌드 전에는 알 수 없다.
     * dist/assets 를 훑어 이름으로 짐작하는 방법도 있지만, 그러면 청크를 어떻게 가르느냐
     * (chore/vite-build-hardening 의 manualChunks)에 따라 조용히 틀린 파일을 링크하게 된다.
     * manifest 는 "이 모듈이 어느 파일이 됐고 무엇을 함께 필요로 하는가"를 vite 가 직접
     * 적어 주는 유일한 출처다.
     *
     * 산출된 manifest.json 은 프리렌더가 다 쓰고 나서 지운다 — 배포물에 남길 이유가 없다.
     */
    manifest: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
};

export default defineConfig(config);
