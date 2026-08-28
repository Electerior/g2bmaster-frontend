# /beta 프리렌더

`npm run build` 는 이제 `dist/beta.html` 을 함께 만든다. JS 없이도 본문이 읽히는
`/beta` 문서다.

```
tsc -b  →  vite build  →  node scripts/prerender-beta.mjs
```

| | 본문 바이트 | 본문 단어 |
|---|---|---|
| `dist/index.html` (셸, 모든 라우트) | 5,851 B / `<body><div id="root"></div></body>` | 0 |
| `dist/beta.html` | 32,977 B | 1,267 |

---

## ⚠ 배포 전에: nginx 한 줄이 함께 가야 한다

**이 변경만으로는 라이브에서 아무 일도 일어나지 않는다.** `deploy/nginx-g2b-masters.conf`
(브랜치 `feat/nginx-edge-hardening` 소유)의 `location /` 이 지금은 이렇다.

```nginx
location / {
    try_files $uri $uri/ @spa;
}
```

`/beta` 요청은 `beta` 라는 파일도 `beta/` 라는 디렉터리도 없으므로 `@spa` 로 떨어지고,
거기서 셸(`index.html`)이 나간다 — 즉 `dist/beta.html` 은 만들어지지만 아무도 받지 못한다.
필요한 변경은 한 조각이다.

```nginx
location / {
    try_files $uri $uri.html $uri/ @spa;
}
```

함께 확인할 것:

- **`/beta/`(끝 슬래시)** 는 여전히 `@spa` 로 떨어져 셸을 200 으로 낸다. 같은 내용이 두
  주소에 생기는 것은 아니지만(한쪽은 빈 셸이다) 색인 대상이 갈라질 여지는 남는다.
  `@spa` 의 라우트 정규식에서 `beta` 만 끝 슬래시를 빼거나,
  `location = /beta/ { return 301 /beta; }` 를 두는 편이 깔끔하다.
- `$uri.html` 은 `/beta` 말고도 열린다. `dist` 의 나머지 `.html` 은
  `index.html` · `google9c899d4c05ca14dc.html` 이고, 감사 1.2 의 `public/404.html` 이
  들어오면 하나 더 는다. 즉 `/index` · `/404` 라는 주소가 새로 200 이 된다. 색인시키고
  싶지 않으면 `location = /index { return 301 /; }` · `location = /404 { return 404; }`
  같은 정리를 함께 넣는다.
- 배포 후 확인:
  ```bash
  curl -sI https://g2b-masters.electerior.co.kr/beta | head -3   # 200, 리다이렉트 없음
  curl -s  https://g2b-masters.electerior.co.kr/beta | grep -c "연 200조"   # 1
  ```

### 왜 `dist/beta/index.html` 이 아닌가

디렉터리로 내면 nginx 는 `try_files $uri/` 로 그것을 집어 `/beta/` 를 서빙한다. 그 순간
대표 주소가 `/beta` 인지 `/beta/` 인지가 서버 설정에 따라 달라지고, `sitemap.xml`(감사
ACTION-PLAN 1.3)·`routePaths.ts`·이 문서가 적어 둔 canonical 은 전부 슬래시 없는
`/beta` 다. 한 글자 차이로 색인이 갈라지는 것을 감수할 이유가 없어서, 파일 이름 쪽을
바꾸고 nginx 에 한 조각을 요구하는 쪽을 골랐다.

---

## 구조

| 파일 | 역할 |
|---|---|
| `src/features/beta/standalone.tsx` | 서버와 브라우저가 **함께 쓰는** 트리(`QueryClientProvider` + 랜딩) |
| `src/features/beta/prerender.tsx` | 서버 진입점. `renderToString` 으로 본문 문자열을 만든다 |
| `src/features/beta/prerenderDocument.ts` | 셸(`index.html`) → `/beta` 문서 조립. 순수 문자열 함수 |
| `scripts/prerender-beta.mjs` | 빌드 후 단계. SSR 번들 → 렌더 → 조립 → `dist/beta.html` |
| `src/main.tsx` | 프리렌더 표식을 보고 `createRoot` 대신 `hydrateRoot` 로 분기 |
| `src/test/betaPrerender.test.tsx` | 위 전부의 회귀 잠금 |

### 왜 헤드리스 브라우저가 아닌가

`react-snap` · `vite-plugin-prerender` 는 Puppeteer/Playwright 를 끌고 온다. 이 저장소에는
둘 다 없고, 넣으면 200MB 짜리 브라우저와 그것을 띄우는 CI 시간이 의존성이 된다.
`react-dom/server` 는 이미 `dependencies` 에 있는 `react-dom` 안에 들어 있다 — **새 의존성
0개.** 더 중요한 차이는 통제력이다. 헤드리스로 찍으면 그 시점의 화면 상태(스크롤 위치,
타이머가 몇 번 돌았는지, IntersectionObserver 가 발화했는지)가 HTML 로 굳고, 그렇게 굳은
마크업은 브라우저의 첫 렌더와 어긋나기 쉽다. 서버 렌더는 효과가 아예 돌지 않으므로
"각 훅의 useState 초기값"이라는 한 가지 상태만 나오고, 그 값이 곧 브라우저의 첫 렌더값이다.

### 왜 라우터를 통과하지 않는가

`router.tsx` 의 `/beta` 는 `React.lazy` 다. 브라우저가 라우터를 통해 이어받으려 하면 첫
렌더가 랜딩이 아니라 스피너(`BetaFallback`)라 서버 마크업과 어긋난다. lazy 를 미리 불러 둬도
첫 렌더는 반드시 한 번 suspend 한다. 그래서 프리렌더 경로는 `BetaStandalone` 을 직접 그리고,
라우터는 앱 안에서 `/beta` 로 이동할 때만 쓰인다. 라우터 컨텍스트 자체는 양쪽 다 씌운다
(서버 `StaticRouter`, 브라우저 `BrowserRouter` — 둘 다 DOM 을 그리지 않아 마크업이 같다).
ACTION-PLAN 2.1 의 `useSeoMeta()` 가 `useLocation()` 을 쓰기 때문이다.

### 하이드레이션 불일치를 만들지 않기 위한 규칙

1. **시각에 의존하는 값은 서버에서 확정하지 않는다.** 모집 마감 카운트다운은 초기값
   `'—'` 을 그대로 내보낸다. 빌드 시각의 "3일 4시간"을 박으면 문서는 배포된 순간부터 틀리고
   브라우저 계산값과도 달라진다. 잔여 자리도 정원(50)에서 출발하는 초기값을 그대로 낸다.
2. **반대로 고정된 수치는 최종값으로 그린다.** `useCountUp` · `useGrow` 는 첫 렌더가
   최종값이고, 애니메이션은 레이아웃 효과에서 0 으로 되돌린 뒤 시작한다(페인트 전이라
   눈에 보이는 튐이 없다). 그래서 알파 테스트 수치(5.5건 → 12.0건, 11.2% → 20.6%)가
   HTML 안에 실제로 들어간다. 예전 구현대로면 `0.0건` 이 박혔다 — 없는 것보다 나쁘다.
3. **서버에서 데이터를 미리 받지 않는다.** `QueryClient` 는 빈 채로 넘긴다. 채우면 그
   순간의 잔여 자리가 HTML 에 굳고 브라우저의 첫 렌더(`FALLBACK_STATUS`)와 달라진다.

`src/test/betaPrerender.test.tsx` 가 실제로 `hydrateRoot` 를 돌려 콘솔에 불일치 경고가
없는지 확인한다. 마크업을 한 글자만 어긋내도 이 시험이 깨진다.

### 프리렌더된 문서에만 들어가는 CSS

`landing.css` 는 `[data-hero]` · `[data-reveal]` 를 `opacity:0` 에서 시작시키고 JS 가
`.is-in` 을 붙여 나타나게 한다. 그대로 두면 본문은 있는데 화면은 JS 가 돌 때까지 검은
채로 있어 **LCP 가 프리렌더 이전과 같아진다.** 그래서 첫 화면(`[data-hero]`)만 처음부터
보이도록 `<style>` 한 줄을 넣는다 — 이 문서에서 히어로 등장 애니메이션이 사라지는 것과
맞바꾼 것이고, 접힘 아래의 스크롤 리빌은 그대로 살아 있다. JS 가 꺼진 브라우저를 위한
전체 보정은 `<noscript>` 안에 따로 둔다(켜져 있는 방문자에게 적용되면 연출이 죽는다).

---

## 따라오는 정리 — 다른 브랜치가 머지된 뒤

### `feat/seo-per-route-meta` (ACTION-PLAN 2.1)

`src/features/beta/prerenderDocument.ts` 의 `SITE_ORIGIN` 과 `BETA_META` 는 **임시
거처다.** 그 브랜치가 `src/seo/siteOrigin.ts` 와 `src/seo/routeMeta.ts` 로 같은 것을 만든다.
머지 뒤 두 상수를 지우고

```ts
import { canonicalUrlFor } from '@/seo/siteOrigin';
import { ROUTE_META } from '@/seo/routeMeta';
import { ROUTES } from '@/routes/routePaths';

const BETA_META = ROUTE_META[ROUTES.beta];
const BETA_URL = canonicalUrlFor(ROUTES.beta);
```

로 바꾼다. `title` · `description` 문자열은 그 브랜치가 정한 값을 **글자 그대로** 옮겨 온
것이라 머지는 값의 변경이 아니라 출처의 통합이다.

### `fix/seo-canonical-host` (ACTION-PLAN 1.1)

`og:image` 와 JSON-LD 는 셸에서 그대로 물려받는다 — 호스트 교정이 그 브랜치 몫이고,
여기서 값을 다시 박으면 그쪽이 고쳐도 `beta.html` 만 옛 값으로 남는다. 머지되면 자동으로
따라온다. `/beta` 전용 OG 카드는 ACTION-PLAN 3.4 다.

### `chore/vite-build-hardening`

`vite.config.ts` 의 `build` 블록에서 충돌한다(이쪽은 `manifest: true` 한 줄을 추가했고
그쪽은 `sourcemap` · `rollupOptions` 를 손댄다). 둘 다 남기면 된다 — `manifest` 는
프리렌더가 청크 이름을 알아내는 유일한 출처이고, 그쪽의 `manualChunks` 로 청크가 어떻게
갈리든 `scripts/prerender-beta.mjs` 가 manifest 를 재귀로 훑어 따라간다.
