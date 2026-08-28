/*
 * 프리렌더된 /beta 문서를 조립한다.
 *
 * 입력은 빌드가 방금 만든 dist/index.html(=SPA 셸) 이고, 출력은 같은 문서에서 <head> 의
 * 라우트별 메타만 /beta 것으로 갈아 끼우고 <body> 에 실제 본문을 채운 dist/beta.html 이다.
 *
 * ── 왜 셸을 베끼나, 새 템플릿을 쓰지 않고 ───────────────────────────────────
 * <head> 를 두 벌 두지 않기 위해서다. 폰트 링크·로봇 지시·JSON-LD·og:image 는 /beta 든
 * 앱 화면이든 같은 값이어야 하는데, 템플릿을 따로 만들면 그 순간부터 두 벌이 서로 모르는
 * 채 갈라진다. 이 사이트가 감사에서 34점을 받은 원인이 정확히 그것이었다 — 다른 배포본의
 * <head> 를 복사해 오고 호스트를 다시 지정하지 않아, 모든 주소가 남의 도메인을 정본으로
 * 선언하고 있었다(64b8f74). 같은 사고를 파일 하나 더 만들어 재현할 이유가 없다.
 *
 * 그래서 여기서 갈아 끼우는 것은 **주소마다 달라야 하는 것들뿐**이다.
 * title · description · canonical · hreflang · og:title/description/url · twitter:*.
 * og:image 는 일부러 셸에서 물려받는다 — 호스트 교정은 fix/seo-canonical-host 의 몫이고,
 * /beta 전용 카드는 ACTION-PLAN 3.4 다. 여기서 값을 다시 박으면 그쪽이 고쳐도 이 파일만
 * 옛 값으로 남는다.
 *
 * ── 못 찾으면 빌드를 깬다 ──────────────────────────────────────────────────
 * 아래 치환은 전부 "정확히 한 번 일치"를 요구한다. 셸의 <head> 모양이 바뀌어 패턴이
 * 빗나가면 조용히 옛 메타를 단 문서가 나가는 대신 빌드가 멈춘다. 조용히 틀린 메타가
 * 나가는 것은 배포 뒤 색인에서만 드러나고, 그때는 이미 크롤러가 그것을 읽은 뒤다.
 */

/**
 * 프로덕션 오리진.
 *
 * ⚠ 이 값과 아래 BETA_META 는 **임시 거처다.** ACTION-PLAN 2.1(feat/seo-per-route-meta)이
 *   `src/seo/siteOrigin.ts` 의 SITE_ORIGIN 과 `src/seo/routeMeta.ts` 의 ROUTE_META 로 같은
 *   것을 만든다. 그 브랜치가 머지되면 이 파일에서 두 상수를 지우고
 *
 *       import { SITE_ORIGIN, canonicalUrlFor } from '@/seo/siteOrigin';
 *       import { ROUTE_META } from '@/seo/routeMeta';
 *       const BETA_META = ROUTE_META[ROUTES.beta];
 *
 *   로 바꾼다. 그때 문구가 흔들리지 않도록 title·description 은 그 브랜치가 이미 정해 둔
 *   문자열을 글자 그대로 옮겨 왔다(routeMeta.ts 의 [ROUTES.beta] 항목). 즉 머지는 값의
 *   변경이 아니라 출처의 통합이고, 아래 테스트가 두 값이 갈라지는 것을 잡는다.
 *
 *   이 브랜치에서 src/seo/ 를 만들지 않는 이유는 그 디렉터리가 다른 브랜치 소유이기
 *   때문이다. 같은 경로에 다른 내용을 먼저 만들어 두면 머지가 아니라 충돌이 된다.
 */
export const SITE_ORIGIN = 'https://g2b-masters.electerior.co.kr';

/** /beta 의 라우트별 메타. 위 주석의 이관 계획을 함께 볼 것. */
export const BETA_META = {
  path: '/beta',
  title: '나라장터 입찰공고 자동 탐색 베타 테스터 모집 — G2B Masters',
  description:
    'G2B Masters 베타 테스터 모집. 나라장터 공고 탐색·선별·첨부파일 요약을 자동화합니다. 낙찰 시까지 수수료 0원.',
} as const;

/** canonical·og:url 에 들어가는 절대 주소. 끝에 슬래시를 붙이지 않는다 — 아래 주석 참고. */
export const BETA_URL = `${SITE_ORIGIN}${BETA_META.path}`;

/**
 * 프리렌더된 문서임을 브라우저에 알리는 표식.
 *
 * main.tsx 가 이 값을 보고 createRoot(새로 그림) 대신 hydrateRoot(이어받음)를 고른다.
 * "자식 노드가 있으면 프리렌더"처럼 추측하지 않고 명시적인 속성을 쓰는 이유는, 추측이
 * 틀리는 경우(확장 프로그램이 #root 에 노드를 넣는 등)에 화면이 통째로 깨지기 때문이다.
 */
export const PRERENDER_MARKER = 'data-prerender';
export const PRERENDER_MARKER_VALUE = 'beta';

/**
 * 프리렌더된 문서에만 들어가는 CSS.
 *
 * landing.css 는 [data-hero]·[data-reveal] 를 opacity:0 에서 시작시키고, JS 가 마운트된
 * 뒤에 .is-in 을 붙여 나타나게 한다. 프리렌더한 HTML 에 그 규칙을 그대로 적용하면 **먼저
 * 그려 두는 의미가 사라진다** — 본문은 있는데 화면은 JS 가 돌 때까지 빈 검은 화면이고,
 * LCP 는 프리렌더 이전과 똑같이 번들 파싱이 끝나는 시점이 된다.
 *
 * 그래서 첫 화면(히어로)만 처음부터 보이게 둔다. 대신 이 문서에서는 히어로의 등장
 * 애니메이션이 사라진다 — LCP 와 맞바꾼 것이고, 접힘 아래의 스크롤 리빌([data-reveal])은
 * 그대로 살아 있다. 그쪽은 LCP 와 무관하고, 애초에 스크롤해야 보이는 연출이다.
 *
 * 명시도는 landing.css 의 `.beta-landing [data-hero]`(0,2,0)와 같고 이 블록이 뒤에 오므로
 * 이긴다. 그 뒤 JS 가 붙이는 `.is-in`(0,3,0)이 다시 이기지만 값이 같아 화면은 안 움직인다.
 * 감소 모션 블록의 !important 도 그대로 이긴다 — 그쪽이 더 강한 요구다.
 */
export const PRERENDER_STYLE = '.beta-landing [data-hero]{opacity:1;filter:none;transform:none}';

/**
 * JS 가 꺼진 브라우저용. 여기서는 접힘 아래까지 전부 보여야 한다 — 스크롤 리빌을 켜 줄
 * 주체가 없으므로 그냥 두면 히어로 말고는 아무것도 안 보인다.
 *
 * <noscript> 안에 두는 이유: JS 가 켜진 방문자에게는 적용되면 안 된다. 적용되면 스크롤
 * 리빌이 죽고, 이 페이지의 연출은 그 하나로 이루어져 있다.
 */
export const PRERENDER_NOSCRIPT_STYLE =
  '.beta-landing [data-reveal],.beta-landing .hero-stage-in{opacity:1!important;filter:none!important;transform:none!important}';

/**
 * 태그를 걷어낸 뒤 남는 본문의 단어 수.
 *
 * 감사(findings/content.md)가 세는 방식과 같은 자리를 재려는 것이다 — "JS 없이 읽히는
 * 한국어가 몇 단어냐". 한국어에는 형태소 단위 토큰화가 따로 있지만 여기서 필요한 것은
 * 그것이 아니라 공백으로 끊은 어절 수다(감사의 목표치 ~1,500 단어가 그 기준이다).
 *
 * 두 가지를 다르게 다룬다.
 *  - script·style·noscript 안쪽은 통째로 버린다. 사람이 읽는 본문이 아니다.
 *  - HTML 주석은 **공백이 아니라 빈 문자열로** 지운다. renderToString 은 붙어 있는 텍스트
 *    노드 사이에 `<!-- -->` 를 끼워 넣는데(이어받기용 경계 표식), 그것을 공백으로 바꾸면
 *    화면에서 한 단어인 "50개사"가 "50 개사" 두 단어로 세어져 수치가 부풀려진다.
 */
export function countVisibleWords(html: string): number {
  const text = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, ' ');
  return text.split(/\s+/).filter(Boolean).length;
}

/** 속성값·텍스트로 나가는 문자열을 HTML 안전하게. 메타 문구에 &·"·< 가 들어올 여지를 막는다. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 정확히 한 번 일치하는 치환. 0번이거나 2번 이상이면 던진다.
 *
 * @param label 실패 메시지에 쓸 이름. 빌드 로그에서 "무엇이 안 맞았는지"가 바로 보여야 한다.
 */
function replaceExactlyOnce(html: string, pattern: RegExp, replacement: string, label: string): string {
  const matches = html.match(pattern);
  const count = matches?.length ?? 0;
  if (count !== 1) {
    throw new Error(
      `[prerender:/beta] 셸(index.html)에서 ${label} 을(를) 정확히 한 번 찾지 못했습니다(찾은 수: ${count}). ` +
        'index.html 의 head 모양이 바뀌었다면 src/features/beta/prerenderDocument.ts 의 패턴을 함께 고쳐야 합니다.',
    );
  }
  // 치환 문자열의 $ 가 특수 해석되지 않도록 함수 형태로 넘긴다(메타 문구에 $ 가 들어올 수 있다).
  return html.replace(pattern, () => replacement);
}

/** `<meta name="..." content="...">` / `<meta property="...">` 한 줄을 찾는 패턴. */
function metaPattern(attribute: 'name' | 'property', key: string): RegExp {
  return new RegExp(`<meta\\s+${attribute}="${key}"\\s+content="[^"]*"\\s*/?>`, 'g');
}

function metaTag(attribute: 'name' | 'property', key: string, content: string): string {
  return `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`;
}

export interface BetaDocumentInput {
  /** 방금 빌드된 dist/index.html 원문. */
  shell: string;
  /** renderToString 이 만든 #root 안쪽 마크업. */
  body: string;
  /** <head> 끝에 덧붙일 조각들(랜딩 CSS 링크·modulepreload 등). 이미 완성된 태그 문자열. */
  headExtras?: string[];
}

/**
 * 셸 + 본문 → /beta 문서.
 *
 * 순수 문자열 함수다(파일도 빌드도 모른다). 그래야 테스트가 저장소의 index.html 을 읽어
 * 그대로 통과시켜 볼 수 있다 — dist 를 만들지 않고도 <head> 배선을 잠글 수 있다.
 */
export function buildBetaDocument({ shell, body, headExtras = [] }: BetaDocumentInput): string {
  let html = shell;

  html = replaceExactlyOnce(
    html,
    /<title>[\s\S]*?<\/title>/g,
    `<title>${escapeHtml(BETA_META.title)}</title>`,
    '<title>',
  );

  html = replaceExactlyOnce(
    html,
    metaPattern('name', 'description'),
    metaTag('name', 'description', BETA_META.description),
    'meta[name=description]',
  );

  /*
   * canonical 은 끝에 슬래시가 없는 `…/beta` 다. sitemap.xml(ACTION-PLAN 1.3)과
   * routePaths.ts 의 ROUTES.beta 가 모두 슬래시 없는 형태이고, 대표 주소가 한 글자라도
   * 다르면 두 주소로 갈라진다. 산출 파일 이름을 dist/beta/index.html 이 아니라
   * dist/beta.html 로 고른 이유도 이것이다 — 디렉터리로 내면 서버가 `/beta/` 를 서빙하게
   * 되어 여기 적은 주소와 실제 주소가 어긋난다(docs/beta-prerender.md 참고).
   */
  html = replaceExactlyOnce(
    html,
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/g,
    `<link rel="canonical" href="${BETA_URL}" />`,
    'link[rel=canonical]',
  );

  html = replaceExactlyOnce(
    html,
    /<link\s+rel="alternate"\s+hreflang="ko-KR"\s+href="[^"]*"\s*\/?>/g,
    `<link rel="alternate" hreflang="ko-KR" href="${BETA_URL}" />`,
    'link[rel=alternate][hreflang=ko-KR]',
  );

  html = replaceExactlyOnce(
    html,
    metaPattern('property', 'og:title'),
    metaTag('property', 'og:title', BETA_META.title),
    'meta[property=og:title]',
  );
  html = replaceExactlyOnce(
    html,
    metaPattern('property', 'og:description'),
    metaTag('property', 'og:description', BETA_META.description),
    'meta[property=og:description]',
  );
  html = replaceExactlyOnce(
    html,
    metaPattern('property', 'og:url'),
    metaTag('property', 'og:url', BETA_URL),
    'meta[property=og:url]',
  );

  html = replaceExactlyOnce(
    html,
    metaPattern('name', 'twitter:title'),
    metaTag('name', 'twitter:title', BETA_META.title),
    'meta[name=twitter:title]',
  );
  html = replaceExactlyOnce(
    html,
    metaPattern('name', 'twitter:description'),
    metaTag('name', 'twitter:description', BETA_META.description),
    'meta[name=twitter:description]',
  );

  const head = [
    ...headExtras,
    `<style>${PRERENDER_STYLE}</style>`,
    `<noscript><style>${PRERENDER_NOSCRIPT_STYLE}</style></noscript>`,
  ].join('\n    ');
  html = replaceExactlyOnce(html, /<\/head>/g, `    ${head}\n  </head>`, '</head>');

  /*
   * 본문. 셸의 빈 #root 를 통째로 갈아 끼운다. 표식(data-prerender)이 여기서 붙고,
   * main.tsx 가 그것을 보고 hydrate 로 분기한다.
   */
  html = replaceExactlyOnce(
    html,
    /<div id="root"><\/div>/g,
    `<div id="root" ${PRERENDER_MARKER}="${PRERENDER_MARKER_VALUE}">${body}</div>`,
    'div#root',
  );

  return html;
}
