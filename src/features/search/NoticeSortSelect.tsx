/*
 * 정렬 선택기 — 결과 상태 줄 오른쪽.
 *
 * 표 머리글만으로는 정렬을 다 다룰 수 없다. 두 가지가 머리글 밖에 있기 때문이다.
 *
 * 1. **관련도(`relevance`)에는 대응하는 열이 없다.** 계약 §A-2 의 기본 정렬은 조건에 따라
 *    달라서(검색어가 있으면 relevance, 없으면 created) 검색어를 넣는 순간 목록이 관련도순으로
 *    바뀌는데, 그 사실을 알릴 자리가 표에 없었다.
 * 2. **좁은 화면에서는 열이 접힌다.** 공고일은 1180px 아래에서 숨는데, 검색어가 없을 때의
 *    기본 정렬이 바로 그 열이다. 머리글이 사라지면 무엇으로 정렬돼 있는지 볼 수도, 되돌릴
 *    수도 없다(table.css 의 창 폭 대응 참고).
 *
 * 그래서 정렬은 폭과 무관하게 여기서 항상 보이고 항상 바꿀 수 있어야 한다. 표 머리글은
 * 그대로 둔다 — 넓은 화면에서 열을 바로 누르는 손맛이 더 빠르다. 둘은 같은 상태를 본다.
 */
import { NOTICE_SORT_KEYS, type NoticeSortKey } from '@/api/search';
import type { SortDir } from './useSearchCriteria';

/**
 * 정렬 키의 화면 이름.
 *
 * 표에 열이 있는 것은 그 열의 머리글과 같은 말을 쓴다 — 둘이 갈라지면 같은 정렬을 두 이름으로
 * 부르게 된다. `relevance`·`updated` 는 열이 없어 여기서만 쓰는 이름이다.
 */
const SORT_LABEL: Readonly<Record<NoticeSortKey, string>> = {
  relevance: '관련도',
  created: '공고일',
  close: '마감일시',
  name: '공고명',
  amount: '금액',
  updated: '색인 갱신',
};

interface NoticeSortSelectProps {
  /** 사용자가 고른 키. 빈 문자열이면 고르지 않은 것이고, 서버의 조건부 기본값이 적용된다. */
  selected: string;
  /** 지금 실제로 적용된 정렬 — 고르지 않았을 때 무엇이 걸려 있는지 적기 위해 받는다. */
  effective: { key: string; dir: SortDir };
  onChange: (patch: { sortKey: string; sortDir: SortDir }) => void;
}

function labelOf(key: string): string {
  return SORT_LABEL[key as NoticeSortKey] ?? key;
}

export function NoticeSortSelect({ selected, effective, onChange }: NoticeSortSelectProps) {
  const dirLabel = effective.dir === 'asc' ? '오름차순' : '내림차순';

  return (
    <div className="sort-picker">
      <label className="sort-picker-field">
        <span>정렬</span>
        <select
          value={selected}
          onChange={(e) => {
            const key = e.target.value;
            // '기본' 로 되돌리면 sortKey 를 비운다 — 그래야 질의에 sort 가 실리지 않고
            // 서버의 조건부 기본값(검색어 있으면 relevance, 없으면 created)이 다시 산다.
            onChange({ sortKey: key, sortDir: key === 'close' || key === 'name' ? 'asc' : 'desc' });
          }}
        >
          {/* 고르지 않은 상태에도 무엇이 걸려 있는지 적는다. 빈 칸으로 두면 정렬이 없는 것처럼 보인다. */}
          <option value="">기본 — {labelOf(effective.key)}순</option>
          {NOTICE_SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {SORT_LABEL[key]}순
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="sort-dir-btn"
        // 방향만 뒤집는다. 아직 고르지 않았다면 지금 걸려 있는 키를 그대로 굳히고 방향을 바꾼다 —
        // 그러지 않으면 방향을 누르는 순간 정렬 키까지 함께 바뀐 것처럼 보인다.
        onClick={() =>
          onChange({
            sortKey: selected || effective.key,
            sortDir: effective.dir === 'asc' ? 'desc' : 'asc',
          })
        }
        aria-label={`정렬 방향 — 현재 ${dirLabel}`}
        title={dirLabel}
      >
        {effective.dir === 'asc' ? '▲' : '▼'}
      </button>
    </div>
  );
}
