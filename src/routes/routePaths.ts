/*
 * 라우트 표. 원본은 탭(state.tab, 10개)과 검색 모드(state.searchMode, 6개)라는 직교하는
 * 두 선택자로 화면이 결정됐고, corp/officer/upload 모드는 탭과 무관하게 결과 영역을
 * 가로챘다. React 에서는 그 조합을 전부 URL 로 편다 — 화면 하나 = 주소 하나.
 */
import type { ScreenKind } from '@/domain/columns';
import { SCREENS } from '@/domain/columns';

export const ROUTES = {
  bidPlan: '/notices/bid-plan',
  preSpec: '/notices/pre-spec',
  bidAnnounce: '/notices/bid-announce',
  bidResult: '/notices/bid-result',
  dealRadar: '/deal-radar',
  saved: '/saved',
  specSearch: '/spec-search',
  trendProduct: '/trends/product',
  trendService: '/trends/service',
  trendConstruction: '/trends/construction',
  company: '/company',
  officers: '/officers',
  analysisLab: '/analysis-lab',
  system: '/system',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/** '/' 로 들어오면 여기로 보낸다. 원본의 첫 화면은 발주 계획이었으나 실사용 진입점은 입찰 공고다. */
export const DEFAULT_ROUTE: RoutePath = ROUTES.bidAnnounce;

export interface TabItem {
  path: RoutePath;
  label: string;
  kind: ScreenKind;
}

/**
 * 폴더 탭 스트립에 나오는 10개. 순서는 원본 index.html(281~290행) 그대로.
 * 라벨은 SCREENS 에서 가져온다 — 탭 이름과 화면 제목이 갈라지면 안 된다.
 */
export const TAB_ITEMS: readonly TabItem[] = [
  { path: ROUTES.bidPlan, kind: 'bid-plan', label: SCREENS['bid-plan'].label },
  { path: ROUTES.preSpec, kind: 'pre-spec', label: SCREENS['pre-spec'].label },
  { path: ROUTES.bidAnnounce, kind: 'bid-announce', label: SCREENS['bid-announce'].label },
  { path: ROUTES.bidResult, kind: 'bid-result', label: SCREENS['bid-result'].label },
  { path: ROUTES.dealRadar, kind: 'deal-radar', label: SCREENS['deal-radar'].label },
  { path: ROUTES.saved, kind: 'saved-notices', label: SCREENS['saved-notices'].label },
  { path: ROUTES.specSearch, kind: 'spec-search', label: SCREENS['spec-search'].label },
  { path: ROUTES.trendProduct, kind: 'product-trend', label: SCREENS['product-trend'].label },
  { path: ROUTES.trendService, kind: 'service-trend', label: SCREENS['service-trend'].label },
  {
    path: ROUTES.trendConstruction,
    kind: 'construction-trend',
    label: SCREENS['construction-trend'].label,
  },
];

/**
 * 탭 스트립을 감출 라우트.
 * - /analysis-lab : 올린 파일 하나를 보는 화면이라 공고 검색 도구가 남아 있으면 오해를 부른다
 *   (원본 searchModeLayout('upload').searchUi === false 와 같은 이유).
 * - /system       : 원본에서 아예 별도 페이지(system.html)였다.
 * 낙찰자/담당자 조회(/company, /officers)는 원본에서도 탭을 유지했으므로 그대로 둔다.
 */
const TABLESS_ROUTES: readonly string[] = [ROUTES.analysisLab, ROUTES.system];

export function showsTabs(pathname: string): boolean {
  return !TABLESS_ROUTES.includes(pathname);
}
