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
   * 3) 진행 중 여부는 **심지 않는다.**
   *
   * 옛 화면들은 "파라미터 없음 = 진행 중만"이었지만, 그 의미를 그대로 옮기면 안 된다.
   * 백엔드는 `activeOnly` 를 단계 필터처럼 쓴다(BidNoticeQueryBuilder.build):
   * 단계를 지정하지 않으면 `category IN ('입찰','마감')` 을 걸고 거기에 마감일 조건을
   * 덧붙이므로, 켜는 순간 계획·사전규격·마감이 한꺼번에 사라져 남는 것은 입찰뿐이다.
   * 패싯도 목록과 같은 조건으로 세므로 단계 칩이 전부 0건이 된다 —
   * DEFAULT_CRITERIA.activeOnly 를 꺼짐으로 둔 이유가 바로 이것이다.
   *
   * 그리고 보존할 '켜짐' 신호가 애초에 없다. 옛 주소는 끌 때만 값을 남겼다
   * (`/search` 는 `activeOnly=0`, 옛 표 주소는 `active=false`). 둘 다 지금의 기본값과
   * 같은 뜻이므로, 지금 쓰지 않는 `activeOnly` 만 떨어뜨리면 된다.
   *
   * (병합 메모: 이 브랜치에는 '마감 단계가 아니면 active=true 를 심는' 판이 있었다.
   *  upstream 의 fix 3d62921 이 더 나중이고 근거가 백엔드 쪽에 있어 그쪽을 택했다.)
   */
  params.delete('activeOnly');

  const search = params.toString();
  return <Navigate to={{ pathname: ROUTES.noticeSearch, search }} replace />;
}
