/*
 * 통합 검색의 검색창.
 *
 * 랜딩(입찰 공고) 화면의 `<section class="search-box">` 와 **같은 클래스·같은 배치**를 쓴다
 * (.bool-search / .bool-row / .bool-badge / .search-footer / .date-row / .btn-search).
 * 화면이 하나 늘었다고 검색창의 생김새가 달라지면 사용자는 다른 제품에 온 줄 안다.
 *
 * 랜딩과 다른 것은 조건의 종류뿐이다. 여기서는 생애주기 단계(계획·사전규격·입찰·마감)와
 * 지역이 1급 필터이고, 첨부 전수조사·유사도 같은 팬아웃 전용 조건은 없다(색인에 없다).
 */
import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, DIVISIONS, type NoticeFacets } from '@/api/searchNotices';
import { fmtInputDate } from '@/domain/format';
import type { IndexCriteria } from './useIndexCriteria';
import '@/features/search/search.css';
import './searchIndex.css';

/** 랜딩의 setQuickDateRange 와 같은 규칙 — 오늘부터 N일 전까지. */
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

const STATES = ['취소', '재', '다시', '정정'] as const;

interface Props {
  criteria: IndexCriteria;
  setCriteria: (patch: Partial<IndexCriteria>) => void;
  facets?: NoticeFacets;
}

/** 패싯 건수를 이름으로 찾는다. 집계가 아직 안 왔으면 undefined — 칩은 건수 없이 그린다. */
function countOf(buckets: NoticeFacets[keyof NoticeFacets] | undefined, value: string) {
  return buckets?.find((bucket) => bucket.value === value)?.count;
}

/** 선택형 칩 한 줄. '전체'가 항상 맨 앞에 오고, 빈 문자열이 그 값이다. */
function ChipRow({
  label,
  options,
  value,
  counts,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  counts?: NoticeFacets[keyof NoticeFacets];
  onChange: (next: string) => void;
}) {
  return (
    <div className="type-filter" aria-label={`${label} 필터`}>
      <span className="type-filter-label">{label}</span>
      <button
        type="button"
        className={value === '' ? 'type-filter-btn active' : 'type-filter-btn'}
        onClick={() => onChange('')}
      >
        전체
      </button>
      {options.map((option) => {
        const count = countOf(counts, option);
        return (
          <button
            key={option}
            type="button"
            className={value === option ? 'type-filter-btn active' : 'type-filter-btn'}
            onClick={() => onChange(value === option ? '' : option)}
          >
            {option}
            {count === undefined ? null : <span className="chip-count">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function IndexSearchHeader({ criteria, setCriteria, facets }: Props) {
  // 한 줄 입력은 확정(Enter · 검색 버튼)될 때만 URL 로 올린다 — 글자마다 히스토리가 쌓이면
  // 뒤로 가기를 못 쓰게 된다. 랜딩의 SearchHeader 와 같은 규칙이다.
  const [qDraft, setQDraft] = useState(criteria.q);
  const [insttDraft, setInsttDraft] = useState(criteria.insttNm);

  // 프리셋·뒤로 가기처럼 URL 이 밖에서 바뀌면 입력칸도 따라가야 한다.
  const syncedRef = useRef('');
  const signature = `${criteria.q}|${criteria.insttNm}`;
  if (syncedRef.current !== signature) {
    syncedRef.current = signature;
    if (qDraft !== criteria.q) setQDraft(criteria.q);
    if (insttDraft !== criteria.insttNm) setInsttDraft(criteria.insttNm);
  }

  useEffect(() => {
    document.title = '공고 통합 검색 — G2B Masters';
  }, []);

  const commit = (patch: Partial<IndexCriteria> = {}) =>
    setCriteria({ q: qDraft.trim(), insttNm: insttDraft.trim(), ...patch });

  const activeQuickDays = QUICK_DATES.find((quick) => {
    const range = quickRange(quick.days);
    return range.fromDate === criteria.fromDate && range.toDate === criteria.toDate;
  })?.days;

  return (
    <section className="search-box" aria-label="공고 통합 검색 조건">
      <div className="bool-search">
        <div className="bool-row">
          <span className="bool-badge badge-and">검색어</span>
          <div className="instt-wrap">
            <input
              className="instt-input"
              value={qDraft}
              placeholder="공고명·품명·본문에서 검색 — 여러 낱말은 모두 포함(AND)"
              autoComplete="off"
              aria-label="검색어"
              onChange={(e) => setQDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commit();
                }
              }}
            />
            {qDraft ? (
              <button
                type="button"
                className="btn-clear-instt"
                title="검색어 초기화"
                aria-label="검색어 초기화"
                onClick={() => {
                  setQDraft('');
                  setCriteria({ q: '' });
                }}
              >
                ×
              </button>
            ) : null}
          </div>
        </div>

        <div className="bool-row">
          <span className="bool-badge badge-instt">발주기관</span>
          <div className="instt-wrap">
            <input
              className="instt-input"
              value={insttDraft}
              placeholder="기관명 입력 후 Enter — 공고기관·수요기관 모두에서 찾는다"
              autoComplete="off"
              aria-label="발주기관"
              onChange={(e) => setInsttDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commit();
                }
              }}
            />
            {insttDraft ? (
              <button
                type="button"
                className="btn-clear-instt"
                title="기관 초기화"
                aria-label="기관 초기화"
                onClick={() => {
                  setInsttDraft('');
                  setCriteria({ insttNm: '' });
                }}
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* 생애주기 단계가 이 화면의 1급 필터다 — 랜딩에서는 탭이었던 것이 여기서는 칩이다. */}
      <ChipRow
        label="단계"
        options={CATEGORIES}
        value={criteria.category}
        counts={facets?.category}
        onChange={(category) => {
          // '마감' 단계는 activeOnly 와 양립할 수 없어 훅이 강제로 끈다(useIndexCriteria).
          // 벗어날 때는 기본값(켜짐)으로 되돌린다 — 꺼진 채 남으면 다른 단계에서 마감 공고가
          // 소리 없이 섞여 나오는 화면이 된다.
          setCriteria(
            criteria.category === '마감' && category !== '마감'
              ? { category, activeOnly: true }
              : { category },
          );
        }}
      />
      <ChipRow
        label="구분"
        options={DIVISIONS}
        value={criteria.division}
        counts={facets?.division}
        onChange={(division) => setCriteria({ division })}
      />
      <ChipRow
        label="상태"
        options={STATES}
        value={criteria.state}
        counts={facets?.state}
        onChange={(state) => setCriteria({ state })}
      />

      {/* 지역은 값이 많아 칩 대신 목록이다. 선택지는 패싯이 준다 — 색인에 실제로 있는 지역만 뜬다. */}
      <div className="index-filter-row">
        <label className="index-field">
          <span className="index-field-label">지역</span>
          <select
            value={criteria.region}
            onChange={(e) => setCriteria({ region: e.target.value })}
            aria-label="지역"
          >
            <option value="">전체</option>
            {(facets?.region ?? []).map((bucket) => (
              <option key={bucket.value} value={bucket.value}>
                {bucket.value} ({bucket.count})
              </option>
            ))}
          </select>
        </label>

        <label className="index-field">
          <span className="index-field-label">세부품명번호</span>
          <input
            type="text"
            value={criteria.detailProductCode}
            placeholder="예: 4110 (상위 분류로도 검색)"
            onChange={(e) => setCriteria({ detailProductCode: e.target.value })}
          />
        </label>

        <label className="index-field">
          <span className="index-field-label">추정가격</span>
          <input
            type="number"
            value={criteria.minAmount}
            placeholder="최소"
            min={0}
            onChange={(e) => setCriteria({ minAmount: e.target.value })}
          />
          <span className="index-field-sep">~</span>
          <input
            type="number"
            value={criteria.maxAmount}
            placeholder="최대"
            min={0}
            onChange={(e) => setCriteria({ maxAmount: e.target.value })}
          />
        </label>
      </div>

      <div className="search-footer">
        <div className="date-row">
          <label htmlFor="index-from-date">공고일</label>
          <input
            id="index-from-date"
            type="date"
            value={criteria.fromDate}
            onChange={(e) => setCriteria({ fromDate: e.target.value })}
          />
          <span>~</span>
          <input
            type="date"
            aria-label="공고일 종료"
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

        <label
          className="filter-check"
          title={
            criteria.category === '마감'
              ? "'마감' 단계는 이미 마감된 공고만 모으므로 이 옵션과 함께 쓸 수 없습니다."
              : '마감일시가 지나지 않은 공고만 보여줍니다.'
          }
        >
          <input
            type="checkbox"
            checked={criteria.activeOnly}
            disabled={criteria.category === '마감'}
            onChange={(e) => setCriteria({ activeOnly: e.target.checked })}
          />{' '}
          마감 전 공고만 보기
        </label>

        <button type="button" className="btn-search" onClick={() => commit()}>
          검색
        </button>
      </div>
    </section>
  );
}
