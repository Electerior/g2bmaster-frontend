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
 * title · description · canonical · og:title/description/url · og:image 계열 · twitter:*.
 * (hreflang 은 갈아 끼우는 게 아니라 지운다 — 아래 해당 자리의 주석 참고.)
 *
 * ── og:image 는 왜 물려받다가 갈아 끼우게 됐나 ─────────────────────────────
 * 한동안 일부러 셸에서 물려받았다. /beta 전용 카드가 아직 없었고(ACTION-PLAN 3.4), 값을
 * 여기 박아 두면 그쪽이 카드를 만드는 날 이 파일만 옛 값으로 남기 때문이다. 이제 카드가
 * 생겼으므로 갈아 끼운다 — 다만 **값을 여기 적지는 않는다.** ROUTE_META[ROUTES.beta].image
 * 를 resolveOgImage() 로 푼 결과를 쓴다.
 *
 * 이 배선이 없으면 카드는 사실상 없는 것과 같다. 카드를 세우는 훅은 브라우저에서만 돌고,
 * 카카오톡·페이스북 스크래퍼는 JS 를 실행하지 않은 이 문서의 정적 head 만 읽는다. 그리고
 * /beta 는 이 사이트에서 사람이 실제로 남에게 붙여 넣는 유일한 주소다.
 *
 * ── 못 찾으면 빌드를 깬다 ──────────────────────────────────────────────────
 * 아래 조작은 셸에 그 태그가 **몇 개 있어야 하는지**를 전부 선언한다. 치환은 "정확히 한 번"
 * (replaceExactlyOnce), 삽입은 "정확히 0번"(insertBeforeHeadEnd)이다. 셸의 <head> 모양이
 * 바뀌어 그 수가 어긋나면 조용히 옛 메타를 단 문서가 나가는 대신 빌드가 멈춘다. 조용히
 * 틀린 메타가 나가는 것은 배포 뒤 색인에서만 드러나고, 그때는 이미 크롤러가 그것을 읽은
 * 뒤다. 유일한 예외가 hreflang 이고, 왜 예외인지는 그 자리에 적어 두었다.
 */

/*
 * ── 값의 출처는 이 파일이 아니다 ───────────────────────────────────────────
 *
 * 여기에는 한때 자기만의 SITE_ORIGIN 과 BETA_META 가 있었다. 라우트별 메타를 만드는 브랜치
 * (ACTION-PLAN 2.1)와 이 프리렌더가 형제로 자랐고, 같은 경로에 서로 다른 파일을 먼저 만들면
 * 머지가 아니라 충돌이 되기 때문이었다. 그래서 그쪽이 정한 문자열을 글자 그대로 베껴 두고
 * "머지하는 사람이 지운다"를 주석으로 남겼다. 지금이 그 자리다.
 *
 * 베낀 두 벌이 한 번도 갈라지지 않은 채 여기까지 온 것은 운이었지 구조가 아니다. 이 감사가
 * 잡아낸 결함은 전부 같은 모양이었다 — 같은 사실이 두 곳에 적혀 있고, 어느 날 한쪽만
 * 고쳐진다. 그러니 title·description·오리진·카드를 전부 src/seo/ 에서 읽는다.
 *
 * ⚠ 이 파일은 **react 를 부르지 않는다.** 빌드 스크립트가 node 에서 그대로 불러 쓰는
 *   자리라(scripts/prerender-beta.mjs), 훅을 끌어오는 순간 순수 문자열 함수가 아니게 된다.
 *   그래서 가져오는 것은 훅(useSeoMeta)이 아니라 그 훅이 쓰는 **순수 데이터와 순수 함수**다.
 *   ROUTE_META 는 표이고 resolveOgImage 는 카드 하나를 태그에 넣을 값들로 푸는 함수이며,
 *   둘 다 react 를 모른다. routeMeta.ts 가 resolveOgImage 를 훅 밖 순수 함수로 둔 이유가
 *   정확히 이것이다. routePaths·siteOrigin 도 마찬가지로 상수와 문자열 함수뿐이다.
 */
import { ROUTES } from '@/routes/routePaths';
import { ROUTE_META, resolveOgImage } from '@/seo/routeMeta';
import { canonicalUrlFor, SITE_ORIGIN } from '@/seo/siteOrigin';

export { SITE_ORIGIN };

/** /beta 의 라우트별 메타. 앱 화면들이 읽는 표와 **같은 항목**이다. */
export const BETA_META = ROUTE_META[ROUTES.beta];

/** 프리렌더가 그리는 주소. prerender.tsx 가 StaticRouter 의 location 으로도 쓴다. */
export const BETA_PATH: string = ROUTES.beta;

/** canonical·og:url 에 들어가는 절대 주소. 끝에 슬래시를 붙이지 않는다 — 아래 주석 참고. */
export const BETA_URL = canonicalUrlFor(ROUTES.beta);

/**
 * /beta 전용 공유 카드. **없을 수도 있고, 없는 것이 오류가 아니다.**
 *
 * 표에서 image 를 생략하는 것은 "index.html 의 범용 카드로 되돌아간다"는 뜻이고
 * (routeMeta.ts 의 RouteMeta.image), 훅도 정확히 그렇게 동작한다. 프리렌더만 "카드가 없으면
 * 빌드를 깬다"로 굴면 같은 표를 읽는 두 경로가 다른 규칙을 따르게 된다. 그래서 아래
 * buildBetaDocument 는 카드가 있을 때만 여섯 태그를 손대고, 없으면 셸의 값을 그대로 물려받는다.
 */
const BETA_CARD = ROUTE_META[ROUTES.beta].image;

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

/**
 * 셸에 **없는** 태그를 `</head>` 앞에 새로 넣는다.
 *
 * 왜 replaceExactlyOnce 로 안 되는가: 그 함수의 규약은 "정확히 한 번 일치"이고, 0번이면
 * 던진다. twitter:image · twitter:image:alt 는 index.html 에 애초에 없다 — X 는 twitter:image
 * 가 없으면 og:image 로 물러나므로 정적 셸에 둘 이유가 없었다. 그러니 이 태그들에 대해
 * "찾아서 바꾼다"는 조작 자체가 성립하지 않는다.
 *
 * 그렇다고 조건 없이 붙이면 안 된다. 셸이 나중에 twitter:image 를 갖게 되는 날 같은 태그가
 * 두 줄 있는 문서가 나가고, 크롤러가 어느 쪽을 고르는지는 규격에 없다 — 채널마다 다른 그림이
 * 나가고 화면에는 아무 증상이 없다. 그래서 방향만 뒤집어 같은 엄격함을 유지한다:
 * **정확히 0번 일치할 때만 넣고, 이미 있으면 던진다.** 그때 할 일은 여기서 replaceExactlyOnce
 * 로 갈아타는 것이고, 던지는 메시지가 그 말을 한다.
 */
function insertBeforeHeadEnd(html: string, tags: string[], patterns: RegExp[], label: string): string {
  for (const [index, pattern] of patterns.entries()) {
    const count = html.match(pattern)?.length ?? 0;
    if (count !== 0) {
      throw new Error(
        `[prerender:/beta] ${label} 은(는) 셸(index.html)에 없다는 전제로 새로 넣는 태그인데 ` +
          `이미 ${count}개 있습니다(${index + 1}번째 패턴). 셸이 이 태그를 갖게 됐다면 ` +
          'src/features/beta/prerenderDocument.ts 에서 삽입 대신 replaceExactlyOnce 로 바꿔야 합니다.',
      );
    }
  }
  return replaceExactlyOnce(html, /<\/head>/g, `    ${tags.join('\n    ')}\n  </head>`, '</head>');
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

  /*
   * hreflang 은 **갈아 끼우지 않고 지운다.**
   *
   * 이 사이트는 단일 로케일이다 — i18n 의존성도, /en/ 라우트도, 로케일 전환기도 없다.
   * hreflang 은 대안 언어판 *사이*를 구분하려고 존재하므로 대안이 없으면 완벽히 적어도
   * 신호가 0 이고, 감사가 그래서 "고치지 말고 지우라"고 결론지었다
   * (findings/hreflang.md). fix/seo-hreflang-drop 이 셸에서 그 줄을 지웠다.
   *
   * 그런데 그 브랜치와 이 브랜치는 형제라 머지 순서가 정해져 있지 않다. 셸에 태그가
   * 아직 있는 상태로 이 단계가 돌 수도 있다. 그래서 "있으면 지우고, 없으면 그냥 둔다"로
   * 쓴다 — 양쪽 순서 모두에서 결과가 같아진다(= /beta 에 hreflang 이 없다).
   *
   * replaceExactlyOnce 를 쓰지 않는 유일한 자리인 이유가 이것이다. 나머지 치환은 0번
   * 일치하면 셸이 예상과 다르다는 뜻이라 빌드를 깨는 게 맞지만, 여기서는 0번이 곧
   * "이미 옳은 상태"다.
   */
  html = html.replace(/[ \t]*<link\s+rel="alternate"\s+hreflang="[^"]*"\s+href="[^"]*"\s*\/?>\n?/g, '');

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

  /*
   * ── 공유 카드 (ACTION-PLAN 3.4) ────────────────────────────────────────────
   *
   * 여섯이다. 훅(useSeoMeta)이 브라우저에서 세우는 것과 **같은 여섯**이어야 한다 — 넷만
   * 다루면 나머지 둘이 셸의 값으로 남고, 정적 문서를 읽는 스크래퍼와 JS 를 돌리는 브라우저가
   * 서로 다른 카드를 보게 된다. 그 어긋남은 화면에 아무 증상이 없고 남의 대화방에서만 드러난다.
   *
   * 넷은 셸에 이미 있어 **치환**이고 둘은 없어서 **삽입**이다. 왜 방식이 다른지는
   * insertBeforeHeadEnd 주석에 적어 두었다.
   *
   *   og:image        치환   ← 셸: 범용 카드(/og-image.png)
   *   og:image:width  치환   ← 셸: 1200
   *   og:image:height 치환   ← 셸: 630
   *   og:image:alt    치환   ← 셸: 범용 카드의 alt
   *   twitter:image     삽입 ← 셸에 없음(X 는 없으면 og:image 로 물러난다)
   *   twitter:image:alt 삽입 ← 위와 같음
   *
   * width·height 도 굳이 치환하는 이유: 셸의 1200×630 이 이 카드의 크기와 **우연히** 같다.
   * 지금은 맞지만 카드를 다른 비율로 다시 그리는 날 이 둘만 옛 숫자로 남고, 그러면
   * 페이스북·카카오톡이 첫 스크랩에서 카드를 잘못 잘라 놓고 그 결과를 캐시한다. 우연히
   * 맞는 값과 출처가 같아서 맞는 값은 다른 것이고, 공유 카드는 틀려도 되돌릴 방법이 없다.
   *
   * 값은 전부 resolveOgImage() 에서 온다. 여기서 문자열을 다시 적으면 카드 주소가 세 곳
   * (표 · 훅 · 이 파일)에 살게 되고, 그것이 이 감사가 잡아낸 결함의 모양 그대로다.
   */
  if (BETA_CARD) {
    const card = resolveOgImage(BETA_CARD);

    html = replaceExactlyOnce(
      html,
      metaPattern('property', 'og:image'),
      metaTag('property', 'og:image', card.url),
      'meta[property=og:image]',
    );
    html = replaceExactlyOnce(
      html,
      metaPattern('property', 'og:image:width'),
      metaTag('property', 'og:image:width', card.width),
      'meta[property=og:image:width]',
    );
    html = replaceExactlyOnce(
      html,
      metaPattern('property', 'og:image:height'),
      metaTag('property', 'og:image:height', card.height),
      'meta[property=og:image:height]',
    );
    html = replaceExactlyOnce(
      html,
      metaPattern('property', 'og:image:alt'),
      metaTag('property', 'og:image:alt', card.alt),
      'meta[property=og:image:alt]',
    );

    html = insertBeforeHeadEnd(
      html,
      [metaTag('name', 'twitter:image', card.url), metaTag('name', 'twitter:image:alt', card.alt)],
      [metaPattern('name', 'twitter:image'), metaPattern('name', 'twitter:image:alt')],
      'meta[name=twitter:image] · meta[name=twitter:image:alt]',
    );
  }

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
