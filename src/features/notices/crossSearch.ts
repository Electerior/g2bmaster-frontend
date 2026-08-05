/*
 * 다른 화면으로 질의를 넘기기 — 원본 crossTabSearch(app.js:4888).
 *
 * 원본은 전역 state 를 직접 갈아 끼우고 탭 버튼의 active 클래스를 손으로 옮긴 뒤 search() 를
 * 불렀다. 화면 상태가 URL 로 올라간 뒤에는 "주소를 만들어 이동한다" 한 줄이면 끝난다 —
 * 게다가 그 주소를 복사해 남에게 줄 수 있게 된다.
 */
import type { CrossSeed, CrossTarget } from '@/components/table/Cell';
import { ROUTES } from '@/routes/routePaths';

const TARGET_ROUTE: Readonly<Record<CrossTarget, string>> = {
  'bid-announce': ROUTES.bidAnnounce,
  'bid-result': ROUTES.bidResult,
};

export interface CrossDestination {
  pathname: string;
  search: string;
}

/**
 * 넘어갈 주소. 원본과 같은 규칙으로 조건을 리셋한다:
 * 키워드는 seed 로 갈아 끼우고 OR/NOT/발주기관은 비운다(다른 탭의 조건을 끌고 가면
 * 결과가 0건이 되는데, 사용자는 왜 비었는지 알 수 없다).
 * 기간은 남긴다 — 방금 고른 범위 안에서 보고 싶은 것이 보통이다.
 */
export function crossSearchTo(
  target: CrossTarget,
  seed: CrossSeed,
  currentSearch: string,
): CrossDestination {
  const current = new URLSearchParams(currentSearch);
  const next = new URLSearchParams();

  for (const key of ['from', 'to', 'perPage'] as const) {
    const value = current.get(key);
    if (value) next.set(key, value);
  }
  if (seed.andTerms?.length) next.set('and', seed.andTerms.join(','));
  if (seed.bidNtceNo) next.set('ntceNo', seed.bidNtceNo);
  if (seed.bidType && ['물품', '용역', '공사'].includes(seed.bidType)) {
    next.set('type', seed.bidType);
  }

  return { pathname: TARGET_ROUTE[target], search: next.toString() };
}
