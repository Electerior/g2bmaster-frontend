/*
 * 통합 검색 조건 ↔ URL.
 *
 * 이 화면도 앱의 나머지와 같은 규약을 따른다 — **조건은 URL 이 갖는다.** 그래야 검색 결과를
 * 그대로 붙여넣어 공유할 수 있고, 브라우저 뒤로/앞으로가 그대로 동작한다.
 *
 * `features/search/useSearchCriteria` 와 합치지 않은 이유: 그쪽은 팬아웃 검색 전용 파라미터
 * (simOr·fileKeywords·excludeBlockingClauses·corpNm…)를 들고 있고, 이 화면에는 그중 어느
 * 것도 뜻이 없다. 한 훅에 두 화면의 조건을 섞으면 서로의 파라미터가 URL 에 유령처럼 남는다.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { NoticeIndexQuery } from '@/api/searchNotices';

export interface IndexCriteria {
  q: string;
  category: string;
  division: string;
  region: string;
  state: string;
  insttNm: string;
  detailProductCode: string;
  fromDate: string;
  toDate: string;
  activeOnly: boolean;
  minAmount: string;
  maxAmount: string;
  sort: string;
  dir: 'asc' | 'desc' | '';
  page: number;
  perPage: number;
}

const DEFAULT_PER_PAGE = 20;

function read(params: URLSearchParams): IndexCriteria {
  const category = params.get('category') ?? '';
  return {
    q: params.get('q') ?? '',
    category,
    division: params.get('division') ?? '',
    region: params.get('region') ?? '',
    state: params.get('state') ?? '',
    insttNm: params.get('insttNm') ?? '',
    detailProductCode: params.get('prdct') ?? '',
    fromDate: params.get('from') ?? '',
    toDate: params.get('to') ?? '',
    // URL 에 없으면 켜 둔다. 이 화면의 기본 용도는 "지금 참여할 수 있는 공고 찾기"라
    // 마감된 것까지 섞여 나오면 첫 화면이 쓸모없어진다. 끄면 'activeOnly=0' 이 남는다.
    // 단, '마감' 단계는 정의상 마감일이 전부 과거라 activeOnly 와 양립할 수 없다 —
    // 켠 채로 두면 어떤 URL 로 들어와도 항상 0건이므로, 이 단계에서는 무조건 끈다.
    activeOnly: category === '마감' ? false : params.get('activeOnly') !== '0',
    minAmount: params.get('minAmount') ?? '',
    maxAmount: params.get('maxAmount') ?? '',
    sort: params.get('sort') ?? '',
    dir: (params.get('dir') as 'asc' | 'desc' | null) ?? '',
    page: Number(params.get('page') ?? '1') || 1,
    perPage: Number(params.get('perPage') ?? String(DEFAULT_PER_PAGE)) || DEFAULT_PER_PAGE,
  };
}

export function useIndexCriteria() {
  const [params, setParams] = useSearchParams();
  const criteria = useMemo(() => read(params), [params]);

  /**
   * 조건 갱신.
   *
   * 페이지를 함께 지정하지 않은 변경은 **1페이지로 되돌린다.** 3페이지를 보다가 지역을 바꾸면
   * 새 조건의 3페이지가 비어 있는 일이 흔한데, 사용자에게는 '검색이 0건'으로 보인다.
   */
  const setCriteria = useCallback(
    (patch: Partial<IndexCriteria>, options?: { replace?: boolean }) => {
      const next = { ...read(params), ...patch };
      if (patch.page === undefined) next.page = 1;

      const out = new URLSearchParams();
      const put = (key: string, value: string) => {
        if (value) out.set(key, value);
      };
      put('q', next.q.trim());
      put('category', next.category);
      put('division', next.division);
      put('region', next.region);
      put('state', next.state);
      put('insttNm', next.insttNm.trim());
      put('prdct', next.detailProductCode.trim());
      put('from', next.fromDate);
      put('to', next.toDate);
      put('minAmount', next.minAmount);
      put('maxAmount', next.maxAmount);
      put('sort', next.sort);
      put('dir', next.dir);
      // 기본값은 URL 에 쓰지 않는다 — 주소가 짧아야 공유가 편하다.
      // '마감'에서는 어떤 값이든 read 가 끈 것으로 읽으므로 파라미터 자체를 남기지 않는다.
      if (!next.activeOnly && next.category !== '마감') out.set('activeOnly', '0');
      if (next.page > 1) out.set('page', String(next.page));
      if (next.perPage !== DEFAULT_PER_PAGE) out.set('perPage', String(next.perPage));

      setParams(out, { replace: options?.replace ?? false });
    },
    [params, setParams],
  );

  /** 서버로 보낼 모양. 빈 값은 `toSearchParams` 가 알아서 떨어뜨린다. */
  const query = useMemo<NoticeIndexQuery>(
    () => ({
      q: criteria.q || undefined,
      category: criteria.category || undefined,
      division: criteria.division || undefined,
      region: criteria.region || undefined,
      state: criteria.state || undefined,
      insttNm: criteria.insttNm || undefined,
      detailProductCode: criteria.detailProductCode || undefined,
      fromDate: criteria.fromDate || undefined,
      toDate: criteria.toDate || undefined,
      activeOnly: criteria.activeOnly,
      minAmount: criteria.minAmount ? Number(criteria.minAmount) : undefined,
      maxAmount: criteria.maxAmount ? Number(criteria.maxAmount) : undefined,
      sort: criteria.sort || undefined,
      dir: criteria.dir || undefined,
      page: criteria.page,
      perPage: criteria.perPage,
    }),
    [criteria],
  );

  return { criteria, setCriteria, query };
}
