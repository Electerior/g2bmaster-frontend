/*
 * 옛 주소(`/search`, `/notices/bid-plan` 등) → 통합 검색.
 *
 * 그냥 404 로 두면 공유된 링크와 즐겨찾기가 동작하지 않는다. 단계는 필터로 옮겨 붙이고
 * 나머지 조건(키워드·기간·페이지)은 그대로 들고 간다 — 사용자가 만든 조건이지
 * 화면의 소유물이 아니기 때문이다.
 *
 * 다만 옛 `/search` 는 지금 화면과 **파라미터 이름이 다르다.** 그 화면은 삭제된
 * `features/searchIndex/useIndexCriteria` 를 썼고, 지금 화면은 `features/search/
 * useSearchCriteria` 를 쓴다. 이름을 그대로 넘기면 조건이 붙지 않은 채 착지하는데,
 * 화면에는 오류도 경고도 뜨지 않아 "검색이 동작하지 않는다"로 보인다. 그래서 변환을
 * 여기서 한 번만 한다 — 목적지 화면은 어휘를 하나만 알면 되고, 옛 링크가 사라지면
 * 이 파일만 지우면 된다.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { ROUTES } from './routePaths';

interface LegacyNoticeRedirectProps {
  /** 붙일 단계 필터. 입찰 공고처럼 단계를 좁히면 안 되는 경우엔 주지 않는다. */
  category?: string;
}

/**
 * 옛 통합 검색(`/search`)이 쓰던 질의 파라미터 → 지금 쓰는 이름.
 *
 * 여기 없는 것(`region`·`state`·`prdct`·`from`·`to`·`sort`·`dir`·`page`·`perPage`)은
 * 양쪽 이름과 의미가 같아 변환이 필요 없다. `q` 는 계약 §A-2 에서 "공백 구분, 모두 포함"
 * 이므로 `and`(andTerms)와 같은 뜻이다.
 */
const LEGACY_PARAM_ALIASES: ReadonlyArray<readonly [from: string, to: string]> = [
  ['q', 'and'],
  ['category', 'cat'],
  ['division', 'type'],
  ['insttNm', 'instt'],
  ['minAmount', 'min'],
  ['maxAmount', 'max'],
];

export function LegacyNoticeRedirect({ category }: LegacyNoticeRedirectProps) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  // 1) 이름 변환. 지금 이름이 이미 있으면 그것이 우선이다 — 사용자가 새 화면에서 만든 조건이다.
  for (const [from, to] of LEGACY_PARAM_ALIASES) {
    const value = params.get(from);
    params.delete(from);
    if (value && !params.get(to)) params.set(to, value);
  }

  // 2) 단계. 이미 걸려 있으면 사용자가 고른 것이 우선이다.
  if (category && !params.get('cat')) params.set('cat', category);

  /*
   * 3) 진행 중 여부.
   *
   * 옛 주소는 두 화면 모두 "파라미터 없음 = 진행 중만"이었다(`/search` 는 `activeOnly=0`,
   * 옛 표 주소는 `active=false` 로 꺼야 했다). 지금은 "없음 = 마감 포함"이라, 심어 주지
   * 않으면 같은 링크가 예전보다 넓은 결과를 낸다.
   *
   * 단 '마감' 단계에서는 심지 않는다 — 마감일이 전부 과거라 켜면 항상 0건이 된다.
   * 삭제된 useIndexCriteria 도 같은 이유로 이 조합을 강제로 껐다.
   */
  const turnedOff = params.get('activeOnly') === '0' || params.get('active') === 'false';
  params.delete('activeOnly');
  if (turnedOff || params.get('cat') === '마감') params.delete('active');
  else params.set('active', 'true');

  const search = params.toString();
  return <Navigate to={{ pathname: ROUTES.noticeSearch, search }} replace />;
}
