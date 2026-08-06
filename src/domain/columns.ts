/*
 * 화면별 컬럼 정의 — 원본 public/app.js 의 `TABS`(2~120행)를 그대로 옮긴 것.
 *
 * 원본은 이 표 하나로 탭 라벨 · 엔드포인트 · 컬럼 · 화면 종류(deal/saved/trend)를 전부
 * 결정했다. 라우터가 생긴 뒤에도 컬럼과 라벨은 여전히 한곳에 있어야 하므로 표는 유지하되,
 * "이 탭은 표인가 딜인가 트렌드인가"를 boolean 플래그 대신 판별 가능한 union 으로 바꿨다.
 * 원본의 `cfg?.deal` / `cfg?.saved` / `cfg?.trend` 분기는 전부 이 union 의 `kind` 로 대체된다.
 */

/** 셀 포매터 종류 — 원본 formatCell(app.js:3990) 의 switch 분기와 1:1 대응. */
export type CellFmt =
  | 'money'
  | 'date'
  | 'datetime'
  | 'rate'
  | 'd-day'
  | 'tel'
  | 'email'
  | 'type-badge'
  | 'source-badge'
  | 'status-badge'
  | 'method-summary'
  | 'requirement-tags'
  | 'opportunity'
  | 'link'
  | 'ntce-link'
  | 'plan-link'
  | 'spec-link'
  | 'ntce-cross'
  | 'result-cross'
  | 'announce-cross';

export interface ColumnDef {
  label: string;
  key: string;
  /** 없으면 원본 default 분기 = 문자열 그대로 출력. */
  fmt?: CellFmt;
}

/** 트렌드 화면 설정 — 원본 TABS[*].trend. */
export interface TrendConfig {
  title: string;
  itemLabel: string;
  quickKeywords: readonly string[];
}

/** 라우트가 고르는 화면 식별자. 원본 state.tab 의 값과 같은 문자열을 쓴다. */
export type ScreenKind =
  | 'bid-plan'
  | 'pre-spec'
  | 'bid-announce'
  | 'bid-result'
  | 'deal-radar'
  | 'saved-notices'
  | 'spec-search'
  | 'product-trend'
  | 'service-trend'
  | 'construction-trend';

interface ScreenBase {
  label: string;
  endpoint: string;
}

export type ScreenConfig =
  | (ScreenBase & { kind: 'table'; columns: readonly ColumnDef[] })
  | (ScreenBase & { kind: 'deal' })
  | (ScreenBase & { kind: 'saved' })
  | (ScreenBase & { kind: 'trend'; trend: TrendConfig })
  | (ScreenBase & { kind: 'spec-search' });

export const SCREENS: Readonly<Record<ScreenKind, ScreenConfig>> = {
  'bid-plan': {
    kind: 'table',
    label: '발주 계획',
    endpoint: '/api/bid-plan',
    columns: [
      { label: '수주기회', key: '_opportunitySummary', fmt: 'opportunity' },
      { label: '업무구분', key: 'bsnsDivNm' },
      { label: '조달요청명', key: 'bizNm' },
      { label: '발주기관', key: 'orderInsttNm' },
      { label: '품목', key: 'prdctClsfcNoNm' },
      { label: '품목번호', key: 'prdctClsfcNo' },
      { label: '예산금액', key: 'sumOrderAmt', fmt: 'money' },
      { label: '계약방식', key: 'cntrctMthdNm' },
      { label: '접수일', key: 'nticeDt', fmt: 'datetime' },
      { label: '나라장터', key: 'prcrmntReqInfoUrl', fmt: 'link' },
    ],
  },
  'pre-spec': {
    kind: 'table',
    label: '사전 규격',
    endpoint: '/api/pre-spec',
    columns: [
      { label: '수주기회', key: '_opportunitySummary', fmt: 'opportunity' },
      { label: '업무구분', key: 'bsnsDivNm' },
      { label: '규격번호', key: 'prdctClfcNo' },
      { label: '품명', key: 'prdctClsfcNoNm', fmt: 'spec-link' },
      { label: '품목번호', key: 'prdctClsfcNo' },
      { label: '발주기관', key: 'ntceInsttNm' },
      { label: '예산금액', key: 'asignBdgtAmt', fmt: 'money' },
      { label: '접수일', key: 'pstDt', fmt: 'datetime' },
      { label: '의견마감', key: 'opninRgstClseDt', fmt: 'datetime' },
      { label: 'D-DAY', key: 'opninRgstClseDt', fmt: 'd-day' },
      { label: '규격서', key: 'lnkUrl', fmt: 'link' },
      { label: '관련공고', key: 'bidNtceNoList', fmt: 'ntce-cross' },
    ],
  },
  'bid-announce': {
    kind: 'table',
    label: '입찰 공고',
    endpoint: '/api/bid-announce',
    columns: [
      { label: '수주기회', key: '_opportunitySummary', fmt: 'opportunity' },
      { label: '구분', key: '_type', fmt: 'type-badge' },
      { label: '공고번호', key: 'bidNtceNo' },
      { label: '공고명', key: 'bidNtceNm', fmt: 'ntce-link' },
      { label: '공고기관', key: 'ntceInsttNm' },
      { label: '추정가격', key: 'presmptPrce', fmt: 'money' },
      { label: '계약/낙찰', key: '_contractSummary', fmt: 'method-summary' },
      { label: '제한/자격', key: '_requirementSummary', fmt: 'requirement-tags' },
      { label: '공고일', key: 'bidNtceDt', fmt: 'date' },
      { label: '마감일시', key: 'bidClseDt', fmt: 'datetime' },
      { label: 'D-DAY', key: 'bidClseDt', fmt: 'd-day' },
      { label: '담당자', key: 'ntceInsttOfclNm' },
      { label: '전화', key: 'ntceInsttOfclTelNo', fmt: 'tel' },
      { label: '이메일', key: 'ntceInsttOfclEmailAdrs', fmt: 'email' },
      { label: '낙찰결과', key: 'bidNtceNo', fmt: 'result-cross' },
      { label: '출처', key: '_sourceLabel', fmt: 'source-badge' },
      { label: '상태', key: '_noticeStatus', fmt: 'status-badge' },
    ],
  },
  'bid-result': {
    kind: 'table',
    label: '입찰 결과',
    endpoint: '/api/bid-result',
    columns: [
      { label: '구분', key: '_type', fmt: 'type-badge' },
      { label: '공고번호', key: 'bidNtceNo' },
      { label: '공고명', key: 'bidNtceNm' },
      { label: '수요기관', key: 'dminsttNm' },
      { label: '낙찰업체', key: 'bidwinnrNm' },
      { label: '낙찰금액', key: 'sucsfbidAmt', fmt: 'money' },
      { label: '낙찰률', key: 'sucsfbidRate', fmt: 'rate' },
      { label: '참여업체수', key: 'prtcptCnum' },
      { label: '개찰일시', key: 'rlOpengDt', fmt: 'datetime' },
      { label: '낙찰확정일', key: 'fnlSucsfDate', fmt: 'date' },
      { label: '공고보기', key: 'bidNtceNo', fmt: 'announce-cross' },
    ],
  },
  // 공고 소스를 재사용한다 — 점수 게이트를 통과한 건만 딜 분석으로 넘긴다.
  'deal-radar': {
    kind: 'deal',
    label: 'AI 수주 데스크',
    endpoint: '/api/bid-announce',
  },
  // 담아 둔 공고. 여기서는 G2B API 를 부르지 않는다 — 저장된 것만 훑는다.
  'saved-notices': {
    kind: 'saved',
    label: '저장 공고',
    endpoint: '/api/saved-notices',
  },
  // 원본 버그 수정: renderSpecSearchPanel() 은 구현돼 있었지만 TABS 에 항목이 없어
  // 탭을 누르면 cfg === undefined 로 TypeError 가 났다. 여기서 정식 항목으로 등록한다.
  'spec-search': {
    kind: 'spec-search',
    label: '하드웨어 스펙 검색',
    endpoint: '/api/search/titles',
  },
  'product-trend': {
    kind: 'trend',
    label: '물품 구매 트렌드',
    endpoint: '/api/trends/product',
    trend: {
      title: '물품 구매 트렌드',
      itemLabel: '물품',
      quickKeywords: [
        'PC',
        '노트북',
        '모니터',
        '서버',
        'GPU',
        '프린터',
        '복합기',
        '태블릿',
        '전자칠판',
        '네트워크',
      ],
    },
  },
  'service-trend': {
    kind: 'trend',
    label: '용역 트렌드',
    endpoint: '/api/trends/service',
    trend: {
      title: '용역 트렌드',
      itemLabel: '용역',
      quickKeywords: ['AI', '데이터', '클라우드', '유지보수', '보안', '컨설팅', '교육', '플랫폼'],
    },
  },
  'construction-trend': {
    kind: 'trend',
    label: '공사 트렌드',
    endpoint: '/api/trends/construction',
    trend: {
      title: '공사 트렌드',
      itemLabel: '공사',
      quickKeywords: [
        '건축',
        '토목',
        '전기',
        '정보통신',
        '소방',
        '기계설비',
        '실내건축',
        '조경',
        '유지보수',
        '철거',
      ],
    },
  },
};

/** 표 화면(bid-plan · pre-spec · bid-announce · bid-result)만 컬럼을 가진다. */
export type NoticeTableKind = 'bid-plan' | 'pre-spec' | 'bid-announce' | 'bid-result';

export function columnsFor(kind: NoticeTableKind): readonly ColumnDef[] {
  const cfg = SCREENS[kind];
  return cfg.kind === 'table' ? cfg.columns : [];
}

/**
 * 탭별 기본 정렬 — 원본 defaultSortForTab(app.js:160).
 * 정렬 없이 들어오면 표가 API 응답 순서를 그대로 보여 주는데, 그 순서는 안정적이지 않다.
 */
export interface SortSpec {
  key: string;
  dir: 'asc' | 'desc';
}

export function defaultSortForKind(kind: ScreenKind): SortSpec {
  if (kind === 'bid-plan') return { key: 'nticeDt', dir: 'desc' };
  if (kind === 'pre-spec') return { key: 'pstDt', dir: 'desc' };
  if (kind === 'bid-announce') return { key: 'bidNtceDt', dir: 'desc' };
  if (kind === 'bid-result') return { key: 'rlOpengDt', dir: 'desc' };
  return { key: '', dir: 'asc' };
}
