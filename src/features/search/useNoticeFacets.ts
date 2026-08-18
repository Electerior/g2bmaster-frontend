/*
 * 필터 줄에 붙일 건수를 모은다.
 *
 * `/api/search/notices/facets` 는 목록과 같은 WHERE 로 센다 — 그것이 계약이고, 그래야
 * "12건이라 써 놓고 3건을 보여주는" 일이 없다. 다만 그 계약을 그대로 한 번만 부르면
 * **자기 축**이 무너진다: 단계를 '입찰'로 좁히는 순간 `GROUP BY category` 가 '입찰' 한 줄만
 * 돌려주므로 계획·사전규격·마감 칩이 전부 0건으로 흐려진다. 지역 드롭다운은 더 나빠서,
 * 고른 지역을 포함하는 버킷만 남아 다른 지역으로 바로 옮겨 갈 수단이 사라진다.
 *
 * 그래서 축마다 **자기 필터만 뺀** 질의를 하나씩 더 보낸다. 다른 축의 조건은 남기므로
 * "지금 걸린 나머지 조건 안에서 이 축을 바꾸면 몇 건인가"라는, 칩이 원래 답해야 하는
 * 질문에 맞는 수가 된다. 추가 요청은 그 축에 필터가 실제로 걸렸을 때만 나간다.
 * 상태 축은 예외다. 기본 목록에서 취소를 제외하더라도 '취소' 뱃지의 진입 건수는 보여야 하므로
 * 상태 필터가 없어도 상태 축 질의를 한 번 더 보낸다.
 *
 * 단계 축에는 서버 쪽 짝이 있다: '마감 전만' + 단계 미지정이면 백엔드가 목록을 입찰 문서로
 * 좁히므로(`BidNoticeQueryBuilder.activeOnly`), 단계를 뺀 이 질의에는 그 스코프가 붙어
 * 계획·사전규격 칩이 0건으로 그려졌었다. 지금은 백엔드가 단계 패싯에서만 스코프를 빼 준다
 * (`withoutActiveStageScope`). 그 대신 '전체' 칩은 버킷 합이 아니라 `total` 을 쓴다 —
 * {@link stageTotalOf}.
 */
import { useMemo } from 'react';
import { useNoticeIndexFacets, type NoticeFacets } from '@/api/search';
import {
  buildNoticeFacetQuery,
  type FacetAxis,
  type SearchCriteria,
} from './useSearchCriteria';

/** 축 → 그 축을 좁히고 있는 조건 값. 빈 문자열이면 안 좁힌 것이다. */
const AXIS_VALUE: Record<FacetAxis, (criteria: SearchCriteria) => string> = {
  category: (criteria) => criteria.category,
  // 조건 쪽 이름만 bidType 이다 — 질의로 나갈 때 division 이 된다.
  division: (criteria) => criteria.bidType,
  state: (criteria) => criteria.noticeState,
  region: (criteria) => criteria.region,
};

function useAxisFacets(criteria: SearchCriteria, axis: FacetAxis): NoticeFacets | undefined {
  const active = axis === 'state' || AXIS_VALUE[axis](criteria) !== '';
  const query = useMemo(() => buildNoticeFacetQuery(criteria, axis), [criteria, axis]);
  return useNoticeIndexFacets(query, { enabled: active }).data;
}

/**
 * 네 축의 건수. 필터가 안 걸린 축은 목록과 같은 조건의 기본 응답에서 가져온다.
 * 상태 축은 취소 진입 건수를 위해 항상 별도 조회하고, 나머지는 좁힌 축의 수만큼만 늘어난다.
 */
export function useNoticeFacetBars(criteria: SearchCriteria): NoticeFacets {
  const baseQuery = useMemo(() => buildNoticeFacetQuery(criteria), [criteria]);
  const base = useNoticeIndexFacets(baseQuery).data;

  const category = useAxisFacets(criteria, 'category');
  const division = useAxisFacets(criteria, 'division');
  const state = useAxisFacets(criteria, 'state');
  const region = useAxisFacets(criteria, 'region');

  return useMemo(
    () => ({
      // 축별 응답이 아직 안 왔으면 기본 응답으로 버틴다 — 잠깐 좁은 수가 보일 뿐,
      // 칸이 통째로 비어 0건으로 그려지는 것보다는 낫다.
      category: category?.category ?? base?.category,
      division: division?.division ?? base?.division,
      state: state?.state ?? base?.state,
      region: region?.region ?? base?.region,
      // '전체' 칩용 총계는 단계 축을 뺀 응답에서 온다 — 단계를 고른 뒤에도 "단계로는 안 좁혔을
      // 때 몇 건인가"를 답해야 하기 때문이다. 단계를 안 골랐으면 기본 응답이 곧 그 질의다.
      total: category?.total ?? base?.total,
    }),
    [base, category, division, state, region],
  );
}

/**
 * 단계 '전체' 칩에 붙일 수.
 *
 * 서버가 준 `total`(그 응답의 조건 그대로의 총건수)이 정답이다. **버킷의 합이 아니다** —
 * '마감 전만' + 단계 미지정이면 서버가 목록을 입찰 문서로 좁히는데, 단계 버킷은 그 스코프를
 * 뺀 수라서(그래야 칩마다 '누르면 나오는 수'가 된다) 합이 실제 '전체'보다 커진다.
 *
 * 합으로 떨어지는 것은 `total` 이 없는 옛 백엔드용 보루다. 목록의 `totalCount` 를 그냥 쓰면
 * 단계를 고른 순간 '전체'가 그 단계의 건수로 줄어, 같은 줄에서 '입찰 4,000 / 전체 4,000'
 * 처럼 색인에 입찰밖에 없는 것처럼 읽힌다.
 */
export function stageTotalOf(facets: NoticeFacets, fallback: number): number {
  if (typeof facets.total === 'number') return facets.total;
  const buckets = facets.category;
  if (!buckets || buckets.length === 0) return fallback;
  return buckets.reduce((sum, bucket) => sum + Number(bucket?.count ?? 0), 0);
}
