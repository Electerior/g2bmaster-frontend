/*
 * 라우트 경로 → head 메타 표.
 *
 * 15개 라우트가 index.html 의 정적 head 하나를 공유하고 있었다. 제목만 아홉 화면이
 * document.title 로 각자 덮었고, description · canonical · og:* · twitter:* 는 주소가
 * 무엇이든 절대 바뀌지 않았다 — 감사(findings/onpage.md)가 On-Page 를 28/100 으로 매긴
 * 첫 번째 이유다. 검색엔진 입장에서 이 사이트는 서로 다른 내용을 가진 15개 문서가 아니라
 * 같은 설명을 단 한 문서였다.
 *
 * ⚠ **주소는 열다섯이 아니라 다섯이다.** 이 표가 열다섯 벌로 쓰인 뒤 main 이 화면을
 * 통합했다(PR #23) — 딜 레이더·스펙 검색·시세 DB·동향 셋·낙찰자·담당자·규격서 분석이
 * 지워지고, 남은 주소는 /notices · /notices/bid-result · /saved · /system · /beta 다
 * (routePaths.ts 의 ROUTES). 지워진 열 개의 메타도 함께 걷었다 — 없는 주소의 설명은
 * 갱신되지 않는 거짓말이 된다. 감사 문서(ACTION-PLAN·findings)의 "15 routes" 는 그
 * 통합 이전의 사실이다.
 *
 * 표를 `Record<RoutePath, RouteMeta>` 로 못 박는 것이 이 파일의 절반이다. routePaths.ts 에
 * 라우트를 새로 추가하고 여기 메타를 빠뜨리면 **컴파일이 깨진다.** 메타가 빠졌다는 사실은
 * 화면에서 보이지 않고 배포 뒤 색인에서만 드러나므로, 사람이 기억해야 하는 규칙으로 두면
 * 언젠가 반드시 새 라우트가 범용 메타를 달고 나간다.
 */
import { isTransitRoute, ROUTES, type RoutePath } from '@/routes/routePaths';

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
}

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
 * (붙임표는 em dash). 표에 라우트 수만큼 적는 대신 함수로 두어 형식이 갈라지지 않게 한다.
 */
function brand(page: string): string {
  return `${page} — ${BRAND}`;
}

/**
 * 라우트별 메타.
 *
 * description 은 ACTION-PLAN 2.1 이 여섯 개의 초안을 주었다. 지금 살아 있는 주소에
 * 해당하는 셋(/notices · /notices/bid-result · /beta)은 글자 그대로 옮겼다. 나머지 초안
 * 셋(/spec-search · /price-db · /trends/product)은 그 주소가 main 에서 사라져 쓸 자리가 없다.
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
      '저장해 둔 공고를 다시 찾습니다. 공고명·기관·메모로 좁혀 볼 수 있고, 나라장터를 다시 조회하지 않습니다.',
    // 사용자별 화면 — 방문자마다 내용이 다르고 로그인 없이는 빈 목록이다(ACTION-PLAN 2.1).
    robots: NOINDEX,
  },
  [ROUTES.system]: {
    title: brand('시스템 상태'),
    description:
      'DB 적재와 검색 엔진·LLM 상태, 예약 적재를 한 화면에서 확인하는 운영용 대시보드입니다.',
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
