/*
 * 공고 통합 검색 — 백엔드의 로컬 색인(bid_notice)만 조회하는 엔드포인트.
 *
 * 기존 `notices.ts` 와 무엇이 다른가: 그쪽은 요청마다 나라장터를 팬아웃해 D2B·누리장터까지
 * 훑는다(느리고, 출처별로 실패할 수 있고, 그래서 `sourceErrors` 가 응답에 있다).
 * 이쪽은 서버가 미리 쌓아 둔 색인을 인덱스 질의 한 번으로 읽는다 — 부분 실패라는 개념이
 * 없으므로 봉투에 출처 관련 필드가 없다.
 *
 * 계획·사전규격·입찰·마감이 **한 목록에 섞여** 온다는 것이 이 API 의 핵심이다.
 * 조달 생애주기를 한 화면에서 훑는 것이 목적이라, 단계는 필터이지 별도 탭이 아니다.
 */
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/apiClient';
import type { PageEnvelope } from './types';
import { toSearchParams, type QueryValue } from './types';

/* ─── 값 집합 ────────────────────────────────────────────────────────────── */

/** 공고 분류 — 조달 생애주기 단계. 서버 ERD 의 `category` 와 같은 문자열이다. */
export const CATEGORIES = ['계획', '사전규격', '입찰', '마감'] as const;
export type NoticeCategory = (typeof CATEGORIES)[number];

/** 업종코드. */
export const DIVISIONS = ['물품', '용역', '공사', '외자'] as const;
export type BusinessDivision = (typeof DIVISIONS)[number];

/** 공고 상태 — 넷 다 예외 상태이고, 평시에는 null 이다. */
export type NoticeState = '취소' | '재' | '다시' | '정정';

/* ─── 행 ─────────────────────────────────────────────────────────────────── */

export interface NoticeProduct {
  seq: string;
  code: string;
  name: string;
}

export interface NoticeAttachment {
  name: string;
  url: string;
}

/** 세부 가격 표. 값이 없는 칸은 아예 오지 않는다(0 이 아니라 부재다). */
export interface NoticePriceDetail {
  assignedBudget?: number;
  estimatedPrice?: number;
  unitPrice?: number;
  quantity?: number;
  unit?: string;
  vat?: number;
}

/**
 * 검색 결과 한 줄.
 *
 * 기관은 코드와 이름이 짝으로 온다. **공고기관과 수요기관이 다른 건이 흔하다** —
 * 조달청 대행 공고가 그렇다(공고기관 '조달청 강원지방조달청', 수요기관 '강원대학교').
 *
 * 사전규격은 기관 **코드가 null 이고 이름만 있다** — 원본 오퍼레이션이 코드를 주지 않는다.
 * 그래서 화면은 코드가 아니라 이름을 기준으로 그려야 한다.
 */
export interface NoticeIndexItem {
  id: string;
  noticeOrder: string;
  noticeName: string;
  category: NoticeCategory;
  state: NoticeState | null;
  businessDivision: BusinessDivision;
  /** 참가가능지역. 복수는 콤마 구분이고, **빈 문자열은 '전국'** 이다(제한 없음). */
  region: string;

  demandInstitutionCode: string | null;
  demandInstitutionName: string | null;
  noticeInstitutionCode: string | null;
  noticeInstitutionName: string | null;

  beforeSpecRgstNo: string | null;
  productList: NoticeProduct[] | null;
  detailProductCode: string | null;
  lowestBidRate: number | null;
  priceDetail: NoticePriceDetail | null;

  createdDate: string | null;
  closeDate: string | null;
  updatedAt: string | null;

  officerName: string | null;
  officerContact: string | null;

  aiSummary: string | null;
  attachmentUrls: NoticeAttachment[] | null;
  sourceUrl: string | null;

  /** 목록은 미리보기 300자, 상세는 `noticeBody` 전문. */
  bodyPreview: string | null;
  noticeBody?: string | null;

  /** 서버가 계산해 붙인다. 마감일시가 없으면(계획 단계) null. */
  dday: number | null;
  estimatedPrice: number | null;
  relevance?: number;
}

/* ─── 질의 ───────────────────────────────────────────────────────────────── */

export interface NoticeIndexQuery {
  q?: string;
  andTerms?: string;
  orTerms?: string;
  notTerms?: string;
  category?: string;
  state?: string;
  division?: string;
  region?: string;
  insttNm?: string;
  insttCd?: string;
  dmndInsttCd?: string;
  detailProductCode?: string;
  beforeSpecRgstNo?: string;
  officerName?: string;
  fromDate?: string;
  toDate?: string;
  closeFrom?: string;
  closeTo?: string;
  activeOnly?: boolean;
  minAmount?: number;
  maxAmount?: number;
  sort?: string;
  dir?: 'asc' | 'desc';
  page?: number;
  perPage?: number;
}

export interface FacetBucket {
  value: string;
  count: number;
}

export interface NoticeFacets {
  category: FacetBucket[];
  division: FacetBucket[];
  region: FacetBucket[];
  state: FacetBucket[];
}

/** 색인 현황 — "지금 보고 있는 것이 언제 것인가"를 화면에 표시하는 데 쓴다. */
export interface IndexStatus {
  sources: Array<{
    source: string;
    watermark: string | null;
    last_run_at: string | null;
    last_success_at: string | null;
    last_result: string | null;
    last_row_count: number | null;
    consecutive_failures: number;
  }>;
  summary: Array<{ category: string; count: number; last_indexed_at: string | null }>;
  knownSources: string[];
}

const BASE = '/api/search/notices';

function params(query: NoticeIndexQuery): URLSearchParams {
  // activeOnly 는 false 일 때 아예 빼야 한다 — toSearchParams 가 빈 값만 거르므로
  // false 를 그대로 넘기면 'activeOnly=false' 가 붙고, 서버는 문자열 비교라 무시하지만
  // URL 이 지저분해지고 캐시 키가 갈라진다.
  const raw: Record<string, QueryValue> = {
    ...query,
    activeOnly: query.activeOnly ? 'true' : undefined,
  };
  return toSearchParams(raw);
}

/* ─── 훅 ─────────────────────────────────────────────────────────────────── */

export function useNoticeIndexSearch(query: NoticeIndexQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['notice-index', 'search', query],
    queryFn: () => get<PageEnvelope<NoticeIndexItem>>(`${BASE}?${params(query)}`),
    // 색인은 서버가 주기적으로 갱신한다. 화면이 매 포커스마다 다시 물을 이유가 없다.
    staleTime: 60_000,
    placeholderData: (previous) => previous,
    enabled: options?.enabled ?? true,
  });
}

/**
 * 패싯.
 *
 * 페이지·정렬을 질의 키에서 빼는 것이 중요하다 — 패싯은 "이 조건에서 각 분류가 몇 건인가"라
 * 페이지를 넘긴다고 달라지지 않는다. 넣어 두면 페이지마다 같은 집계를 다시 계산한다.
 */
export function useNoticeIndexFacets(query: NoticeIndexQuery, options?: { enabled?: boolean }) {
  const { page: _page, perPage: _perPage, sort: _sort, dir: _dir, ...rest } = query;
  return useQuery({
    queryKey: ['notice-index', 'facets', rest],
    queryFn: () => get<NoticeFacets>(`${BASE}/facets?${params(rest)}`),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
    enabled: options?.enabled ?? true,
  });
}

export function useNoticeIndexDetail(id: string | null) {
  return useQuery({
    queryKey: ['notice-index', 'detail', id],
    queryFn: () => get<NoticeIndexItem>(`${BASE}/${encodeURIComponent(id as string)}`),
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  });
}

export function useIndexStatus() {
  return useQuery({
    queryKey: ['notice-index', 'status'],
    queryFn: () => get<IndexStatus>(`${BASE}/status`),
    staleTime: 60_000,
  });
}
