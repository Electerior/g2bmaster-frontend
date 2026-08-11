/*
 * 공고 통합 검색 — 계획 · 사전규격 · 입찰 · 마감을 한 목록에서.
 *
 * 화면 구조는 랜딩(입찰 공고)과 같다: 검색창(.search-box) → 결과 패널(.panel) 안에
 * 상태 줄(.result-topbar) · 표(DataTable) · 페이지네이션(Pagination). 같은 컴포넌트와
 * 같은 클래스를 쓰므로 두 화면이 한 제품으로 보인다.
 *
 * **다른 점 하나.** 이 화면은 나라장터를 호출하지 않는다. 백엔드가 주기적으로 쌓아 둔
 * 로컬 색인만 읽는다 — 그래서 응답이 빠르고 일정한 대신, 결과가 항상 '조금 과거'다.
 * 그 사실을 상태 줄에 색인 시각으로 적어 둔다(숨기면 사용자가 버그로 읽는다).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { DataTable } from '@/components/table/DataTable';
import { Pagination } from '@/components/table/Pagination';
import { StatusBar } from '@/components/table/StatusBar';
import { EmptyState } from '@/components/feedback/EmptyState';
import { TypeBadge } from '@/components/badges/Badge';
import type { ColumnDef } from '@/domain/columns';
import { fmtDisplayDate, fmtMoney } from '@/domain/format';
import {
  useIndexStatus,
  useNoticeIndexFacets,
  useNoticeIndexSearch,
  type NoticeIndexItem,
} from '@/api/searchNotices';
import { IndexSearchHeader } from '@/features/searchIndex/IndexSearchHeader';
import { IndexNoticeDrawer } from '@/features/searchIndex/IndexNoticeDrawer';
import { DdayCell, RegionCell, StageBadge } from '@/features/searchIndex/cells';
import { useIndexCriteria } from '@/features/searchIndex/useIndexCriteria';
import '@/features/searchIndex/searchIndex.css';

/**
 * 컬럼.
 *
 * `key` 는 **서버의 정렬 키**와 같은 문자열이다. DataTable 이 헤더 클릭 시 key 를 그대로
 * 돌려주므로, 같게 맞춰 두면 변환표가 필요 없다. 정렬을 지원하지 않는 컬럼은
 * {@link SORTABLE} 에 없으며 클릭해도 아무 일도 일어나지 않는다.
 */
const COLUMNS: readonly ColumnDef[] = [
  { label: '단계', key: 'stage' },
  { label: '구분', key: 'division' },
  { label: '공고명', key: 'name' },
  { label: '발주기관', key: 'institution' },
  { label: '지역', key: 'region' },
  { label: '추정가격', key: 'amount' },
  { label: '공고일', key: 'created' },
  { label: '마감일', key: 'close' },
  { label: 'D-DAY', key: 'dday' },
];

/** 서버가 실제로 정렬할 수 있는 키. 나머지 헤더는 눌러도 조용히 무시한다. */
const SORTABLE = new Set(['name', 'amount', 'created', 'close']);

/**
 * 발주기관 칸.
 *
 * <p>공고기관과 수요기관이 <b>다른 경우가 실제로 많다</b> — 조달청이 대행 공고하는 건이
 * 그렇다(공고기관 '조달청 강원지방조달청', 수요기관 '강원대학교'). 하나만 보여주면
 * 둘 중 어느 쪽이든 오해를 부른다: 공고기관만 쓰면 목록이 온통 '조달청'이 되어 누가
 * 실제로 사는지 알 수 없고, 수요기관만 쓰면 문의처를 잃는다. 그래서 다를 때만 둘 다 쓴다.
 *
 * <p>이름이 없으면 코드라도 보여준다 — 빈칸은 '기관 없음'으로 읽히지만 실제로는
 * '이름을 아직 못 받았음'이다.
 */
function InstitutionCell({ row }: { row: NoticeIndexItem }) {
  const notice = row.noticeInstitutionName ?? row.noticeInstitutionCode;
  const demand = row.demandInstitutionName ?? row.demandInstitutionCode;

  if (!notice && !demand) return <span className="muted">—</span>;
  if (!notice || !demand || notice === demand) {
    return <>{notice ?? demand}</>;
  }
  return (
    <>
      {notice}
      <div className="index-body-preview">수요 {demand}</div>
    </>
  );
}

export function NoticeSearchScreen() {
  const { criteria, setCriteria, query } = useIndexCriteria();
  const [selected, setSelected] = useState<NoticeIndexItem | null>(null);

  const search = useNoticeIndexSearch(query);
  const facets = useNoticeIndexFacets(query);
  const status = useIndexStatus();

  const rows = search.data?.items ?? [];
  const total = search.data?.totalCount ?? 0;
  const perPage = search.data?.numOfRows || criteria.perPage;
  const totalPages = Math.max(1, Math.ceil(total / (perPage || 20)));

  // 정렬 표시. URL 에 없으면 서버 기본값을 그대로 비춘다 —
  // 검색어가 있으면 관련도, 없으면 최신순이다.
  const sort = useMemo(
    () => ({
      key: criteria.sort || (criteria.q ? 'relevance' : 'created'),
      dir: (criteria.dir || (criteria.sort === 'close' ? 'asc' : 'desc')) as 'asc' | 'desc',
    }),
    [criteria.sort, criteria.dir, criteria.q],
  );

  /** 색인이 마지막으로 갱신된 시각 — 분류별 최댓값 중 가장 최근. */
  const lastIndexedAt = useMemo(() => {
    const times = (status.data?.summary ?? [])
      .map((row) => row.last_indexed_at)
      .filter((value): value is string => Boolean(value));
    return times.length ? times.reduce((a, b) => (a > b ? a : b)) : null;
  }, [status.data]);

  const renderCell = (row: NoticeIndexItem, column: ColumnDef): ReactNode => {
    switch (column.key) {
      case 'stage':
        return <StageBadge category={row.category} state={row.state} />;
      case 'division':
        return <TypeBadge value={row.businessDivision} />;
      case 'name':
        return (
          <>
            <button type="button" className="bid-link" onClick={() => setSelected(row)}>
              {row.noticeName || row.id}
            </button>
            {row.bodyPreview && row.bodyPreview !== row.noticeName ? (
              <div className="index-body-preview">{row.bodyPreview.slice(0, 110)}</div>
            ) : null}
          </>
        );
      case 'institution':
        return <InstitutionCell row={row} />;
      case 'region':
        return <RegionCell region={row.region} />;
      case 'amount':
        return row.estimatedPrice ? `${fmtMoney(row.estimatedPrice)}원` : <span className="muted">—</span>;
      case 'created':
        return fmtDisplayDate(row.createdDate ?? '');
      case 'close':
        return row.closeDate ? fmtDisplayDate(row.closeDate) : <span className="muted">—</span>;
      case 'dday':
        return <DdayCell dday={row.dday} />;
      default:
        return null;
    }
  };

  const renderStatusBar = (): ReactNode => {
    if (search.error) {
      return <StatusBar error message={`오류: ${search.error.message}`} />;
    }
    const notes: string[] = [];
    if (criteria.activeOnly) notes.push('마감 전만');
    if (criteria.q) notes.push(`관련도 순 · "${criteria.q}"`);

    return (
      <StatusBar
        total={total}
        page={{ current: criteria.page, total: totalPages }}
        period={
          criteria.fromDate && criteria.toDate
            ? { from: criteria.fromDate, to: criteria.toDate }
            : undefined
        }
        bidType={criteria.division || undefined}
        notes={notes}
        message={
          lastIndexedAt ? (
            <span className="index-freshness">
              로컬 색인 조회 · 마지막 갱신 <strong>{fmtDisplayDate(lastIndexedAt)}</strong>
            </span>
          ) : null
        }
      />
    );
  };

  return (
    <>
      <IndexSearchHeader criteria={criteria} setCriteria={setCriteria} facets={facets.data} />

      <section className="panel" aria-label="공고 통합 검색">
        <div className="result-topbar">
          <div className="topbar-left">{renderStatusBar()}</div>
        </div>

        <DataTable<NoticeIndexItem>
          columns={COLUMNS}
          rows={rows}
          rowKey={(row) => `${row.id}-${row.noticeOrder}`}
          sort={sort}
          onSort={(key) => {
            if (!SORTABLE.has(key)) return;
            setCriteria({
              sort: key,
              // 같은 컬럼을 다시 누르면 방향만 뒤집는다 — 랜딩의 표와 같은 동작.
              dir: sort.key === key && sort.dir === 'asc' ? 'desc' : 'asc',
            });
          }}
          renderCell={renderCell}
          loading={search.isPending}
          empty={
            rows.length === 0 && !search.isPending ? (
              <EmptyState>조건에 맞는 공고가 없습니다. 기간을 넓히거나 필터를 줄여보세요.</EmptyState>
            ) : null
          }
        />

        {rows.length > 0 ? (
          <Pagination
            page={criteria.page}
            totalPages={totalPages}
            perPage={criteria.perPage}
            onPage={(page) => {
              setCriteria({ page });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onPerPage={(next) => setCriteria({ perPage: next })}
          />
        ) : null}
      </section>

      <IndexNoticeDrawer selected={selected} onClose={() => setSelected(null)} />
    </>
  );
}
