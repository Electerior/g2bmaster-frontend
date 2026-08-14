/*
 * 옛 공고 표 주소(`/notices/bid-plan` 등) → 통합 검색.
 *
 * 그냥 404 로 두면 공유된 링크와 즐겨찾기가 조용히 죽는다. 단계만 필터로 옮겨 붙이고
 * 나머지 조건(키워드·기간·페이지)은 **그대로 들고 간다** — 사용자가 만든 조건이지
 * 화면의 소유물이 아니기 때문이다.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { ROUTES } from './routePaths';

interface LegacyNoticeRedirectProps {
  /** 붙일 단계 필터. 입찰 공고처럼 단계를 좁히면 안 되는 경우엔 주지 않는다. */
  category?: string;
}

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

  // 지금 이름이 이미 있으면 사용자가 새 화면에서 고른 값을 우선한다.
  for (const [from, to] of LEGACY_PARAM_ALIASES) {
    const value = params.get(from);
    params.delete(from);
    if (value && !params.get(to)) params.set(to, value);
  }

  // 이미 단계가 걸려 있으면 사용자가 고른 것이 우선이다.
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
   */
  params.delete('activeOnly');

  const search = params.toString();
  return <Navigate to={{ pathname: ROUTES.noticeSearch, search }} replace />;
}
