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
