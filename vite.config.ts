import { defineConfig, type Plugin, type UserConfig } from 'vite';
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

/**
 * react 런타임 한 묶음.
 *
 * react 와 react-dom 을 **다른 청크로 가르지 않는다**. react-dom 은 react 의 내부 상태
 * (`__SECRET_INTERNALS_...` 의 디스패처)를 직접 읽는데, 둘이 다른 청크에 있으면 그 값을
 * 청크 경계 너머에서 참조하게 되고 초기화 순서가 어긋나면 렌더 첫 훅에서 터진다.
 * scheduler 는 react-dom 이 물고 있는 실행 스케줄러라 역시 같이 둔다.
 * react-is · use-sync-external-store 는 지금 트리에 없지만 들어와도 같은 이유로 여기 속한다.
 */
const REACT_CORE = new Set(['react', 'react-dom', 'scheduler', 'react-is', 'use-sync-external-store']);

/**
 * 라우터 한 묶음. react-router-dom 은 react-router 를, react-router 는 @remix-run/router 를
 * 그대로 재수출한다. 셋은 언제나 함께 로드되므로 갈라 봐야 요청만 늘어난다.
 */
const ROUTER = new Set(['react-router', 'react-router-dom', '@remix-run/router']);

/**
 * 마크다운(unified) 생태계.
 *
 * 실제로 쓰는 곳은 `src/components/markdown/Markdown.tsx` 하나인데, 거기서 시작된 의존이
 * micromark · mdast · hast · vfile 계열로 번져 70개가 넘는 패키지를 끌고 온다.
 * 이름이 제각각이라 계열 접두사(MARKDOWN_FAMILIES)로 잡고, 접두사에 안 걸리는 단품 유틸은
 * MARKDOWN_UTILS 에 정확히 적는다. 지금 이 목록에 걸리지 않는 벤더는 axios 하나뿐이다.
 *
 * 주의: 이 청크를 가른다고 초기 페이로드가 곧바로 줄지는 않는다. 라우터가 아직 정적 import 라
 * 마크다운 화면을 안 열어도 청크는 함께 받아진다. 지금 얻는 것은 캐시 분리(마크다운 스택은
 * 거의 안 바뀐다)이고, 실제 지연 로딩은 아래 라우트 코드 스플릿 주석 참고.
 */
const MARKDOWN_FAMILIES = [
  'react-markdown',
  'remark-',
  'rehype-',
  'mdast-',
  'micromark',
  'hast-',
  'unist-',
  'unified',
  'vfile',
  'style-to-',
  'character-entities',
  'estree-util-',
];
const MARKDOWN_UTILS = new Set([
  '@ungap/structured-clone',
  'bail',
  'ccount',
  'comma-separated-tokens',
  'decode-named-character-reference',
  'devlop',
  'escape-string-regexp',
  'extend',
  'html-url-attributes',
  'html-void-elements',
  'inline-style-parser',
  'is-plain-obj',
  'longest-streak',
  'markdown-table',
  'property-information',
  'space-separated-tokens',
  'stringify-entities',
  'trim-lines',
  'trough',
  'web-namespaces',
  'zwitch',
]);

/**
 * 모듈 id 로 벤더 청크를 고른다.
 *
 * `id.includes('react')` 같은 부분 문자열 매칭은 **쓰면 안 된다**. react-dom · react-router-dom ·
 * react-markdown 이 전부 같이 걸려서, 가른 줄 알았는데 결국 한 덩어리가 나온다.
 * 그래서 경로에서 node_modules 다음 세그먼트(스코프 패키지는 두 세그먼트)를 잘라
 * **패키지 이름 단위**로 판단한다. 중첩 설치(A/node_modules/B) 는 마지막 node_modules 가
 * 실제 소유 패키지이므로 lastIndexOf 로 찾는다.
 *
 * node_modules 밖(앱 소스·가상 모듈)은 undefined 를 돌려 rollup 기본 배치에 맡긴다.
 */
function vendorChunk(id: string): string | undefined {
  const marker = '/node_modules/';
  const at = id.lastIndexOf(marker);
  if (at === -1) return undefined;

  const segments = id.slice(at + marker.length).split('/');
  const pkg = segments[0].startsWith('@') ? `${segments[0]}/${segments[1]}` : segments[0];

  if (REACT_CORE.has(pkg)) return 'vendor-react';
  if (ROUTER.has(pkg)) return 'vendor-router';
  if (pkg.startsWith('@tanstack/')) return 'vendor-query';
  if (MARKDOWN_UTILS.has(pkg) || MARKDOWN_FAMILIES.some((family) => pkg.startsWith(family))) {
    return 'vendor-markdown';
  }

  // 나머지 의존(현재는 axios 뿐). 앱 코드보다 훨씬 덜 바뀌므로 앱 청크와는 떼어 둔다.
  return 'vendor';
}

/**
 * 배포되는 index.html 에서 주석을 걷어낸다.
 *
 * 이 파일의 <head> 에는 SEO 블록이 왜 이렇게 생겼는지를 설명하는 한국어 주석이 길게 붙어 있다.
 * 그 주석은 반드시 있어야 한다 — 호스트를 남의 도메인으로 되돌려 놓는 사고가 실제로 났고,
 * 그때 없었던 것이 바로 그 설명이다. 다만 그것은 **저장소에서 읽을 사람**을 위한 것이지
 * 방문자가 매번 내려받을 것은 아니다.
 *
 * 비용이 작지 않다. index.html 은 `cache-control: no-cache` 로 나가므로 캐시에 얹히지 않고
 * 매 요청마다 다시 전송된다. 주석을 붙인 뒤 gzip 기준 2.11kB → 2.90kB 로 늘었다.
 *
 * 그래서 소스에는 남기고 산출물에서만 뺀다. src/test/indexHtmlSeo.test.ts 는 dist 가 아니라
 * 저장소 루트의 index.html 을 읽으므로 이 플러그인의 영향을 받지 않는다.
 *
 * script·style 블록은 통째로 지나친다. JSON-LD 안에 `<!--` 처럼 보이는 문자열이 들어갈 일은
 * 없지만, HTML 주석 제거가 스크립트 내용을 건드리는 일은 어떤 경우에도 없어야 한다 —
 * 정규식 하나로 <head> 를 훑는 작업에서 가장 다치기 쉬운 자리가 거기다.
 */
function stripHtmlComments(): Plugin {
  return {
    name: 'strip-html-comments',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html: string) {
      return html
        // 앞의 갈래가 먼저 물면 그대로 돌려주고(=보존), 아니면 주석이므로 지운다.
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>|<!--[\s\S]*?-->/gi, (matched, tag) =>
          tag ? matched : '',
        )
        // 주석이 있던 자리에 남은 빈 줄 묶음을 한 줄로 줄인다.
        .replace(/\n\s*\n\s*\n+/g, '\n\n');
    },
  };
}

const config: ViteConfigWithTest = {
  plugins: [react(), stripHtmlComments()],
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
    /**
     * 프로덕션 소스맵은 만들지 않는다. 켜 두면 dist 에 `index-*.js.map` 이 같이 나가고,
     * 번들 끝의 `//# sourceMappingURL` 때문에 정적 호스팅에서 그대로 공개된다. 실제로
     * 운영 도메인에서 `/assets/index-*.js.map` 이 200 으로 2.9MB 내려받혔다 — 이유는 두 가지다.
     *
     * 1. 소스 공개: 맵 안에 TypeScript 원문이 통째로 들어간다. 한국어 설계 주석까지 그대로다.
     * 2. 대역폭: 2.9MB. 앱 번들 전체보다 몇 배 크다.
     *
     * 나중에 에러 리포터(Sentry 등)를 붙여 스택 트레이스를 원문으로 복원해야 하면
     * `false` 대신 `'hidden'` 을 쓴다. 맵 파일은 만들되 번들에 `//# sourceMappingURL` 참조를
     * 남기지 않으므로, 맵을 리포터에만 업로드하고 정적 호스팅에서는 빼면 된다.
     */
    sourcemap: false,
    rollupOptions: {
      output: {
        /*
         * 벤더 분리 규칙은 위 vendorChunk 참고. 자르는 축은 "얼마나 자주 바뀌느냐"다 —
         * 앱 코드는 하루에도 몇 번 바뀌지만 react 는 몇 달에 한 번 바뀐다. 한 청크에 섞여 있으면
         * 앱 한 줄 고칠 때마다 파일 해시가 바뀌어 방문자가 react 까지 다시 받는다.
         */
        manualChunks: vendorChunk,
      },
    },
    /*
     * chunkSizeWarningLimit 은 일부러 건드리지 않는다. 한도를 올리는 건 번들이 작아지는 게 아니라
     * 경고만 사라지는 것이고, 그러면 다음에 앱 청크가 다시 커져도 아무도 모른다.
     *
     * 벤더를 갈라 지금은 모든 청크가 한도 아래지만, 앱 청크가 여전히 160KB 대인 건
     * 라우터(`src/routes/router.tsx`)가 화면 14개를 전부 정적 import 하기 때문이다. 방문자는
     * 어느 화면을 보든 트렌드 차트·시스템 대시보드·베타 랜딩 코드까지 다 받는다.
     * 진짜 해법은 라우트 단위 코드 스플릿(React.lazy + Suspense)이고, **별도 브랜치에서 진행 예정**이다.
     * 이 파일은 그때 손댈 필요가 없다 — 동적 import 는 rollup 이 알아서 청크로 가른다.
     */
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
};

export default defineConfig(config);
