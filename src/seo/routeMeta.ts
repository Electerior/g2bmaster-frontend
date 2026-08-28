/*
 * 라우트 경로 → head 메타 표.
 *
 * 감사 당시 15개 라우트가 index.html 의 정적 head 하나를 공유하고 있었다. 제목만 아홉
 * 화면이 document.title 로 각자 덮었고, description · canonical · og:* · twitter:* 는 주소가
 * 무엇이든 절대 바뀌지 않았다 — 감사(findings/onpage.md)가 On-Page 를 28/100 으로 매긴
 * 첫 번째 이유다. 검색엔진 입장에서 이 사이트는 서로 다른 내용을 가진 15개 문서가 아니라
 * 같은 설명을 단 한 문서였다.
 *
 * 그 뒤 main 의 '공고 중심 UI 단순화'(PR #23)가 화면 아홉을 걷어내 지금 ROUTES 는 다섯이다.
 * 표의 항목 수는 그래서 열다섯이 아니라 다섯이지만, 이 파일이 있는 이유는 그대로다 —
 * 문제는 라우트가 몇 개냐가 아니라 주소마다 다른 것이 다르게 나가느냐였다.
 *
 * 표를 `Record<RoutePath, RouteMeta>` 로 못 박는 것이 이 파일의 절반이다. routePaths.ts 에
 * 라우트를 새로 추가하고 여기 메타를 빠뜨리면 **컴파일이 깨진다.** 메타가 빠졌다는 사실은
 * 화면에서 보이지 않고 배포 뒤 색인에서만 드러나므로, 사람이 기억해야 하는 규칙으로 두면
 * 언젠가 반드시 새 라우트가 범용 메타를 달고 나간다.
 */
import { isTransitRoute, ROUTES, type RoutePath } from '@/routes/routePaths';
import { assetUrlFor } from './siteOrigin';

/**
 * 라우트 전용 공유 카드.
 *
 * 크기를 함께 들고 다니는 이유: og:image:width · og:image:height 가 실제 픽셀과 다르면
 * 페이스북·카카오톡이 첫 스크랩에서 카드를 잘못 잘라 놓고 그 결과를 캐시한다. 그래서
 * 여기 적은 숫자와 PNG 헤더가 같은지를 ogImage.test.ts 가 파일을 열어 확인한다 —
 * "선언과 실물이 갈라진다"가 이 감사가 잡아낸 결함의 공통 형태였다.
 */
export interface OgImage {
  /** public/ 기준 경로. 절대 URL 은 resolveOgImage() 가 SITE_ORIGIN 을 붙여 만든다. */
  path: string;
  width: number;
  height: number;
  /** og:image:alt · twitter:image:alt. 카드에 그려진 글자를 그대로 읽어 준다. */
  alt: string;
}

/** og:image 계열 태그에 그대로 들어갈 값. 절대 URL 은 여기서 한 번만 만든다. */
export interface ResolvedOgImage {
  url: string;
  width: string;
  height: string;
  alt: string;
}

/**
 * 카드 하나를 태그에 넣을 수 있는 값들로.
 *
 * react 를 부르지 않는 순수 함수로 두었다. 훅(useSeoMeta)이 이것을 쓰고, /beta 프리렌더가
 * 머지되면 그쪽 buildBetaDocument 도 같은 함수를 써야 한다 — 프리렌더가 자기 문자열을 따로
 * 만드는 순간 카드 주소가 두 곳에 적히고, 한쪽만 고쳐지는 날이 온다.
 */
export function resolveOgImage(image: OgImage): ResolvedOgImage {
  return {
    url: assetUrlFor(image.path),
    width: String(image.width),
    height: String(image.height),
    alt: image.alt,
  };
}

export interface RouteMeta {
  /** <title> · og:title · twitter:title 에 그대로 들어간다. */
  title: string;
  /** meta[name=description] · og:description · twitter:description. */
  description: string;
  /**
   * 색인 제외용. **생략이 정상이다** — 생략하면 index.html 의 정적 robots 값
   * (`index,follow,max-snippet:-1,…`)으로 되돌아간다. useSeoMeta.ts 참고.
   */
  robots?: string;
  /**
   * 기본은 자기 경로. 옛 주소처럼 "대표 주소가 남인" 경우에만 채운다.
   * `null` 은 "이 화면에는 canonical 자체를 두지 않는다"는 뜻이다(404 전용).
   */
  canonicalPath?: string | null;
  /**
   * 라우트 전용 공유 카드. **생략이 정상이다** — 생략하면 index.html 의 정적 카드
   * (/og-image.png, 범용 제품 카드)로 되돌아간다. useSeoMeta.ts 의 applyOgImage 참고.
   *
   * 라우트 수만큼 카드를 만들지 않는다. 이유는 아래 [ROUTES.beta] 에 적었다.
   */
  image?: OgImage;
}

/**
 * /beta 전용 공유 카드.
 *
 * 그림은 scripts/og-cards.py 가 그리고, 문구가 어느 코드에서 왔는지도 그 파일에 적혀 있다.
 * 여기서는 크기와 alt 만 선언한다.
 *
 * ⚠ **프리렌더(feat/beta-prerender · PR #24)와 만나면 할 일이 있다.**
 *
 * 이 훅은 브라우저에서만 돈다. /beta 는 그 브랜치에서 빌드 때 dist/beta.html 로 미리
 * 그려지고, 카카오톡·페이스북 크롤러는 JS 를 실행하지 않은 그 정적 head 를 읽는다 —
 * 즉 **프리렌더 산출물의 head 에 이 카드가 들어가지 않으면 이 브랜치는 /beta 에 대해
 * 아무 효과가 없다.** 정작 카드가 필요한 단 하나의 주소에서.
 *
 * 그쪽 src/features/beta/prerenderDocument.ts 는 지금 og:image 를 일부러 셸에서 물려받고
 * 있고("여기서 값을 다시 박으면 그쪽이 고쳐도 이 파일만 옛 값으로 남는다"), 그 주석이
 * 가리키는 "그쪽"이 이 파일이다. 머지한 사람이 할 일:
 *
 *   1. prerenderDocument.ts 의 BETA_META·SITE_ORIGIN 지역 상수를 지우고
 *      `ROUTE_META[ROUTES.beta]` 와 `@/seo/siteOrigin` 을 쓴다(그 파일 29~43행의 이관 계획).
 *   2. buildBetaDocument 에 치환을 넷 더한다. 값은 반드시 이 파일의
 *      `resolveOgImage(ROUTE_META[ROUTES.beta].image!)` 에서 가져온다 — 문자열을 다시
 *      적으면 카드 주소가 두 곳에 살게 된다.
 *        meta[property=og:image]        → resolved.url
 *        meta[property=og:image:alt]    → resolved.alt
 *        meta[name=twitter:image]       → resolved.url   (셸에 없으므로 새로 넣어야 한다.
 *                                          replaceExactlyOnce 가 아니라 </head> 앞 삽입)
 *        meta[name=twitter:image:alt]   → resolved.alt   (위와 같음)
 *      og:image:width·height 는 셸의 값이 이미 1200×630 이라 그대로 두어도 맞지만, 카드
 *      크기가 바뀔 여지를 남기지 않으려면 함께 치환하는 편이 낫다.
 *   3. betaPrerender.test.ts 에 "dist/beta.html 의 og:image 가 /og/beta.png 의 절대 URL"을
 *      한 줄 더한다. 이 배선은 화면에 아무 증상도 남기지 않으므로 테스트가 유일한 감시자다.
 */
const BETA_CARD: OgImage = {
  path: '/og/beta.png',
  width: 1200,
  height: 630,
  alt:
    'G2B Masters 베타 테스터 모집 카드 — ' +
    '연 200조 입찰 시장, 공고를 찾는 데 더 이상 아침을 쓰지 마세요. 낙찰 시까지 수수료 0원.',
};

/**
 * 색인 제외 값.
 *
 * `noindex,nofollow` 가 아니라 `noindex,follow` 다. 색인에서 빼고 싶은 것이지 크롤러를
 * 여기서 되돌려 보내고 싶은 것이 아니다 — 이 화면들에도 앱의 다른 화면으로 가는 링크가
 * 있고, follow 를 남겨야 그 링크가 발견된다.
 */
const NOINDEX = 'noindex,follow';

const BRAND = 'G2B Masters';

/**
 * 제목의 브랜드 꼬리표. 기존 아홉 화면이 쓰던 `${화면} — G2B Masters` 형식을 그대로 잇는다
 * (붙임표는 em dash). 표에 라우트마다 적는 대신 함수로 두어 형식이 갈라지지 않게 한다.
 */
function brand(page: string): string {
  return `${page} — ${BRAND}`;
}

/**
 * 라우트별 메타.
 *
 * description 은 ACTION-PLAN 2.1 이 여섯 개(/notices · /notices/bid-result · /spec-search ·
 * /price-db · /trends/product · /beta)의 초안을 주었다. 그중 지금도 남아 있는 셋(/notices ·
 * /notices/bid-result · /beta)은 **글자 그대로** 옮겼다. 초안을 버린 둘(/spec-search ·
 * /price-db)은 화면 자체가 PR #23 에서 사라져 표에서도 함께 내려갔다 — 초안이 그 화면이
 * 하는 일을 잘못 알고 있었다는 판단의 기록은 24b5bc2 의 커밋 메시지에 남아 있다.
 *
 * 나머지는 각 화면 소스와 SCREENS 의 label 을 대조해 새로 썼다. 원칙은 하나다 —
 * **화면이 실제로 하는 일만 적는다.** description 은 검색 결과에서 클릭 여부를 정하는
 * 한 줄이라, 없는 기능을 적으면 그 클릭은 전부 되돌아 나가는 클릭이 된다.
 *
 * 제목은 화면 라벨보다 조금 길다. 탭 라벨('공고 검색')은 이미 그 화면에 와 있는 사람을 위한
 * 이름이고, <title> 은 검색 결과에서 아직 오지 않은 사람이 읽는 한 줄이라 무엇에 대한
 * 화면인지가 들어가야 한다. 화면 안의 제목(h2)은 라벨 그대로 두었다 — 둘은 독자가 다르다.
 */
export const ROUTE_META: Readonly<Record<RoutePath, RouteMeta>> = {
  [ROUTES.noticeSearch]: {
    title: brand('나라장터·국방전자조달 입찰공고 통합 검색'),
    description:
      '나라장터·국방전자조달 입찰공고를 발주계획·사전규격·입찰·마감 단계로 한 번에 검색합니다. 품목·지역·금액 필터 제공.',
  },
  [ROUTES.bidResult]: {
    title: brand('입찰결과·낙찰 정보 조회'),
    description:
      '나라장터 입찰결과와 낙찰 정보를 조회합니다. 낙찰가·경쟁률·참여업체를 한 화면에서 확인하세요.',
  },
  [ROUTES.saved]: {
    title: brand('저장 공고'),
    description:
      '저장해 둔 공고를 다시 찾습니다. 공고명·기관·메모는 물론 함께 저장한 가격표의 품목명으로도 검색되며, 나라장터를 다시 조회하지 않습니다.',
    // 사용자별 화면 — 방문자마다 내용이 다르고 로그인 없이는 빈 목록이다(ACTION-PLAN 2.1).
    robots: NOINDEX,
  },
  [ROUTES.system]: {
    title: brand('시스템 상태'),
    description:
      'DB 적재와 검색 엔진·LLM 상태, 예약 적재를 한 화면에서 확인하는 운영용 대시보드입니다. 현재 준비 중입니다.',
    // 운영자용 내부 화면(ACTION-PLAN 2.1).
    robots: NOINDEX,
  },
  [ROUTES.beta]: {
    /*
     * 이 사이트에서 유일하게 진짜 랜딩 페이지다 — 앱 셸 밖에 있고, 한글 카피가 1,500자쯤
     * 되며, 감사가 "유일한 랭킹 대상"으로 지목한 화면이다(ACTION-PLAN 2.2). 그런데 지금껏
     * 전용 제목이 없어 index.html 의 범용 제목을 그대로 달고 있었다.
     *
     * 제목은 Hero 의 실제 카피에서 뽑았다 — "나라장터 공고를 대신 훑고, 우리 회사에 맞는
     * 것만 골라, 첨부파일까지 요약" + "선착순 N개사 · 낙찰 시까지 수수료 0원".
     * 검색 의도로는 '나라장터 입찰공고 자동'과 '베타 테스터 모집'이 이 페이지의 두 축이다.
     */
    title: brand('나라장터 입찰공고 자동 탐색 베타 테스터 모집'),
    description:
      'G2B Masters 베타 테스터 모집. 나라장터 공고 탐색·선별·첨부파일 요약을 자동화합니다. 낙찰 시까지 수수료 0원.',
    /*
     * **표 전체에서 카드를 가진 유일한 라우트다**(ACTION-PLAN 3.4).
     *
     * 감사(findings/images.md)가 이 항목에 붙인 제목이 "one generic OG card for fifteen
     * routes"였지만, 본문이 실제로 요구한 것은 여러 장이 아니라 한 장이다 — "`/beta` is
     * the only page anyone will share, and it has no card of its own."
     *
     * 나머지 넷을 만들지 않은 이유는 라우트마다 다르다.
     *
     *  - /saved · /system — 위에서 noindex 다. 색인되지 않는 화면에 공유 카드를 만드는 것은
     *    아무도 도착하지 않는 주소에 간판을 다는 일이다. /system 은 그 위에 화면 속이 아직
     *    '준비 중'이기까지 하다 — 카드는 페이지가 주는 것을 약속하는 그림인데 약속할 것이 없다.
     *  - /notices — **범용 카드가 이미 이 화면의 카드다.** public/og-image.png 에 그려진
     *    글자가 '나라장터·국방전자조달 입찰정보 통합 검색'이고, 이 라우트의 title 이
     *    '나라장터·국방전자조달 입찰공고 통합 검색'이다. 따로 그리면 같은 말을 하는 카드가
     *    두 장이 되고, 랜딩 카피가 바뀌는 날 둘 중 하나만 고쳐진다.
     *  - /notices/bid-result — 검색 결과와 필터 상태를 보는 도구이고, 카카오톡으로 남에게
     *    붙여 넣는 대상이 아니다. 공유가 실제로 일어나는 자리에만 카드를 만든다.
     *
     * 라우트 수만큼 카드를 그려 두면 랜딩 문구가 바뀔 때마다 그만큼 다시 그려야 하고,
     * 그리지 않으면 나머지가 조용히 낡는다. 카드가 필요해지면 이 표에 image 한 줄을 더하고
     * scripts/og-cards.py 의 CARDS 에 함수를 하나 더한다. 배선은 이미 라우트별로 돌아간다.
     */
    image: BETA_CARD,
  },
};

/**
 * 404 화면의 메타.
 *
 * ACTION-PLAN 1.2 가 명시적으로 요구한다. 서버(nginx)가 알 수 없는 경로에 404 상태코드를
 * 내주기 전까지 — 그리고 그 뒤에도 React 까지 도달하는 경로에 대해 — 이것이 유일한 방어선이다.
 * 200 을 받은 크롤러에게 "이 주소는 문서가 아니다"라고 말할 수 있는 자리가 여기뿐이다.
 *
 * canonicalPath 가 `null` 인 이유: 존재하지 않는 주소를 자기 자신으로 canonical 하는 것은
 * 의미가 없고, 정적 head 에 남아 있는 canonical(사이트 루트)을 그대로 두면 오타 난 주소가
 * 전부 홈으로 합쳐졌다고 선언하게 된다. 둘 다 틀리므로 태그 자체를 지운다.
 */
export const NOT_FOUND_META: RouteMeta = {
  title: brand('페이지를 찾을 수 없습니다'),
  description: '요청하신 주소에 해당하는 화면이 없습니다.',
  robots: NOINDEX,
  canonicalPath: null,
};

/** '/notices/' 처럼 끝에 '/' 가 붙어 들어와도 같은 라우트로 본다. */
function normalize(pathname: string): string {
  const raw = pathname.split('?')[0].split('#')[0];
  return raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
}

/**
 * 경로 → 메타. 표에 없으면 `null`.
 *
 * 경유지(`/` 와 옛 주소 넷)는 통합 검색의 메타를 쓰되 canonical 만 `/notices` 로 고정한다.
 * 이 경로들은 머무르지 않고 곧바로 넘어가지만(LegacyNoticeRedirect), 크롤러가 JS 를 실행하기
 * 전에 head 를 읽는 경우가 있고 그때 자기 주소를 canonical 로 선언하면 `/search` 와
 * `/notices` 가 서로 다른 문서로 갈라진다. ACTION-PLAN 2.1 이 옛 네 경로에 대해 요구한
 * "canonical-to-/notices" 가 이것이다. 서버 301(2.4)이 붙으면 이 조항은 무의미해지지만,
 * 그때까지는 여기가 유일하게 그 말을 할 수 있는 자리다.
 */
export function metaForPath(pathname: string): RouteMeta | null {
  const path = normalize(pathname);
  const known = (ROUTE_META as Record<string, RouteMeta | undefined>)[path];
  if (known) return known;
  if (isTransitRoute(path)) {
    return { ...ROUTE_META[ROUTES.noticeSearch], canonicalPath: ROUTES.noticeSearch };
  }
  return null;
}
