/*
 * 라우트 경로 → head 메타 표.
 *
 * 15개 라우트가 index.html 의 정적 head 하나를 공유하고 있었다. 제목만 아홉 화면이
 * document.title 로 각자 덮었고, description · canonical · og:* · twitter:* 는 주소가
 * 무엇이든 절대 바뀌지 않았다 — 감사(findings/onpage.md)가 On-Page 를 28/100 으로 매긴
 * 첫 번째 이유다. 검색엔진 입장에서 이 사이트는 서로 다른 내용을 가진 15개 문서가 아니라
 * 같은 설명을 단 한 문서였다.
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
 * (붙임표는 em dash). 표에 열다섯 번 적는 대신 함수로 두어 형식이 갈라지지 않게 한다.
 */
function brand(page: string): string {
  return `${page} — ${BRAND}`;
}

/**
 * 라우트별 메타.
 *
 * description 은 ACTION-PLAN 2.1 이 여섯 개(/notices · /notices/bid-result · /spec-search ·
 * /price-db · /trends/product · /beta)의 초안을 주었다. 그중 **넷은 글자 그대로** 옮겼고
 * 둘(/spec-search · /price-db)은 버렸다 — 초안이 그 화면이 하는 일을 잘못 알고 있었기
 * 때문이고, 근거는 각 항목 위에 적어 두었다. 감사자는 화면 안을 열어 본 것이 아니라 라우트
 * 이름과 라벨을 보고 썼으므로 이름과 내용이 어긋난 두 곳에서 어긋났다.
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
  [ROUTES.dealRadar]: {
    title: brand('AI 수주 데스크 · 공고별 딜 분석'),
    description:
      '검색된 공고마다 딜 분석을 붙여 봅니다. 예산과 시가를 견줘 남는 장사인지 가늠하고, 규격서 부품 단가까지 대조해 투찰 여부를 판단합니다.',
  },
  [ROUTES.saved]: {
    title: brand('저장 공고'),
    description:
      '저장해 둔 공고를 다시 찾습니다. 공고명·기관·메모는 물론 함께 저장한 가격표의 품목명으로도 검색되며, 나라장터를 다시 조회하지 않습니다.',
    // 사용자별 화면 — 방문자마다 내용이 다르고 로그인 없이는 빈 목록이다(ACTION-PLAN 2.1).
    robots: NOINDEX,
  },
  [ROUTES.specSearch]: {
    /*
     * ⚠ ACTION-PLAN 2.1 의 초안을 쓰지 않았다. 초안은 이 화면을 "사전규격 공개 문서를
     * 검색합니다"로 적었는데 **이 화면은 사전규격 화면이 아니다.** 감사자가 라우트 이름
     * (spec-search)만 보고 넘겨짚은 것으로 보인다. 코드가 말하는 것은 다르다:
     *
     *  - SCREENS['spec-search'] 의 label 은 '하드웨어 스펙 검색', endpoint 는
     *    `/api/search/titles` 다(domain/columns.ts).
     *  - SpecSearchScreen 이 남긴 TODO 도 "CPU·GPU 제목 의미 검색(Module A) + 규격서 본문
     *    LLM 스펙 추출(Module B)" 이다.
     *  - 이 앱에서 사전규격은 별도 화면이 아니라 통합 검색 안의 **단계 필터**다. 옛
     *    `/notices/pre-spec` 이 `category: '사전규격'` 을 달고 `/notices` 로 넘어간다
     *    (routePaths.ts LEGACY_NOTICE_ROUTES). 사전규격의 정본 주소는 `/notices` 다.
     *
     * 초안을 그대로 달았다면 /spec-search 와 /notices 가 검색 결과에서 같은 의도를 두고
     * 서로 경쟁했을 것이고, 클릭해서 들어온 사람은 사전규격 목록이 아닌 '준비 중' 화면을
     * 만났을 것이다.
     *
     * 화면 속은 아직 ScreenPlaceholder('준비 중')다 — 그래서 마지막 문장으로 그 사실을
     * 적는다. 없는 기능을 설명하지 않는다.
     */
    title: brand('하드웨어 스펙 검색'),
    description:
      '공고 제목에서 CPU·GPU 같은 하드웨어 사양을 찾아내고, 규격서 본문의 스펙을 뽑아 비교하는 검색 화면입니다. 현재 준비 중입니다.',
  },
  [ROUTES.priceDb]: {
    /*
     * ⚠ 여기도 ACTION-PLAN 2.1 의 초안을 쓰지 않았다. 초안은 "공공조달 단가 데이터베이스.
     * 품목별 **낙찰 단가** 추이를 확인하고 투찰가를 산정하세요"인데, 이 화면이 다루는 것은
     * 낙찰 단가가 아니라 **시장 시세**다.
     *
     * api/price.ts 첫 문단이 못을 박아 둔다: 이 계열은 나라장터를 아예 부르지 않고,
     * 백엔드가 다나와·아이티마야·에누리에서 긁어 적재해 둔 시세(price_catalog)를 조회·수정하고
     * AI 로 새로 적재한다. 출처 어휘(danawa/itmaya/enuri)도 공고 검색의 출처(나라장터·국방)와
     * 다른 집합이다. 낙찰 단가는 오히려 /notices/bid-result 쪽 이야기다.
     *
     * 초안대로 적었다면 '낙찰 단가 조회'를 기대하고 들어온 사람이 부품 시세표를 만난다 —
     * 검색 결과에서 약속한 것과 페이지가 주는 것이 다르면 그 자체로 순위에 불리하다.
     */
    title: brand('물품 시세 단가 DB'),
    description:
      '다나와·아이티마야·에누리에서 모은 물품 시세 카탈로그입니다. 분류·품명·모델로 단가를 찾고, 값이 달라지면 직접 고치거나 AI로 새로 적재합니다.',
  },
  [ROUTES.trendProduct]: {
    title: brand('물품 발주 동향 분석'),
    description: '물품 발주 동향 분석. 품목별·기관별 발주 규모와 시기를 데이터로 확인합니다.',
  },
  [ROUTES.trendService]: {
    title: brand('용역 발주 동향 분석'),
    description:
      '용역 발주 동향 분석. AI·데이터·유지보수 등 용역 공고의 일자별 규모와 발주기관·키워드·계약방법 순위를 확인합니다.',
  },
  [ROUTES.trendConstruction]: {
    title: brand('공사 발주 동향 분석'),
    description:
      '공사 발주 동향 분석. 건축·토목·전기·소방 등 공사 공고의 일자별 규모와 발주기관·키워드·계약방법 순위를 확인합니다.',
  },
  [ROUTES.company]: {
    title: brand('낙찰자 조회'),
    description:
      '업체명으로 공공조달 낙찰 이력을 조회합니다. 낙찰 건수·금액과 낙찰률 추이, 참여했으나 떨어진 건까지 함께 봅니다.',
    /*
     * 색인 제외. ACTION-PLAN 1.3 이 sitemap 에서 빼면서 "internal/user-specific,
     * should be noindex" 로 /saved · /system · /analysis-lab 과 함께 열거한 다섯 중 하나다
     * (2.1 의 noindex 목록에는 빠져 있어 두 절이 어긋난다 — 1.3 을 따랐다).
     *
     * 내용으로 봐도 색인 대상이 아니다. 이 화면은 사용자가 친 업체명 하나에 대한 조회
     * 결과이고, 검색어 없이 열면 빈 화면이다. 색인될 수 있는 문서가 아니라 조회 도구다.
     */
    robots: NOINDEX,
  },
  [ROUTES.officers]: {
    title: brand('발주기관 담당자 조회'),
    description:
      '발주기관의 공고 담당자와 연락처를 조회합니다. 그 담당자가 낸 공고를 함께 묶어 보여 주어 어디로 연락할지 바로 정할 수 있습니다.',
    /*
     * 색인 제외. /company 와 같은 근거(ACTION-PLAN 1.3)에 더해 **개인정보 성격**이 있다.
     * 여기 실리는 것은 공무원 담당자의 이름 · 부서 · 직통 전화 · 이메일이다. 공개된 공고에서
     * 온 값이라 해도, 검색엔진 색인에 올라 이름으로 검색되는 순간 성격이 달라진다 —
     * 공고를 보러 온 사람에게 보이는 것과 이름을 아는 누구에게나 보이는 것은 다르다.
     * 이 화면은 서비스 안에서 쓰는 조회 도구지 공개 문서가 아니다.
     */
    robots: NOINDEX,
  },
  [ROUTES.analysisLab]: {
    title: brand('규격서 업로드 분석'),
    description:
      '규격서와 확약서를 올려 본문에서 필요한 항목을 뽑고 위법 소지를 검토하는 업로드 분석 화면입니다. 현재 준비 중입니다.',
    // 올린 파일 하나를 보는 화면이라 공개 색인 대상이 아니다(ACTION-PLAN 2.1).
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
