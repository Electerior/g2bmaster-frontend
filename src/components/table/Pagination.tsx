/*
 * 페이지네이션 — 원본 renderPagination(app.js:5410).
 * 10페이지 블록 창(현재 페이지가 속한 10개 묶음)과 페이지당 행 수 선택이 한 줄에 온다.
 */
import './table.css';

/** '전체' 는 서버가 문자열 'all' 로 받는다(server.js:1015). 화면에서는 이 상수로 표현한다. */
export const PER_PAGE_ALL = 99999;

const PER_PAGE_OPTIONS = [
  { value: 20, label: '20개' },
  { value: 50, label: '50개' },
  { value: 100, label: '100개' },
  { value: PER_PAGE_ALL, label: '전체' },
] as const;

const BLOCK_SIZE = 10;

interface PaginationProps {
  page: number;
  totalPages: number;
  perPage: number;
  onPage: (page: number) => void;
  onPerPage: (perPage: number) => void;
}

export function Pagination({ page, totalPages, perPage, onPage, onPerPage }: PaginationProps) {
  const block = Math.floor((page - 1) / BLOCK_SIZE);
  const start = block * BLOCK_SIZE + 1;
  const end = Math.min(start + BLOCK_SIZE - 1, totalPages);
  const pages: number[] = [];
  for (let p = start; p <= end; p += 1) pages.push(p);

  return (
    <nav className="pagination" aria-label="페이지 이동">
      {totalPages > 1 ? (
        <>
          <button
            type="button"
            disabled={page === 1}
            onClick={() => onPage(page - 1)}
            aria-label="이전 페이지"
          >
            &#8249;
          </button>
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              className={p === page ? 'active' : undefined}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            disabled={page === totalPages}
            onClick={() => onPage(page + 1)}
            aria-label="다음 페이지"
          >
            &#8250;
          </button>
        </>
      ) : null}
      <select
        className="per-page-select"
        aria-label="페이지당 표시 건수"
        value={String(perPage)}
        onChange={(e) => onPerPage(Number(e.target.value))}
      >
        {PER_PAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </nav>
  );
}
