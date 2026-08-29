/*
 * 라우트 표. 운영 중인 공고 조회·저장 화면과 독립 화면만 URL 로 관리한다.
 */
import type { ScreenKind } from '@/domain/columns';
import { SCREENS } from '@/domain/columns';

export const ROUTES = {
  /**
   * 공고 통합 검색. 예전 표 셋(bidPlan · preSpec · bidAnnounce)이 여기로 합쳐졌다 —
   * 단계는 탭이 아니라 필터이므로 주소도 하나다. 옛 주소는 router 가 단계 필터를 붙여
   * 이리로 넘긴다(공유된 링크가 죽지 않도록).
   */
  noticeSearch: '/notices',
  bidResult: '/notices/bid-result',
  saved: '/saved',
  system: '/system',
  /**
   * 베타 모집 랜딩. 탭도 검색도 없는 독립 페이지라 TAB_ITEMS 에 넣지 않는다.
   * 앱 셸 밖에서 렌더링된다 — router.tsx 참고.
   */
  beta: '/beta',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/** '/' 로 들어오면 여기로 보낸다. 실사용 진입점은 언제나 공고 검색이다. */
export const DEFAULT_ROUTE: RoutePath = ROUTES.noticeSearch;

/**
 * 옛 주소 → 통합 검색.
 *
 * 공유되거나 즐겨찾기에 등록된 링크가 404 가 되지 않게 한다.
 *
 * - `/search` 는 통합 검색 자신의 옛 주소이면서 이 앱의 옛 DEFAULT_ROUTE 였다.
 *   `/` 로 진입한 모든 요청이 여기로 리다이렉트됐으므로 축적된 링크가 가장 많다.
 *   전 단계를 대상으로 하던 화면이므로 단계를 걸지 않는다.
 * - 입찰 공고에도 단계를 걸지 않는다. '입찰'로 고정하면 '마감'으로 분류된 같은 공고가
 *   결과에서 제외되어 예전 탭보다 좁은 결과가 반환된다.
 */
export const LEGACY_NOTICE_ROUTES: ReadonlyArray<{ path: string; category?: string }> = [
  { path: '/search' },
  { path: '/notices/bid-plan', category: '계획' },
  { path: '/notices/pre-spec', category: '사전규격' },
  { path: '/notices/bid-announce' },
];

/**
 * 머무르지 않고 곧바로 다른 주소로 넘기는 경유지.
 *
 * 셸(App)은 이 경로에서도 렌더되므로 검색창의 효과가 한 번 돈다. 경유지에서 조건을 심으면
 * 곧이어 일어나는 리다이렉트가 그것을 지우는데, 심었다는 사실(플래그)은 남아 목적지에서
 * 다시 심지 않는다 — 기본 조회 기간이 통째로 사라진다. 그래서 경유지 목록이 필요하다.
 */
const TRANSIT_ROUTES: readonly string[] = ['/', ...LEGACY_NOTICE_ROUTES.map((r) => r.path)];

export function isTransitRoute(pathname: string): boolean {
  return TRANSIT_ROUTES.includes(pathname);
}

export interface TabItem {
  path: RoutePath;
  label: string;
  kind: ScreenKind;
  /*
   * 아이콘 필드는 두지 않는다. 폭과 상관없이 화면 이름을 글자 그대로 쓴다 —
   * layout.css @media(max-width:760px) 참고.
   */
}

/**
 * 폴더 탭 스트립. 공고 조회와 저장 목록만 노출한다.
 * 라벨은 SCREENS 에서 가져온다 — 탭 이름과 화면 제목이 갈라지면 안 된다.
 */
export const TAB_ITEMS: readonly TabItem[] = [
  { path: ROUTES.noticeSearch, kind: 'notice-search', label: SCREENS['notice-search'].label },
  { path: ROUTES.bidResult, kind: 'bid-result', label: SCREENS['bid-result'].label },
  { path: ROUTES.saved, kind: 'saved-notices', label: SCREENS['saved-notices'].label },
];

/**
 * 탭 스트립을 감출 라우트.
 * - /system: 원본에서 아예 별도 페이지(system.html)였다.
 */
const TABLESS_ROUTES: readonly string[] = [ROUTES.system];

export function showsTabs(pathname: string): boolean {
  return !TABLESS_ROUTES.includes(pathname);
}

/*
 * ─── 탭을 옮길 때 조건을 얼마나 들고 갈 것인가 ────────────────────────────────
 *
 * 원본은 탭이 곧 화면 상태였으므로 탭을 누를 때마다 `state.pageNo=1` ·
 * `state.crossBidNtceNo=''` · `defaultSortForTab()` 을 손으로 되돌렸다(app.js:519-522).
 * 우리는 조건을 URL 에 두므로 그 리셋이 저절로 따라오지 않는다 — AppTabs 가
 * `location.search` 를 한 글자도 안 거르고 목적지에 붙이면 앞 화면의 좌표가 그대로 샌다.
 *
 * 이 표를 routePaths.ts 에 두는 이유는 탭 계약(TAB_ITEMS · TRANSIT_ROUTES)과 같은 파일이어야
 * 다음에 파라미터가 늘어날 때 함께 눈에 띄기 때문이다. 검색 조건의 정의는
 * useSearchCriteria.ts 의 PARAM 에 있지만, "탭을 넘을 때 무엇이 살아남는가"는 조건의 문제가
 * 아니라 탭의 문제다.
 */

/**
 * 어느 화면으로 가든 버리는 것 — 앞 화면의 좌표이지 사용자가 고른 조건이 아니다.
 *
 * - `page` : 목적지의 총 페이지 수는 다르다. 범위를 벗어나면 서버는 totalCount 는 크게
 *   주면서 items 는 빈 배열을 주는데, 그러면 상태바만 "총 779건 | 3/1 페이지"라고 말하고
 *   표는 비며 페이지 버튼까지 사라져(행이 0이면 안 그렸다) 되돌아갈 길이 없었다.
 * - `sort`/`dir` : 화면마다 정렬 가능한 키가 다르다. 색인 검색 전용 키(created 등)가
 *   입찰 결과로 넘어가면 백엔드 comparator 가 전 행에서 null 을 만나 **정렬이 통째로 무효**가
 *   된다 — 개찰일시 내림차순이 조용히 사라지고 어느 머리글에도 정렬 표시가 켜지지 않는다.
 * - `ntceNo` : 크로스탭이 심는 공고번호다. 사용자가 친 조건이 아니라 **한 번의 이동을 위한
 *   좌표**다. 탭을 누르는 것은 "이 화면 전체를 보겠다"는 뜻인데 번호가 따라오면 buildQuery 가
 *   키워드를 전부 비우고 그 한 건에 화면을 묶어 버린다. (`/api/bid-result` 가 공고번호를
 *   바인딩하지 않는다던 예전 근거는 더 이상 사실이 아니다 — 백엔드가 `bidNtceNo` 단건조회를
 *   열었고, 크로스탭은 그 경로를 실제로 쓴다. 버리는 이유만 바뀌었을 뿐 결론은 같다.)
 *
 * `perPage` 는 일부러 남긴다 — '한 화면에 몇 줄'은 앞 화면의 좌표가 아니라 사용자 취향이다.
 * 선택지에 없는 값이 넘어와 셀렉트 표시와 실제가 어긋나는 문제는 화면 쪽에서 snapPerPage 로
 * 닫는다.
 */
export const SCREEN_SCOPED_PARAMS: readonly string[] = ['sort', 'dir', 'page', 'ntceNo'];

/**
 * 공고 통합 검색(로컬 색인)에만 뜻이 있는 조건. 입찰 결과로 갈 때만 버린다.
 *
 * 낙찰정보는 색인이 아니라 팬아웃 API 라 이 축들이 아예 없다. 남겨 두면 주소는 "서울 · 계획
 * 단계"라고 말하는데 결과는 그 조건과 무관하게 나온다 — 조건이 무시된다는 사실이 화면
 * 어디에도 안 보이는 것이 가장 나쁘다.
 */
export const INDEX_ONLY_PARAMS: readonly string[] = [
  'cat',
  'state',
  'region',
  'closeFrom',
  'closeTo',
  'min',
  'max',
  'prdct',
  'spec',
];

/**
 * 탭 링크가 목적지에 붙일 쿼리스트링.
 *
 * 사용자가 친 것(and/or/not · from/to · instt · mode · type)은 전부 살아남는다.
 * 버리는 것은 앞 화면의 좌표뿐이다.
 */
export function searchForTab(search: string, kind: ScreenKind): string {
  const params = new URLSearchParams(search);
  for (const key of SCREEN_SCOPED_PARAMS) params.delete(key);
  if (kind === 'bid-result') {
    for (const key of INDEX_ONLY_PARAMS) params.delete(key);
  }
  const next = params.toString();
  return next ? `?${next}` : '';
}
