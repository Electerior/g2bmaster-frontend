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
import { useEffect, useRef, useState, type CompositionEvent, type KeyboardEvent } from 'react';
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
  /**
   * 유사도 토글이 붙는 행(하나 이상 · 파일 내)만 준다.
   * `notReady` 가 붙으면 토글은 그려지되 조건을 바꾸지 않고 알림만 띄운다.
   */
  similarity?: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    title: string;
    notReady?: NotReadyMark;
  };
  /**
   * 백엔드가 아직 이 조건을 받지 못할 때. 입력은 화면에 **남기되** 조건으로는 나가지 않고,
   * 손대는 순간 준비 중임을 알린다. 지워 버리면 다음 웨이브에서 되살릴 자리를 잃는다.
   */
  notReady?: NotReadyMark;
}

export interface NotReadyMark {
  label: string;
  notify: (label: string) => void;
}

export function TagInput({
  kind,
  badgeLabel,
  placeholder,
  values,
  onChange,
  onSubmit,
  similarity,
  notReady,
}: TagInputProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const submitAfterCompositionRef = useRef(false);
  const compositionEndedAtRef = useRef(Number.NEGATIVE_INFINITY);
  const suppressEnterUntilRef = useRef(Number.NEGATIVE_INFINITY);
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 원본 addTag: 앞뒤 공백과 콤마를 떼고, 이미 있으면 넣지 않는다. */
  const commit = (raw: string): string[] | null => {
    const value = raw.trim().replace(/,+/g, '');
    if (!value || values.includes(value)) return null;
    return [...values, value];
  };

  const submitRaw = (raw: string) => {
    if (!raw.trim()) {
      onSubmit(null);
      return;
    }
    const next = commit(raw);
    setDraft('');
    onSubmit(next);
  };

  /**
   * 한글 IME 의 마지막 input/change 는 compositionend 뒤에 도착할 수 있다. 같은 이벤트 안에서
   * draft 를 비우면 마지막 음절이 새 입력으로 되살아나므로, 다음 태스크에서 DOM 최종값을 읽어
   * 딱 한 번 확정한다. Safari 는 compositionend 뒤에 같은 Enter keydown 을 보내기도 하므로
   * 짧은 억제 구간으로 그 후속 이벤트까지 삼킨다.
   */
  const submitAfterComposition = () => {
    if (submitTimerRef.current !== null) return;
    suppressEnterUntilRef.current = Date.now() + 100;
    submitTimerRef.current = setTimeout(() => {
      submitTimerRef.current = null;
      submitRaw(inputRef.current?.value ?? draft);
    }, 0);
  };

  useEffect(
    () => () => {
      if (submitTimerRef.current !== null) clearTimeout(submitTimerRef.current);
    },
    [],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const raw = e.currentTarget.value;
    const hasDraft = raw.trim().length > 0;
    const isComposing =
      composingRef.current || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229;

    if (e.key === 'Enter') {
      if (isComposing) {
        // 이 Enter 는 검색 제출이 아니라 IME 조합 확정이다. compositionend 에서 한 번만 제출한다.
        submitAfterCompositionRef.current = true;
        return;
      }
      e.preventDefault();
      const now = Date.now();
      if (now < suppressEnterUntilRef.current) return;
      if (now - compositionEndedAtRef.current < 100) {
        // Safari/WebKit: compositionend 가 Enter keydown 보다 먼저 오는 순서도 지원한다.
        submitAfterComposition();
        return;
      }
      if (!hasDraft) {
        onSubmit(null);
        return;
      }
      submitRaw(raw);
      return;
    }
    if (isComposing) return;
    if (e.key === ',' && hasDraft) {
      e.preventDefault();
      const next = commit(raw);
      setDraft('');
      if (next) onChange(next);
      return;
    }
    if (e.key === 'Backspace' && !raw && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  const handleCompositionStart = () => {
    composingRef.current = true;
    submitAfterCompositionRef.current = false;
  };

  const handleCompositionEnd = (_e: CompositionEvent<HTMLInputElement>) => {
    composingRef.current = false;
    compositionEndedAtRef.current = Date.now();
    if (!submitAfterCompositionRef.current) return;
    submitAfterCompositionRef.current = false;
    submitAfterComposition();
  };

  const handleBlur = () => {
    // 조합 Enter 로 예약된 제출이 있거나 방금 끝났다면 blur 가 같은 값을 다시 확정하면 안 된다.
    if (submitTimerRef.current !== null || Date.now() < suppressEnterUntilRef.current) return;
    if (!draft.trim()) return;
    const next = commit(draft);
    setDraft('');
    if (next) onChange(next);
  };

  if (notReady) {
    return (
      <div className="bool-row">
        <span className={`bool-badge badge-${kind}`}>{badgeLabel}</span>
        <button
          type="button"
          className="tag-wrap not-ready-control"
          onClick={() => notReady.notify(notReady.label)}
          title={`${notReady.label}: 백엔드에서 작업 중입니다`}
        >
          <span className="tag-text-disabled">{placeholder}</span>
        </button>
        {similarity ? (
          <span className="sim-toggle not-ready-control" title={similarity.title}>
            <input type="checkbox" checked={false} readOnly tabIndex={-1} aria-hidden="true" /> 유사도
          </span>
        ) : null}
      </div>
    );
  }

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
          ref={inputRef}
          className="tag-text"
          value={draft}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          inputMode="search"
          onChange={(e) => setDraft(e.target.value)}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
      </label>
      {similarity ? (
        <label
          className={similarity.notReady ? 'sim-toggle not-ready-control' : 'sim-toggle'}
          title={
            similarity.notReady
              ? `${similarity.notReady.label}: 백엔드에서 작업 중입니다`
              : similarity.title
          }
        >
          <input
            type="checkbox"
            // 준비 중일 때는 상태를 바꾸지 않는다 — 켜 두면 다음 검색이 조용히 달라진 것처럼
            // 보이는데 실제로는 아무것도 달라지지 않는다.
            checked={similarity.notReady ? false : similarity.checked}
            readOnly={Boolean(similarity.notReady)}
            onChange={(e) => {
              if (similarity.notReady) {
                similarity.notReady.notify(similarity.notReady.label);
                return;
              }
              similarity.onChange(e.target.checked);
            }}
          />{' '}
          유사도
        </label>
      ) : null}
    </div>
  );
}
