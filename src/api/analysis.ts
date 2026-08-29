/*
 * AI · 분석 계열 엔드포인트 — 공고 단순 요약, 낙찰자 이력, 담당자 조회,
 * 담합 매트릭스, 파일 파싱.
 *
 * **가장 중요한 계약:** 공고 요약은 LLM 이 실패해도 HTTP 200 을 준다.
 * 이때 summary=null, aiFallback=true, aiError=한국어 사유가 오므로 화면이 직접 표시한다.
 */
import { useMutation } from '@tanstack/react-query';
import { post } from '@/lib/apiClient';
import type { BidOpeningParticipant } from './notices';
import type { FileEntry, LegalAssessment } from './types';

/* ─── 공고 AI 요약 ────────────────────────────────────────────────────────── */

/**
 * 계획·사전규격·입찰공고가 함께 쓰는 단일 요약 요청.
 *
 * 세 화면의 원본 필드명이 서로 달라 공통 필드와 식별자를 한 봉투에 둔다. 백엔드는
 * {@code entityType} 과 식별자를 기준으로 필요한 기본정보·첨부만 골라 단순 요약한다.
 */
export interface NoticeSummaryRequest {
  bidNtceNo?: string;
  bidNtceSqNo?: string;
  bfSpecRgstNo?: string;
  prcrmntReqNo?: string;
  entityType?: string;
  bidNtceNm?: string;
  title?: string;
  ntceInsttNm?: string;
  insttNm?: string;
  itemName?: string;
  presmptPrce?: string | number;
  amount?: string | number;
  cntrctCnclsMthdNm?: string;
  cntrctMthdNm?: string;
  dtilPrdctClsfcNoNm?: string;
  _type?: string;
  type?: string;
  /** 사용자가 직접 붙여 넣은 본문 — 있으면 첨부 파싱을 건너뛴다. */
  manualContent?: string;
  manualFileName?: string;
  companyProfile?: string;
  fileEntries?: FileEntry[];
  rawFields?: Record<string, unknown>;
}

export interface NoticeSummarySuccess {
  summary: string;
  promptVersion: string;
  llmModel: string;
  aiFallback?: false;
  aiError?: never;
  /** 이전 응답과의 점진적 호환. 새 단순 요약 응답에서는 생략될 수 있다. */
  parsedFiles?: unknown[];
}

export interface NoticeSummaryFallback {
  /** AI 실패도 HTTP 200이며 본문은 null이다. */
  summary: null;
  aiFallback: true;
  aiError: string;
  promptVersion?: never;
  llmModel?: never;
  parsedFiles?: unknown[];
}

export type NoticeSummaryResponse = NoticeSummarySuccess | NoticeSummaryFallback;

/** 계획·사전규격·입찰공고가 모두 쓰는 단일 요약 표면. */
export function summarizeNotice(body: NoticeSummaryRequest): Promise<NoticeSummaryResponse> {
  return post<NoticeSummaryResponse>('/api/notice-summary', body);
}

/* ─── 낙찰자 이력 ─────────────────────────────────────────────────────────── */

export interface CompanyHistoryRequest {
  corpNm?: string;
  brnNo?: string;
  fromDate?: string;
  toDate?: string;
}

export interface CompanyParticipation {
  bidNtceNo: string;
  bidNtceNm: string;
  ntceInsttNm: string;
  dminsttNm: string;
  opengDt: string;
  presmptPrce: string | number;
  _type: string;
  bdrNm: string;
  rank: string | number;
  bidAmt: string | number;
  bidprcRt: string | number;
  sucsfbidYn: string;
  _won: boolean;
  totalParticipants?: number;
}

export interface CompanyHistoryResponse {
  corpNm: string;
  from: string;
  to: string;
  wins: Array<Record<string, unknown>>;
  participations: CompanyParticipation[];
  stats: {
    winCount: number;
    participationCount: number;
    winRate: number | null;
    /** 서버가 .toFixed(3) 을 거쳐 문자열로 준다 — 숫자로 쓰려면 Number() 를 거칠 것. */
    avgBidRate: string | null;
    bidRateSeries: Array<{
      date: string;
      rate: number;
      won: boolean;
      name: string;
      rank: string;
    }>;
  };
}

export function fetchCompanyHistory(body: CompanyHistoryRequest): Promise<CompanyHistoryResponse> {
  return post<CompanyHistoryResponse>('/api/company-history', body);
}

/* ─── 담당자 조회 ─────────────────────────────────────────────────────────── */

export interface OfficerSearchRequest {
  insttNm: string;
  fromDate?: string;
  toDate?: string;
}

export interface OfficerRecord {
  name: string;
  tel: string;
  email: string;
  insttNm: string;
  dminsttNm: string;
  bids: Array<{
    bidNtceNo: string;
    bidNtceNm: string;
    bidNtceDt: string;
    bidClseDt: string;
    asignBdgtAmt: string | number;
    dminsttNm: string;
    type: string;
  }>;
}

export interface OfficerSearchResponse {
  insttNm: string;
  from: string;
  to: string;
  totalBids: number;
  officers: OfficerRecord[];
}

export function searchOfficers(body: OfficerSearchRequest): Promise<OfficerSearchResponse> {
  return post<OfficerSearchResponse>('/api/officer-search', body);
}

/* ─── 담합(들러리) 매트릭스 ───────────────────────────────────────────────── */

export interface CollusionAnalysisRequest {
  /** 서버는 최대 20건까지만 처리한다. */
  bids: Array<{
    bidNtceNo: string;
    bidNtceSqNo?: string;
    _type?: string;
    /*
     * 아래 둘은 물음표가 붙어 있지만 **사실상 필수다.**
     *
     * 서버는 요청으로 받은 공고 객체를 그대로 복사해 응답 `bids` 에 되돌려 준다
     * (백엔드 MarketIntelService.java:316). 즉 이 둘을 안 보내면 서버가 어디서도 채워
     * 주지 않아 모달 3번째 섹션('공고별 1·2위')의 공고명·개찰일이 통째로 null 이 된다.
     * 화면이 조용히 비는 종류라 타입만 보고는 눈치채기 어려워 여기 적어 둔다.
     * 원본도 같은 5필드를 보낸다(app.js:2656-2662).
     */
    bidNtceNm?: string;
    opengDate?: string;
  }>;
}

export interface CollusionAnalysisResponse {
  bids: Array<Record<string, unknown> & { participants: BidOpeningParticipant[] }>;
  pairs: Array<{
    a: string;
    b: string;
    total: number;
    aWins: number;
    bWins: number;
    cases: Array<{
      bidNtceNo: string;
      bidNtceNm: string;
      winner: string;
      runnerUp: string;
      /*
       * 숫자가 아니라 **문자열로 온다.** 백엔드가 G2B 원본값을 Object 로 패스스루하기
       * 때문이다(CollusionAnalysis.java:180-182). 실제 응답은 "80" 같은 값이라 이 타입을
       * 믿고 .toFixed() 를 부르면 런타임에 터진다. api/notices.ts 의
       * BidOpeningParticipant.bidprcRt 가 이미 `string | number` 이므로 그 관례를 따른다.
       */
      winBidprcRt: string | number;
      runBidprcRt: string | number;
      opengDate: string;
    }>;
    alterScore: number;
    suspicionScore: number;
  }>;
  companies: Array<{
    name: string;
    wins: number;
    runnerUp: number;
    appearances: number;
    avgRate: number | null;
    rateHistory: number[];
    isMonotonicallyIncreasing: boolean;
    cases: unknown[];
  }>;
}

export function analyzeCollusion(
  body: CollusionAnalysisRequest,
): Promise<CollusionAnalysisResponse> {
  return post<CollusionAnalysisResponse>('/api/collusion-analysis', body);
}

/* ─── 파일 파싱 (multipart) ───────────────────────────────────────────────── */

export interface ParseFileResponse {
  /** markdown 본문. */
  text: string;
  filename: string;
  documentTags: string[];
  bidBlockingClauses: {
    excluded: boolean;
    reasons: string[];
    matches: Array<{ reason: string; excerpt: string }>;
  };
  legalAssessment: LegalAssessment | null;
}

/**
 * multipart 는 Content-Type 을 axios 가 boundary 와 함께 직접 정해야 하므로
 * apiClient 기본 헤더(application/json)를 undefined 로 덮어 지운다.
 */
export function parseFile(file: File): Promise<ParseFileResponse> {
  const form = new FormData();
  form.append('file', file);
  return post<ParseFileResponse>('/api/parse-file', form, {
    headers: { 'Content-Type': undefined },
  });
}

/* ─── 훅 ──────────────────────────────────────────────────────────────────── */


export function useCompanyHistory() {
  return useMutation({ mutationFn: fetchCompanyHistory });
}

export function useOfficerSearch() {
  return useMutation({ mutationFn: searchOfficers });
}

export function useCollusionAnalysis() {
  return useMutation({ mutationFn: analyzeCollusion });
}


export function useParseFile() {
  return useMutation({ mutationFn: parseFile });
}
