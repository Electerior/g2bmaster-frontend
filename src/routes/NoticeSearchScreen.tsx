/*
 * 공고 통합 검색 — 계획 · 사전규격 · 입찰 · 마감을 한 목록에서.
 *
 * 예전 표 화면 셋(발주 계획 · 사전 규격 · 입찰 공고)을 이 하나로 갈아 끼웠다. 넷은 서로 다른
 * 종류가 아니라 **같은 조달 건의 단계**라, 탭으로 갈라 두면 "이 사업이 지금 어디까지 왔나"를
 * 보려고 탭을 세 번 옮겨야 했다. 단계는 이제 탭이 아니라 필터다.
 *
 * 출처도 다르다. 예전 셋은 요청마다 나라장터를 팬아웃했지만 여기는 백엔드가 주기 적재해 둔
 * 로컬 색인만 본다. 그래서 부분 실패(`sourceErrors`)도, 캐시 표시(`_cached`)도 없다 —
 * 대신 **색인이 언제 것인지**를 상태 줄에 적는다. 그것이 이 계통에서 사용자가 알아야 하는
 * 유일한 신선도 정보다.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  useNoticeIndexSearch,
  useNoticeIndexStatus,
  type NoticeIndexItem,
} from '@/api/search';
import { EmptyState } from '@/components/feedback/EmptyState';
import { DataTable } from '@/components/table/DataTable';
import { Pagination } from '@/components/table/Pagination';
import { INDEX_PER_PAGE_OPTIONS, snapPerPage } from '@/components/table/perPage';
import { StatusBar } from '@/components/table/StatusBar';
import { columnsFor, SCREENS, type ColumnDef } from '@/domain/columns';
import { fmtDisplayDatetime } from '@/domain/format';
import { IndexCell, type IndexCellActions } from '@/features/notices/IndexCell';
import { indexRowKey } from '@/features/notices/indexRows';
import { IndexNoticeDrawer } from '@/features/notices/drawer/IndexNoticeDrawer';
import {
  NoticeFilterBar,
  type NoticeFilterValues,
} from '@/features/search/NoticeFilterBar';
import { NoticeSortSelect } from '@/features/search/NoticeSortSelect';
import { stageTotalOf, useNoticeFacetBars } from '@/features/search/useNoticeFacets';
import {
  buildNoticeIndexQuery,
  effectiveIndexSort,
  useSearchCriteria,
  type SearchCriteria,
} from '@/features/search/useSearchCriteria';
import { useSeoMeta } from '@/seo/useSeoMeta';
import '@/features/search/search.css';

const SCREEN = SCREENS['notice-search'];

/**
 * 처음 누른 정렬의 방향.
 *
 * 서버 규칙과 맞춰 둔다: 마감 임박은 '가까운 것부터'가 자연스러워 오름차순이고, 이름은
 * 가나다순이 자연스럽다. 나머지(최신·금액·관련도)는 큰 값이 위로 와야 한다.
 */
function initialDirFor(key: string): 'asc' | 'desc' {
  return key === 'close' || key === 'name' ? 'asc' : 'desc';
}

/** 색인이 마지막으로 갱신된 시각 — 분류별 값 중 가장 최근 것. */
function lastIndexedAt(rows: ReadonlyArray<{ last_indexed_at?: string | null }> | undefined) {
  const stamps = (rows ?? [])
    .map((row) => String(row.last_indexed_at ?? ''))
    .filter(Boolean)
    .sort();
  return stamps.length ? stamps[stamps.length - 1] : '';
}

export function NoticeSearchScreen() {
  const { criteria, setCriteria, setPage } = useSearchCriteria();
  const [selected, setSelected] = useState<NoticeIndexItem | null>(null);
  const columns = columnsFor('notice-search');

  // 제목만이 아니라 description · canonical · og:* 까지 이 한 줄이 세운다.
  useSeoMeta();

  /*
   * 선택지에 없는 페이지 크기가 URL 로 들어올 수 있다(옛 '전체'=99999 링크, 입찰 결과 탭에서
   * '전체'를 고른 뒤 넘어오는 경우). 질의와 선택 상자가 같은 값을 쓰도록 여기서 한 번 맞춘다.
   */
  const perPageChoice = snapPerPage(criteria.perPage);
  const query = useMemo(
    () => buildNoticeIndexQuery(criteria, { perPage: perPageChoice }),
    [criteria, perPageChoice],
  );
  const search = useNoticeIndexSearch(query);
  // 축마다 자기 필터를 뺀 건수 — 이유는 useNoticeFacets 주석 참고.
  const facets = useNoticeFacetBars(criteria);
  const status = useNoticeIndexStatus();

  const data = search.data;
  const items = data?.items ?? [];
  const attachmentSearch = data?.meta?.attachmentSearch;
  const sort = effectiveIndexSort(criteria);
  const perPage = data?.numOfRows || perPageChoice;
  const totalPages = Math.max(1, Math.ceil((data?.totalCount ?? 0) / (perPage || 20)));

  const actions: IndexCellActions = {
    openDetail: setSelected,
    // 같은 화면 안에서 조건만 좁힌다 — 사전규격에서 이어진 공고를 보려고 화면을 옮길 이유가 없다.
    crossToSpec: (beforeSpecRgstNo) => setCriteria({ beforeSpecRgstNo, category: '' }),
  };

  const renderCell = (item: NoticeIndexItem, column: ColumnDef): ReactNode => (
    <IndexCell
      item={item}
      column={column}
      actions={actions}
      attachmentSearchApplied={attachmentSearch?.applied === true}
    />
  );

  const onSort = (key: string) => {
    const sameKey = sort.key === key;
    setCriteria({
      sortKey: key,
      // 같은 컬럼을 다시 누르면 방향만 뒤집는다 — 기존 표와 같은 손맛.
      sortDir: sameKey ? (sort.dir === 'asc' ? 'desc' : 'asc') : initialDirFor(key),
    });
  };

  const period =
    criteria.fromDate && criteria.toDate
      ? { from: criteria.fromDate, to: criteria.toDate }
      : undefined;

  const notes: string[] = [];
  const indexedAt = lastIndexedAt(status.data?.summary);
  if (indexedAt) notes.push(`색인 ${fmtDisplayDatetime(indexedAt)} 기준`);
  if (criteria.beforeSpecRgstNo) notes.push(`사전규격 ${criteria.beforeSpecRgstNo} 연결 건`);
  if (criteria.detailProductCode) notes.push(`품명번호 ${criteria.detailProductCode}*`);
  if (attachmentSearch?.scope === false) notes.push('첨부 검색 범위 꺼짐');
  if (attachmentSearch?.skippedTerms?.length) {
    notes.push(`첨부 검색 제외 낱말 ${attachmentSearch.skippedTerms.join(', ')}`);
  }
  if (
    attachmentSearch?.indexedNotices != null &&
    attachmentSearch.totalNotices != null
  ) {
    notes.push(
      `첨부 색인 ${attachmentSearch.indexedNotices.toLocaleString()}/${attachmentSearch.totalNotices.toLocaleString()}건`,
    );
  }
  /*
   * 금액 조건은 **금액이 적힌 공고만** 볼 수 있다. 원본에 금액이 없는 공고(실측 2,180건,
   * 대부분 계획 단계와 예산을 공개하지 않는 누리장터 민간공고)는 조건을 거는 순간 통째로 빠진다.
   * 적지 않으면 화면에서는 "그 금액대 공고가 없다"와 구분되지 않는다 — 첨부 검색의 색인 범위를
   * 화면에 적는 것과 같은 이유다. 줄일 수 있는 손실이 아니므로 숨기지 않고 말한다.
   */
  if (criteria.minAmount || criteria.maxAmount) notes.push('금액 미공개 공고 제외');

  const renderStatusBar = (): ReactNode => {
    if (search.error) return <StatusBar error message={`오류: ${search.error.message}`} />;
    if (!data) return null;
    return (
      <StatusBar
        total={data.totalCount}
        period={period}
        page={{ current: criteria.pageNo, total: totalPages }}
        notes={notes}
      />
    );
  };

  const filterValues: NoticeFilterValues = {
    category: criteria.category,
    // 조건 쪽에서는 기존 4탭과 같은 bidType 자리를 쓴다 — 값 집합만 '외자'까지 넓혔다.
    division: criteria.bidType,
    noticeState: criteria.noticeState,
    region: criteria.region,
    closeFrom: criteria.closeFrom,
    closeTo: criteria.closeTo,
    minAmount: criteria.minAmount,
    maxAmount: criteria.maxAmount,
    activeOnly: criteria.activeOnly,
  };

  return (
    <section className="panel" aria-label={SCREEN.label}>
      <div className="result-topbar">
        <div className="topbar-left">
          {renderStatusBar()}
          <NoticeFilterBar
            values={filterValues}
            facets={facets}
            totalCount={stageTotalOf(facets, data?.totalCount ?? 0)}
            onChange={(patch) => {
              // division 만 이름이 다르다 — 나머지는 조건 필드와 이름이 같다.
              const { division, ...rest } = patch;
              const next: Partial<SearchCriteria> = { ...rest };
              if (division !== undefined) next.bidType = division;
              setCriteria(next);
            }}
          />
        </div>
        {/*
          정렬은 폭과 무관하게 여기서 항상 보인다. 표 머리글은 열이 접히면 함께 사라지고,
          관련도순은 대응하는 열이 아예 없다 — NoticeSortSelect 주석 참고.
        */}
        <NoticeSortSelect
          selected={criteria.sortKey}
          effective={sort}
          onChange={(patch) => setCriteria(patch)}
        />
      </div>

      <DataTable<NoticeIndexItem>
        // 핵심 열만 두고 상세는 서랍으로 — 표 하한이 레거시 4탭(1580px)이 아니라 940px 이 된다.
        compact
        columns={columns}
        rows={items}
        rowKey={indexRowKey}
        sort={sort}
        onSort={onSort}
        renderCell={renderCell}
        loading={search.isPending}
        /*
          결과 집합을 바꾸는 조건(단계·구분·상태·지역·기간·금액·검색어)만 전환 키에 넣는다.
          정렬·페이지는 같은 결과의 순서/조각이라 넣지 않는다 — 넣으면 페이지를 넘길 때마다
          표가 깜빡인다. 이 키가 바뀌면 tbody 가 부드럽게 페이드-인 된다.
        */
        transitionKey={[
          criteria.category,
          criteria.bidType,
          criteria.noticeState,
          criteria.region,
          criteria.fromDate,
          criteria.toDate,
          criteria.closeFrom,
          criteria.closeTo,
          criteria.minAmount,
          criteria.maxAmount,
          criteria.andTerms.join(','),
          criteria.orTerms.join(','),
          criteria.notTerms.join(','),
        ].join('|')}
        empty={
          items.length === 0 && !search.isPending ? (
            <EmptyState>
              {/* 색인이 비어 있는 것과 조건이 좁은 것은 다른 문제다 — 구분해서 알린다. */}
              {indexedAt
                ? '검색 결과가 없습니다. 조건을 넓히거나 단계 필터를 풀어 보세요.'
                : '색인이 아직 비어 있습니다. 백엔드 적재가 한 번 돌아야 결과가 보입니다.'}
            </EmptyState>
          ) : null
        }
      />

      {items.length > 0 ? (
        <Pagination
          page={criteria.pageNo}
          totalPages={totalPages}
          perPage={perPageChoice}
          options={INDEX_PER_PAGE_OPTIONS}
          onPage={(next) => {
            setPage(next);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onPerPage={(next) => setCriteria({ perPage: next })}
        />
      ) : null}

      {selected ? (
        <IndexNoticeDrawer seed={selected} onClose={() => setSelected(null)} />
      ) : null}
    </section>
  );
}
