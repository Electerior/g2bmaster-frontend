/*
 * 결과 표. 원본 renderTable(app.js:3908) + showLoading(3962) 을 하나로 합쳤다.
 *
 * 원본은 표를 innerHTML 문자열로 만들고, 정렬·행 클릭을 thead/tbody 에 위임 리스너로 붙였다.
 * 그래서 "이 행이 어떤 항목인가"를 data-id 로 다시 찾아야 했다(bidItemMap). React 에서는
 * 셀 렌더러가 행 객체를 그대로 받으므로 그 간접 참조가 통째로 사라진다.
 */
import { Fragment, type ReactNode } from 'react';
import type { ColumnDef, SortSpec } from '@/domain/columns';
import { columnClass } from './columnClass';
import './table.css';

export interface DataTableProps<T> {
  columns: readonly ColumnDef[];
  rows: readonly T[];
  rowKey: (row: T, index: number) => string;
  sort: SortSpec;
  onSort: (key: string) => void;
  renderCell: (row: T, column: ColumnDef, columnIndex: number) => ReactNode;
  /** 행에 붙일 추가 클래스(file-match-row · blocking-row). */
  rowClassName?: (row: T) => string | undefined;
  /**
   * 본 행 바로 뒤에 붙는 확장 행. `<tr>` 을 통째로 돌려줘야 한다 — 표 구조를 컴포넌트가
   * 대신 정해 버리면 발췌 행처럼 colSpan·클래스가 다른 변형을 만들 수 없다.
   */
  renderSubRow?: (row: T, colSpan: number) => ReactNode;
  loading?: boolean;
  /** 결과가 없을 때 표 아래에 보일 것. 표 자체는 헤더만 남는다. */
  empty?: ReactNode;
}

const SKELETON_ROWS = 5;

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  sort,
  onSort,
  renderCell,
  rowClassName,
  renderSubRow,
  loading = false,
  empty,
}: DataTableProps<T>) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column, i) => {
              const active = column.key === sort.key;
              // 같은 키가 두 번 나오는 표가 있다(사전 규격의 opninRgstClseDt = 의견마감 +
              // D-DAY). key 에 인덱스를 섞어야 React 가 두 컬럼을 구분한다.
              return (
                <th key={`${column.key}-${i}`} className={columnClass(column.key)}>
                  <button
                    type="button"
                    className="th-sortable"
                    onClick={() => onSort(column.key)}
                    aria-label={`${column.label} 정렬`}
                  >
                    {column.label}
                    <span className={active ? 'sort-icon active' : 'sort-icon'}>
                      {active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: SKELETON_ROWS }, (_, r) => (
                <tr key={`skeleton-${r}`} className="loading-row">
                  {columns.map((column, c) => (
                    <td key={`${column.key}-${c}`}>&nbsp;</td>
                  ))}
                </tr>
              ))
            : rows.map((row, index) => (
                <Fragment key={rowKey(row, index)}>
                  <tr className={rowClassName?.(row)}>
                    {columns.map((column, columnIndex) => (
                      <td key={`${column.key}-${columnIndex}`} className={columnClass(column.key)}>
                        {renderCell(row, column, columnIndex)}
                      </td>
                    ))}
                  </tr>
                  {renderSubRow?.(row, columns.length)}
                </Fragment>
              ))}
        </tbody>
      </table>
      {loading ? null : empty}
    </div>
  );
}
