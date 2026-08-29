/*
 * 검색창 전체 — 원본 index.html 의 `<section class="search-box">` + app.js 의 배선.
 *
 * 원본과의 구조적 차이 둘.
 *  1. 조건은 URL 이 갖는다. 입력이 확정되는 순간 URL 이 바뀌고, 화면들은 그 URL 을 보고
 *     조회한다 — '검색' 버튼은 "아직 확정되지 않은 입력을 확정한다"는 뜻이 된다.
 *  2. 앱 내 뒤로/앞으로 스택(viewHistory/viewForwardHistory, 각 10개)을 **삭제**했다.
 *     조건이 URL 에 있으므로 브라우저 뒤로/앞으로가 같은 일을 더 정확히 한다(spec §2).
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useNotReady } from '@/components/feedback/notReadyContext';
import type { ScreenKind } from '@/domain/columns';
import { fmtInputDate } from '@/domain/format';
import { SEARCH_MODES, searchModeLayout } from '@/domain/searchModes';
import type { SearchMode } from '@/domain/searchModes';
import { isTransitRoute, ROUTES } from '@/routes/routePaths';
import { itemSearchApplies, useSearchCriteria, type SearchCriteria } from './useSearchCriteria';
import { SearchModeTabs } from './SearchModeTabs';
import { TagInput } from './TagInput';
import './search.css';

/** 원본 setQuickDateRange(app.js:1044) — 오늘부터 N일 전까지. */
function quickRange(days: number): { fromDate: string; toDate: string } {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - days);
  return { fromDate: fmtInputDate(from), toDate: fmtInputDate(today) };
}

const QUICK_DATES = [
  { days: 0, label: '오늘' },
  { days: 7, label: '1주일' },
  { days: 14, label: '2주일' },
  { days: 30, label: '1달' },
] as const;

/** 원본 init() 이 화면을 띄우자마자 걸던 기본 범위. */
const DEFAULT_RANGE_DAYS = 30;

/** 원본 setSearchMode 가 '모두 포함' 입력의 placeholder 를 모드에 따라 바꿨다(app.js:1091). */
function andPlaceholder(mode: SearchMode): string {
  return mode === 'item'
    ? '품목명 입력 후 Enter — 예: 신선한빵, 컴퓨터서버, 정수기'
    : '키워드 입력 후 Enter — 모두 일치해야 함';
}

/** × 버튼이 달린 발주기관 입력. */
interface ClearableInputProps {
  badgeClass: string;
  badgeLabel: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  clearTitle: string;
}

function ClearableInput({
  badgeClass,
  badgeLabel,
  value,
  placeholder,
  onChange,
  onSubmit,
  clearTitle,
}: ClearableInputProps) {
  return (
    <>
      <span className={`bool-badge ${badgeClass}`}>{badgeLabel}</span>
      <div className="instt-wrap">
        <input
          className="instt-input"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          aria-label={badgeLabel}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
        {/* 원본은 값이 있을 때만 .visible 을 붙였다 — 빈 칸 옆의 × 는 누를 것이 없다. */}
        {value ? (
          <button
            type="button"
            className="btn-clear-instt"
            title={clearTitle}
            aria-label={clearTitle}
            onClick={() => onChange('')}
          >
            ×
          </button>
        ) : null}
      </div>
    </>
  );
}

export function SearchHeader() {
  const location = useLocation();
  const { criteria, setCriteria } = useSearchCriteria();
  /*
   * 검색창은 셸이 그리므로 kind 를 프롭으로 받지 않는다 — 주소로 판별한다.
   * 표 라우트는 지금 입찰 결과 하나뿐이고(NoticeTableScreen 주석), 나머지 단계는 통합
   * 검색으로 합쳐져 자기 주소가 없다. kind → 경로 표를 새로 만들면 그 표가
   * routePaths.ts 와 어긋나는 날 조용히 엉뚱한 화면을 가리킨다.
   */
  const kind: ScreenKind = location.pathname === ROUTES.bidResult ? 'bid-result' : 'notice-search';
  /*
   * 쓸 수 있는 모드는 **buildQuery 와 같은 근거**에서 뽑는다. 여기에 목록을 따로 적으면
   * 탭은 보이는데 조건은 안 실리는(또는 그 반대인) 어긋남이 언제든 생긴다.
   */
  const availableModes = SEARCH_MODES.filter((m) => m !== 'item' || itemSearchApplies(kind));
  /*
   * URL 의 mode 가 이 화면에서 성립하지 않는 경우. 탭을 넘어와도 mode 는 보존되므로
   * (searchForTab 이 일부러 남긴다) 품목 탭을 누른 적 없는 사용자에게도 일어난다.
   * 조회 자체는 키워드 검색으로 정상 동작하지만, 말해 주지 않으면 "품목으로 찾고 있는데
   * 왜 이런 결과가" 가 된다.
   */
  const itemModeIgnored = criteria.mode === 'item' && !availableModes.includes('item');
  const mode: SearchMode = availableModes.includes(criteria.mode) ? criteria.mode : 'keyword';
  const layout = searchModeLayout(mode);
  const { notify } = useNotReady();

  /*
   * 첨부 전수조사(입찰 불가 조항)와 유사도 확장은 백엔드에서 작업 중이다.
   * 로컬 색인에는 첨부 본문도 임베딩도 아직 없다.
   *
   * 남아 있는 조작부는 **지우지 않는다.** 지우면 다음 웨이브에서 되살릴 자리를 잃고,
   * 사용자도 그런 기능이 있었다는 사실을 모르게 된다. 대신 손대면 준비 중임을 알린다.
   *
   * 예외가 '파일 내' 행이다(2026-08-28 삭제). 첨부 본문 검색은 준비 중 표시를 단 채로도
   * 키워드·품목 검색의 네 번째 줄을 차지해 왔는데, 통합 검색(`buildNoticeIndexQuery`)은
   * 이 조건을 아예 싣지 않아 눌러도 결과가 달라지지 않는 줄이었다. 조건 계층
   * (`criteria.fileKeywords` · `simFile` · `buildQuery` 의 `fileScan`)은 그대로 두었으므로,
   * 백엔드에 전역 파일 필터 계약이 생기면 이 파일에 행 하나만 다시 붙이면 된다.
   */
  const similarityPending = { label: '유사도 확장', notify };

  // 한 줄 입력은 확정 전까지 URL 에 올리지 않는다 — 글자마다 히스토리가 쌓이면 뒤로 가기가
  // 못 쓰게 된다. 확정(Enter · 검색 · 지우기)될 때만 URL 로 올라간다.
  const [insttDraft, setInsttDraft] = useState(criteria.insttNm);

  // 프리셋·뒤로 가기처럼 URL 이 밖에서 바뀌면 입력칸도 따라가야 한다.
  const syncedRef = useRef('');
  const signature = criteria.insttNm;
  if (syncedRef.current !== signature) {
    syncedRef.current = signature;
    if (insttDraft !== criteria.insttNm) setInsttDraft(criteria.insttNm);
  }

  // 원본은 init() 에서 기본 30일 범위를 넣고 시작했다. 조건이 URL 로 올라간 뒤에도 그
  // 기본값은 살아 있어야 한다 — 없으면 첫 조회가 전 기간을 훑는다.
  // replace 로 넣어 히스토리에 빈 URL 을 남기지 않는다.
  const seededRef = useRef(false);
  useEffect(() => {
    // '/' 와 옛 공고 표 주소는 다른 화면으로 넘기는 중간 경유지다. 여기서 파라미터를 심으면
    // 곧이어 일어나는 리다이렉트가 그것을 지우는데, '심었다'는 표시는 남아 목적지에서 다시
    // 심지 않는다 — 그러면 기본 조회 기간 없이 색인 전체를 훑는 질의가 나간다.
    // 목적지에 도착한 뒤에 심는다.
    if (isTransitRoute(location.pathname) || seededRef.current) return;
    seededRef.current = true;
    if (!criteria.fromDate && !criteria.toDate) {
      setCriteria(quickRange(DEFAULT_RANGE_DAYS), { replace: true });
    }
  }, [location.pathname, criteria.fromDate, criteria.toDate, setCriteria]);

  /**
   * 확정되지 않은 한 줄 입력을 URL 로 올린다. 원본 doSearch 의 앞부분(flushPendingTagInputs
   * + 입력값 읽기)과 같은 일이다.
   *
   * 반드시 **한 번의** setCriteria 로 끝내야 한다. 조건은 URL 이고, setCriteria 는 이번 렌더의
   * criteria 를 읽어 URL 전체를 다시 쓴다 — 한 이벤트에서 두 번 부르면 두 번째가 첫 번째를
   * 지운다. 그래서 칩 확정 같은 추가 변경도 patch 로 받아 여기서 합친다.
   */
  const commitDrafts = (patch: Partial<SearchCriteria> = {}) => {
    setCriteria({
      insttNm: insttDraft.trim(),
      ...patch,
    });
  };

  const activeQuickDays = QUICK_DATES.find((q) => {
    const range = quickRange(q.days);
    return range.fromDate === criteria.fromDate && range.toDate === criteria.toDate;
  })?.days;

  return (
    <>
      <section className="search-box" aria-label="공고 검색 조건">
        <SearchModeTabs
          mode={criteria.mode}
          availableModes={availableModes}
          onModeChange={(next) => setCriteria({ mode: next })}
        />
        {itemModeIgnored ? (
          <p className="search-mode-note" role="status">
            낙찰정보에는 품목 필드가 없어 <strong>입찰 결과에서는 품목 검색이 성립하지
            않습니다</strong> — 입력한 낱말로 키워드 검색을 합니다.
          </p>
        ) : null}

        <div className="bool-search">
          {layout.keywordRows ? (
            <>
              <TagInput
                kind="and"
                badgeLabel="모두 포함"
                placeholder={andPlaceholder(mode)}
                values={criteria.andTerms}
                onChange={(andTerms) => setCriteria({ andTerms })}
                onSubmit={(andTerms) => commitDrafts(andTerms ? { andTerms } : {})}
              />
              <TagInput
                kind="or"
                badgeLabel="하나 이상"
                placeholder="키워드 입력 후 Enter — 하나라도 포함되면 검색"
                values={criteria.orTerms}
                onChange={(orTerms) => setCriteria({ orTerms })}
                onSubmit={(orTerms) => commitDrafts(orTerms ? { orTerms } : {})}
                similarity={{
                  checked: criteria.simOr,
                  onChange: (simOr) => setCriteria({ simOr }),
                  title: '공고 제목을 대상으로 의미가 비슷한 말까지 찾습니다',
                  notReady: similarityPending,
                }}
              />
              <TagInput
                kind="not"
                badgeLabel="제외"
                placeholder="키워드 입력 후 Enter — 포함된 항목 제외"
                values={criteria.notTerms}
                onChange={(notTerms) => setCriteria({ notTerms })}
                onSubmit={(notTerms) => commitDrafts(notTerms ? { notTerms } : {})}
              />
            </>
          ) : null}

          {layout.insttRow ? (
            <div className="bool-row">
              <ClearableInput
                badgeClass="badge-instt"
                badgeLabel="발주기관"
                value={insttDraft}
                placeholder="발주기관명 입력 후 Enter — 기관명만으로 검색"
                onChange={setInsttDraft}
                onSubmit={commitDrafts}
                clearTitle="기관 초기화"
              />
            </div>
          ) : null}
        </div>

        {/*
          첨부문서 전수조사에 얹혀 있던 기능이라 함께 대기 중이다. 체크 상태는 조건에
          반영되지 않으므로 켜 둔 것처럼 보이면 안 된다 — 언제나 꺼진 채로 그린다.
        */}
        <label
          className="filter-check search-blocking-check not-ready-control"
          title="경쟁 제한 조항 자동 제외: 백엔드에서 작업 중입니다"
        >
          <input
            type="checkbox"
            checked={false}
            readOnly
            onChange={() => notify('입찰 불가 조항 자동 제외')}
          />{' '}
          입찰 불가 조항 자동 제외
        </label>

        <div className="search-footer">
          <div className="date-row">
            <label htmlFor="from-date">기간</label>
            <input
              id="from-date"
              type="date"
              value={criteria.fromDate}
              onChange={(e) => setCriteria({ fromDate: e.target.value })}
            />
            <span>~</span>
            <input
              id="to-date"
              type="date"
              aria-label="종료일"
              value={criteria.toDate}
              onChange={(e) => setCriteria({ toDate: e.target.value })}
            />
            <div className="quick-dates" aria-label="빠른 기간 선택">
              {QUICK_DATES.map((quick) => (
                <button
                  key={quick.days}
                  type="button"
                  className={activeQuickDays === quick.days ? 'quick-date active' : 'quick-date'}
                  onClick={() => setCriteria(quickRange(quick.days))}
                >
                  {quick.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn-text"
              onClick={() => setCriteria({ fromDate: '', toDate: '' })}
            >
              초기화
            </button>
          </div>
          {/* 인자 없이 불러야 한다 — 그대로 넘기면 MouseEvent 가 patch 로 들어간다. */}
          <button type="button" className="btn-search" onClick={() => commitDrafts()}>
            검색
          </button>
        </div>
      </section>
    </>
  );
}
