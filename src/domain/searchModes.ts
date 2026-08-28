/*
 * 검색 카테고리(키워드 · 품목 · 발주기관)별 화면 구성.
 * 원본 public/search-modes.js 를 그대로 옮겼다 — 함수명(searchModeLayout)을 유지해야
 * 기존 node 테스트가 그대로 산다.
 *
 * 순수 함수로 분리한 이유(원본 주석 그대로): 모드 전환은 "감추기"와 "되살리기"가 짝이어야
 * 하는데, 토글이 setSearchMode 안에 흩어져 있으면 한쪽만 고쳐져 다른 모드로 돌아갔을 때
 * 화면이 안 돌아온다.
 */

export const SEARCH_MODES = [
  'keyword',
  'item',
  'instt',
] as const;

export type SearchMode = (typeof SEARCH_MODES)[number];

export interface SearchModeLayout {
  mode: SearchMode;
  keywordRows: boolean;
  insttRow: boolean;
}

function isSearchMode(mode: string): mode is SearchMode {
  return (SEARCH_MODES as readonly string[]).includes(mode);
}

/**
 * mode -> 어떤 검색 입력 영역을 보일지.
 */
export function searchModeLayout(mode: string): SearchModeLayout {
  const resolved: SearchMode = isSearchMode(mode) ? mode : 'keyword';
  return {
    mode: resolved,
    keywordRows: resolved === 'keyword' || resolved === 'item',
    insttRow: resolved === 'instt',
  };
}
