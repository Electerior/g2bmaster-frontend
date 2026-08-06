/*
 * 검색 조건의 단일 출처 = URL search params.
 *
 * 원본은 전역 `state` 객체를 직접 변형하고, 늦게 도착한 응답이 화면을 덮어쓰는 것을
 * `searchSeq` 카운터로 막았다. 그 방식에는 두 가지 문제가 있었다.
 *  1. 검색 결과 화면을 링크로 공유할 수 없다 — 조건이 메모리에만 있으므로.
 *  2. 뒤로 가기가 앱 안의 별도 히스토리 스택(viewHistory, 각 10개)이라 브라우저와 어긋난다.
 *
 * 조건을 URL 로 올리면 두 문제가 함께 사라지고, 경쟁 조건은 TanStack Query 의 queryKey 가
 * 처리한다(조건이 바뀌면 키가 바뀌고, 옛 키의 응답은 화면에 반영되지 않는다).
 * → searchSeq 수동 취소 장치는 이식하지 않는다.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { NoticeSearchQuery } from '@/api/notices';
import type { ScreenKind } from '@/domain/columns';
import { localDateString, toG2bDate } from '@/domain/format';
import { searchModeLayout, type SearchMode } from '@/domain/searchModes';

/* ─── 조건 ────────────────────────────────────────────────────────────────── */

export type BidType = '' | '물품' | '용역' | '공사';
export type SortDir = 'asc' | 'desc';

export interface SearchCriteria {
  /** 모두 포함 / 하나 이상 / 제외 / 파일 내. */
  andTerms: string[];
  orTerms: string[];
  notTerms: string[];
  fileKeywords: string[];
  /** 유사도 확장은 '하나 이상'(제목)과 '파일 내'(규격서 본문)에만 붙는다. */
  simOr: boolean;
  simFile: boolean;
  fromDate: string;
  toDate: string;
  pageNo: number;
  perPage: number;
  activeOnly: boolean;
  excludeBlockingClauses: boolean;
  bidType: BidType;
  /** 다른 탭에서 공고번호를 들고 넘어왔을 때. 이 값이 있으면 키워드는 무시된다. */
  crossBidNtceNo: string;
  insttNm: string;
  corpNm: string;
  brnNo: string;
  officerInsttNm: string;
  sortKey: string;
  sortDir: SortDir;
  mode: SearchMode;
}

/** URL 파라미터 이름. 원본 state 필드명보다 짧게 — 주소창에 그대로 노출되는 값이다. */
const PARAM = {
  and: 'and',
  or: 'or',
  not: 'not',
  file: 'file',
  simOr: 'simOr',
  simFile: 'simFile',
  from: 'from',
  to: 'to',
  page: 'page',
  perPage: 'perPage',
  activeOnly: 'active',
  blocking: 'blocking',
  bidType: 'type',
  crossNo: 'ntceNo',
  instt: 'instt',
  corp: 'corp',
  brn: 'brn',
  officer: 'officer',
  sortKey: 'sort',
  sortDir: 'dir',
  mode: 'mode',
} as const;

export const DEFAULT_CRITERIA: SearchCriteria = {
  andTerms: [],
  orTerms: [],
  notTerms: [],
  fileKeywords: [],
  simOr: false,
  simFile: false,
  fromDate: '',
  toDate: '',
  pageNo: 1,
  perPage: 20,
  activeOnly: true,
  excludeBlockingClauses: true,
  bidType: '',
  crossBidNtceNo: '',
  insttNm: '',
  corpNm: '',
  brnNo: '',
  officerInsttNm: '',
  sortKey: '',
  sortDir: 'asc',
  mode: 'keyword',
};

const BID_TYPES: readonly BidType[] = ['', '물품', '용역', '공사'];

function parseTerms(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 기본값이 true 인 플래그는 'false' 문자열일 때만 끈다 — 파라미터 없음 = 기본값. */
function parseBoolDefaultTrue(raw: string | null): boolean {
  return raw !== 'false';
}

function parseBoolDefaultFalse(raw: string | null): boolean {
  return raw === 'true';
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function criteriaFromParams(params: URLSearchParams): SearchCriteria {
  const bidTypeRaw = params.get(PARAM.bidType) ?? '';
  const bidType = (BID_TYPES as readonly string[]).includes(bidTypeRaw)
    ? (bidTypeRaw as BidType)
    : '';
  return {
    andTerms: parseTerms(params.get(PARAM.and)),
    orTerms: parseTerms(params.get(PARAM.or)),
    notTerms: parseTerms(params.get(PARAM.not)),
    fileKeywords: parseTerms(params.get(PARAM.file)),
    simOr: parseBoolDefaultFalse(params.get(PARAM.simOr)),
    simFile: parseBoolDefaultFalse(params.get(PARAM.simFile)),
    fromDate: params.get(PARAM.from) ?? '',
    toDate: params.get(PARAM.to) ?? '',
    pageNo: parsePositiveInt(params.get(PARAM.page), DEFAULT_CRITERIA.pageNo),
    perPage: parsePositiveInt(params.get(PARAM.perPage), DEFAULT_CRITERIA.perPage),
    activeOnly: parseBoolDefaultTrue(params.get(PARAM.activeOnly)),
    excludeBlockingClauses: parseBoolDefaultTrue(params.get(PARAM.blocking)),
    bidType,
    crossBidNtceNo: params.get(PARAM.crossNo) ?? '',
    insttNm: params.get(PARAM.instt) ?? '',
    corpNm: params.get(PARAM.corp) ?? '',
    brnNo: params.get(PARAM.brn) ?? '',
    officerInsttNm: params.get(PARAM.officer) ?? '',
    sortKey: params.get(PARAM.sortKey) ?? '',
    sortDir: params.get(PARAM.sortDir) === 'desc' ? 'desc' : 'asc',
    mode: searchModeLayout(params.get(PARAM.mode) ?? '').mode,
  };
}

/** 기본값과 같은 항목은 URL 에서 뺀다 — 주소가 짧아야 공유가 된다. */
export function criteriaToParams(criteria: SearchCriteria): URLSearchParams {
  const params = new URLSearchParams();
  const setIf = (key: string, value: string, isDefault: boolean) => {
    if (!isDefault && value) params.set(key, value);
  };

  setIf(PARAM.and, criteria.andTerms.join(','), criteria.andTerms.length === 0);
  setIf(PARAM.or, criteria.orTerms.join(','), criteria.orTerms.length === 0);
  setIf(PARAM.not, criteria.notTerms.join(','), criteria.notTerms.length === 0);
  setIf(PARAM.file, criteria.fileKeywords.join(','), criteria.fileKeywords.length === 0);
  if (criteria.simOr) params.set(PARAM.simOr, 'true');
  if (criteria.simFile) params.set(PARAM.simFile, 'true');
  setIf(PARAM.from, criteria.fromDate, !criteria.fromDate);
  setIf(PARAM.to, criteria.toDate, !criteria.toDate);
  if (criteria.pageNo !== DEFAULT_CRITERIA.pageNo) params.set(PARAM.page, String(criteria.pageNo));
  if (criteria.perPage !== DEFAULT_CRITERIA.perPage) {
    params.set(PARAM.perPage, String(criteria.perPage));
  }
  if (!criteria.activeOnly) params.set(PARAM.activeOnly, 'false');
  if (!criteria.excludeBlockingClauses) params.set(PARAM.blocking, 'false');
  setIf(PARAM.bidType, criteria.bidType, !criteria.bidType);
  setIf(PARAM.crossNo, criteria.crossBidNtceNo, !criteria.crossBidNtceNo);
  setIf(PARAM.instt, criteria.insttNm, !criteria.insttNm);
  setIf(PARAM.corp, criteria.corpNm, !criteria.corpNm);
  setIf(PARAM.brn, criteria.brnNo, !criteria.brnNo);
  setIf(PARAM.officer, criteria.officerInsttNm, !criteria.officerInsttNm);
  if (criteria.sortKey) {
    params.set(PARAM.sortKey, criteria.sortKey);
    params.set(PARAM.sortDir, criteria.sortDir);
  }
  if (criteria.mode !== DEFAULT_CRITERIA.mode) params.set(PARAM.mode, criteria.mode);
  return params;
}

/* ─── 판정 헬퍼 (원본 app.js 의 순수 함수들) ──────────────────────────────── */

/**
 * 검색어가 공고번호처럼 보이면(공백 없는 숫자 위주 단일 토큰, 끝 '-01' 차수 허용) 키워드가
 * 아니라 bidNtceNo 직접조회로 라우팅. 예: 2026LKD004328889-01(D2B), R26BK01638523(나라장터).
 * 원본 looksLikeNoticeNo(app.js:1188).
 */
export function looksLikeNoticeNo(value: string): boolean {
  const t = String(value || '').trim();
  if (!t || /\s/.test(t)) return false;
  const digits = (t.match(/\d/g) || []).length;
  return t.length >= 10 && digits >= 6 && /^[0-9A-Za-z]+(-\d{1,3})?$/.test(t);
}

/**
 * 블로킹 조항 판정이 의미있는 검색인가 — 공고/발주계획/사전규격 + 낙찰자·담당자 조회 제외.
 * (낙찰자=과거 낙찰결과, 담당자=연락처 조회라 입찰 여부 판단 대상이 아님.)
 * 원본 isBlockingRelevant(app.js:1197).
 */
export function isBlockingRelevant(kind: ScreenKind, mode: SearchMode): boolean {
  if (mode === 'corp' || mode === 'officer') return false;
  return kind === 'bid-plan' || kind === 'pre-spec' || kind === 'bid-announce';
}

/**
 * 체크박스와 무관하게 스캔한다 — 체크 해제 시엔 제외 대신 '?'로 사유를 표시해야 하므로.
 * 원본 shouldScanAttachments(app.js:1201).
 */
export function shouldScanAttachments(criteria: SearchCriteria, kind: ScreenKind): boolean {
  return criteria.fileKeywords.length > 0 || isBlockingRelevant(kind, criteria.mode);
}

/**
 * 조회 기간이 통째로 과거인가. 과거만 보는 검색에 '마감 전만' 을 그대로 걸면 결과가
 * 항상 0건이 된다 — 원본은 이 경우 activeOnly 를 자동으로 끈다.
 * 원본 isPastOnlyAnnounceRange(app.js:247).
 */
export function isPastOnlyAnnounceRange(criteria: SearchCriteria, kind: ScreenKind): boolean {
  return kind === 'bid-announce' && !!criteria.toDate && criteria.toDate < localDateString();
}

/* ─── buildQuery — 원본 buildParams(app.js:1205)의 타입 붙은 이식 ─────────── */

export interface BuildQueryOverrides {
  activeOnly?: boolean;
  /** 첨부 전수조사는 pageNo=0(전체) 으로 부른다. */
  pageNo?: number;
}

export function buildQuery(
  criteria: SearchCriteria,
  kind: ScreenKind,
  overrides: BuildQueryOverrides = {},
): NoticeSearchQuery {
  const itemMode = criteria.mode === 'item';
  const keywordMode = criteria.mode !== 'instt';

  // 키워드가 단일 공고번호면 번호조회로 전환(키워드는 비움).
  const soleTerm =
    keywordMode &&
    criteria.andTerms.length === 1 &&
    criteria.orTerms.length === 0 &&
    criteria.notTerms.length === 0
      ? criteria.andTerms[0]
      : '';
  const queryNo =
    criteria.crossBidNtceNo ||
    (kind === 'bid-announce' && looksLikeNoticeNo(soleTerm) ? soleTerm : '');
  const useTerms = keywordMode && !queryNo;

  const activeOnly = overrides.activeOnly ?? criteria.activeOnly;
  const useActiveOnly =
    activeOnly && kind === 'bid-announce' && !queryNo && !isPastOnlyAnnounceRange(criteria, kind);

  const pageNo = overrides.pageNo ?? criteria.pageNo;

  const query: NoticeSearchQuery = {
    andTerms: useTerms ? criteria.andTerms.join(',') : '',
    orTerms: useTerms ? criteria.orTerms.join(',') : '',
    notTerms: useTerms ? criteria.notTerms.join(',') : '',
    pageNo,
  };

  // 아래는 전부 "값이 있을 때만" 붙인다. 빈 값을 붙이면 서버가 필터로 받아들인다.
  if (criteria.perPage !== DEFAULT_CRITERIA.perPage) query.perPage = criteria.perPage;
  if (useActiveOnly) query.activeOnly = 'true';
  if (criteria.fromDate) query.fromDate = toG2bDate(criteria.fromDate);
  if (criteria.toDate) query.toDate = toG2bDate(criteria.toDate);
  if (queryNo) query.bidNtceNo = queryNo;
  if (criteria.insttNm) query.insttNm = criteria.insttNm;
  if (criteria.corpNm) query.corpNm = criteria.corpNm;
  if (criteria.bidType) query.bidType = criteria.bidType;
  if (criteria.sortKey) {
    query.sortKey = criteria.sortKey;
    query.sortDir = criteria.sortDir;
  }
  if (shouldScanAttachments(criteria, kind)) query.fileScan = 'true';
  if (itemMode) query.searchField = 'item';
  // 유사도는 '하나 이상'(제목)과 '파일 내'(규격서 본문)에만 붙는다.
  // '모두 포함'·'제외'는 정확히 걸러야 하는 조건이라 의미 확장을 넣지 않는다.
  if (criteria.simOr && criteria.orTerms.length) query.simOr = 'true';
  if (criteria.simFile && criteria.fileKeywords.length) query.simFile = 'true';

  return query;
}

/* ─── 훅 ──────────────────────────────────────────────────────────────────── */

export interface UseSearchCriteriaResult {
  criteria: SearchCriteria;
  /** 일부 필드만 갱신한다. 조건이 바뀌면 페이지는 1로 되돌린다(page 를 직접 준 경우 제외). */
  setCriteria: (patch: Partial<SearchCriteria>, options?: { replace?: boolean }) => void;
  /** 페이지 이동 전용 — 나머지 조건은 그대로 둔다. */
  setPage: (pageNo: number) => void;
  /** 검색 조건만 초기화한다. 라우트(화면)는 그대로. */
  reset: () => void;
}

export function useSearchCriteria(): UseSearchCriteriaResult {
  const [searchParams, setSearchParams] = useSearchParams();

  // searchParams 는 매 렌더 새 객체지만 toString() 은 안정적이라 그것으로 메모한다.
  const key = searchParams.toString();
  const criteria = useMemo(() => criteriaFromParams(new URLSearchParams(key)), [key]);

  const setCriteria = useCallback(
    (patch: Partial<SearchCriteria>, options: { replace?: boolean } = {}) => {
      const next: SearchCriteria = {
        ...criteria,
        ...patch,
        // 조건이 바뀌었는데 3페이지에 머물면 빈 화면이 뜬다 — 명시적으로 page 를 준 게
        // 아니면 1로 되돌린다.
        pageNo: patch.pageNo ?? (Object.keys(patch).length > 0 ? 1 : criteria.pageNo),
      };
      setSearchParams(criteriaToParams(next), { replace: options.replace ?? false });
    },
    [criteria, setSearchParams],
  );

  const setPage = useCallback(
    (pageNo: number) => {
      setSearchParams(criteriaToParams({ ...criteria, pageNo }));
    },
    [criteria, setSearchParams],
  );

  const reset = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  return { criteria, setCriteria, setPage, reset };
}
