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
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
};

export default defineConfig(config);
