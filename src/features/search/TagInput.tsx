/*
 * 키워드 칩 입력 — 원본 addTag/removeTag/renderTags/commitTagInput(app.js:1104~1143).
 *
 * 확정 규칙은 원본 그대로다.
 *  - Enter  : 확정하고 검색까지 실행 (입력이 비어 있으면 검색만)
 *  - ','    : 확정만 (검색은 안 함) — 여러 개를 이어서 칠 수 있어야 한다
 *  - Backspace(빈 상태) : 마지막 칩 제거
 *  - blur / change      : 확정 (검색은 안 함) — 타이핑해 놓고 버튼을 누르는 사람이 많다
 *
 * 원본이 `onclick="removeTag('and','…')"` 로 문자열 안에 값을 끼워 넣던 부분이 사라졌다.
 * 그 자리는 따옴표가 든 키워드에서 조용히 깨지던 곳이다.
 */
import { useState, type KeyboardEvent } from 'react';
import './search.css';

export type TagKind = 'and' | 'or' | 'not' | 'file';

interface TagInputProps {
  kind: TagKind;
  /** 왼쪽 배지 문구 — 모두 포함 / 하나 이상 / 제외 / 파일 내. */
  badgeLabel: string;
  placeholder: string;
  values: readonly string[];
  onChange: (values: string[]) => void;
  /**
   * Enter — 검색. 이때 새로 확정된 칩이 있으면 그 배열을 함께 넘긴다.
   *
   * onChange 와 나눠 부르면 안 된다: 둘 다 같은 렌더의 조건 객체를 읽어 URL 을 새로 쓰므로,
   * 나중 호출이 먼저 호출의 결과(방금 넣은 칩)를 덮어쓴다. 한 번에 넘겨 호출부가 하나의
   * 갱신으로 합치게 한다.
   */
  onSubmit: (committed: string[] | null) => void;
  /** 유사도 토글이 붙는 행(하나 이상 · 파일 내)만 준다. */
  similarity?: { checked: boolean; onChange: (checked: boolean) => void; title: string };
}

export function TagInput({
  kind,
  badgeLabel,
  placeholder,
  values,
  onChange,
  onSubmit,
  similarity,
}: TagInputProps) {
  const [draft, setDraft] = useState('');

  /** 원본 addTag: 앞뒤 공백과 콤마를 떼고, 이미 있으면 넣지 않는다. */
  const commit = (raw: string): string[] | null => {
    const value = raw.trim().replace(/,+/g, '');
    if (!value || values.includes(value)) return null;
    return [...values, value];
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const hasDraft = draft.trim().length > 0;

    if (e.key === 'Enter') {
      e.preventDefault();
      if (!hasDraft) {
        onSubmit(null);
        return;
      }
      const next = commit(draft);
      setDraft('');
      onSubmit(next);
      return;
    }
    if (e.key === ',' && hasDraft) {
      e.preventDefault();
      const next = commit(draft);
      setDraft('');
      if (next) onChange(next);
      return;
    }
    if (e.key === 'Backspace' && !draft && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  const handleBlur = () => {
    if (!draft.trim()) return;
    const next = commit(draft);
    setDraft('');
    if (next) onChange(next);
  };

  return (
    <div className="bool-row">
      <span className={`bool-badge badge-${kind}`}>{badgeLabel}</span>
      {/* 칩 사이 빈 곳을 눌러도 입력으로 들어가야 한다 — 원본 wrap 의 click → focus. */}
      <label className="tag-wrap">
        <span className="sr-only">{badgeLabel} 키워드</span>
        {values.map((value) => (
          <span key={value} className={`qtag qtag-${kind}`}>
            {value}
            <button
              type="button"
              aria-label={`${value} 제거`}
              onClick={() => onChange(values.filter((v) => v !== value))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="tag-text"
          value={draft}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          inputMode="search"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
      </label>
      {similarity ? (
        <label className="sim-toggle" title={similarity.title}>
          <input
            type="checkbox"
            checked={similarity.checked}
            onChange={(e) => similarity.onChange(e.target.checked)}
          />{' '}
          유사도
        </label>
      ) : null}
    </div>
  );
}
