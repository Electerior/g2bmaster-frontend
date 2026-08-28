/*
 * /beta 를 빌드 때 한 번 그리는 쪽(서버 진입점).
 *
 * 이 파일은 브라우저 번들에 들어가지 않는다. scripts/prerender-beta.mjs 가 vite 의 SSR
 * 빌드로 이것만 따로 묶어 node 에서 부른다. 앱 코드에서 여기를 import 하는 곳은 없다.
 *
 * ── 왜 브라우저(react-snap·puppeteer)가 아니라 react-dom/server 인가 ────────
 * 하나, 이 환경에 Playwright/Puppeteer 가 없다. 붙이면 200MB 짜리 브라우저와 그것을
 * 띄우는 CI 시간이 의존성으로 따라온다. react-dom 은 이미 dependencies 에 있고
 * react-dom/server 는 그 패키지 안에 들어 있다 — **새 의존성이 0개다.**
 * 둘, 무엇이 그려지는지를 완전히 통제할 수 있다. 헤드리스 브라우저로 찍으면 그 시점의
 * 화면 상태(스크롤 위치·타이머가 몇 번 돌았는지·IntersectionObserver 가 발화했는지)가
 * 그대로 HTML 로 굳는다. 그렇게 굳은 마크업은 브라우저의 첫 렌더와 어긋나기 쉽고,
 * 어긋나면 React 18 은 이어받기를 포기하고 화면을 통째로 다시 그린다 — 프리렌더로 얻으려던
 * LCP 이득이 사라지고 깜빡임만 남는다. 서버 렌더는 효과가 아예 돌지 않으므로 "각 훅의
 * useState 초기값"이라는 한 가지 상태만 나온다. 그 값이 곧 브라우저의 첫 렌더값이다.
 *
 * ── 시각에 의존하는 값을 서버에서 확정하지 않는다 ──────────────────────────
 * 모집 마감 카운트다운(useCountdown)은 초기값이 '—' 이고 마운트 후에야 실제 남은 시간을
 * 계산한다. 빌드 시각의 "3일 4시간"을 HTML 에 박아 두면 그 문서는 배포된 순간부터 틀린
 * 값을 보여 주고, 브라우저가 계산한 값과도 달라 이어받기가 깨진다. 잔여 자리(useCountDown)도
 * 같은 이유로 정원(50)에서 출발하는 초기값을 그대로 내보낸다 — 서버 응답이 오면 브라우저가
 * 굴려서 내린다. 실제 수치가 필요한 곳(알파 테스트 결과·잔여 자리 표시)은 반대로 최종값이
 * 첫 렌더에 오도록 useLandingMotion 쪽을 고쳤다(useCountUp 주석 참고).
 */
/*
 * react-refresh 규칙은 끈다. 그 규칙은 "브라우저에서 갱신되는 모듈"을 전제로 컴포넌트만
 * 내보내라고 하는데, 이 파일은 빌드 때 node 에서 한 번 불리고 끝나는 서버 진입점이다.
 * 브라우저 번들에 들어가지 않으므로 fast refresh 대상 자체가 아니다.
 */
/* eslint-disable react-refresh/only-export-components */
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { QueryClient } from '@tanstack/react-query';
import { ROUTES } from '@/routes/routePaths';
import { routeSchemaScriptTag } from '@/seo/routeSchema';
import { BetaStandalone } from './standalone';
import { BETA_META } from './prerenderDocument';

export {
  BETA_META,
  BETA_URL,
  SITE_ORIGIN,
  buildBetaDocument,
  countVisibleWords,
  PRERENDER_MARKER,
  PRERENDER_MARKER_VALUE,
} from './prerenderDocument';

/**
 * 프리렌더된 /beta 의 head 에 들어갈 라우트별 JSON-LD.
 *
 * 별도 export 로 두는 이유가 둘이다.
 *
 * 하나, **크롤러가 읽는 것은 이 문자열뿐이다.** useSeoMeta 는 브라우저에서만 돌고 /beta 는
 * 빌드 때 dist/beta.html 로 미리 그려진다. 카카오톡·구글 크롤러가 JS 없이 읽는 그 정적
 * head 에 노드가 들어가지 않으면, 이 브랜치는 정작 구조화 데이터가 가장 필요한 단 하나의
 * 주소에서 아무 효과가 없다.
 *
 * 둘, 값을 여기서 만들지 않는다. `@/seo/routeSchema` 가 ROUTE_META 에서 조립한 것을
 * 그대로 통과시킨다 — 프리렌더가 자기 문자열을 따로 만드는 순간 같은 사실이 두 곳에
 * 살게 되고, 그것이 이 감사의 근본 원인이었다(prerenderDocument.ts 머리 주석의 "왜 셸을
 * 베끼나" 문단과 같은 이야기다).
 *
 * `null` 이 될 수 없는 값이지만 타입은 `string | null` 이다. /beta 가 어떤 이유로든
 * 스키마 대상에서 빠지면 여기서 조용히 빈 문자열이 나가는 대신 스크립트가 멈춰야 한다 —
 * 판단은 부르는 쪽(scripts/prerender-beta.mjs)에 맡긴다.
 */
export const BETA_SCHEMA_SCRIPT: string | null = routeSchemaScriptTag(ROUTES.beta);

/**
 * #root 안쪽에 들어갈 마크업.
 *
 * renderToStaticMarkup 이 아니라 renderToString 이다. 전자는 이어받기에 필요한 표식
 * (인접한 텍스트 노드를 가르는 `<!-- -->`)을 빼 버려서, 브라우저가 같은 트리를 그려도
 * 텍스트 경계가 달라진다.
 *
 * QueryClient 는 여기서 새로 만든다. 상태를 하나도 담지 않은 빈 클라이언트여야 한다 —
 * 서버에서 /api/beta/status 를 미리 불러 채우면 그 순간의 잔여 자리가 HTML 에 굳고,
 * 브라우저의 첫 렌더(FALLBACK_STATUS)와 달라진다. 랜딩은 서버 응답이 없을 때 대체값으로
 * 그리도록 이미 설계돼 있으므로(BetaLandingScreen 주석) 빈 채로 두는 것이 정답이다.
 */
export function renderBetaBody(): string {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return renderToString(
    <StaticRouter location={BETA_META.path}>
      <BetaStandalone queryClient={queryClient} />
    </StaticRouter>,
  );
}
