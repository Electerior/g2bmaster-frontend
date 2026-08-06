/*
 * 우측 슬라이드인 서랍의 껍데기.
 *
 * 원본은 서랍이 DOM 에 늘 존재하고 .hidden 을 붙였다 뗐다 했다(app.js:4252). 그래서 서랍
 * 내용이 닫힌 뒤에도 남아 있었고, 다음에 열 때 이전 공고의 요약이 잠깐 보였다. React 에서는
 * 열릴 때만 마운트한다 — 그 잔상 문제가 구조적으로 사라진다.
 *
 * 껍데기가 책임지는 것은 셋뿐이다: 오버레이, Esc, body 스크롤 잠금.
 * 안의 내용(머리·메타·본문)은 변종별 컴포넌트가 채운다.
 */
import { Fragment, useEffect, type ReactNode } from 'react';
import './overlay.css';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** 스크린리더용 이름. 보통 공고명. */
  label?: string;
}

export function Drawer({ open, onClose, children, label = '상세 정보' }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    // 서랍이 뜬 채로 뒤 페이지가 스크롤되면 서랍만 제자리에 남아 배경이 흘러간다.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="overlay-scrim"
        aria-label="닫기"
        tabIndex={-1}
        onClick={onClose}
      />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </aside>
    </>
  );
}

interface DrawerHeaderProps {
  /** 구분 배지(물품/용역/공사 또는 발주계획·사전규격). */
  badge: ReactNode;
  onClose: () => void;
}

export function DrawerHeader({ badge, onClose }: DrawerHeaderProps) {
  return (
    <div className="drawer-header">
      {badge}
      <button type="button" className="drawer-close" onClick={onClose} aria-label="서랍 닫기">
        ×
      </button>
    </div>
  );
}

/** 메타 격자의 한 줄. 값이 비면 아예 그리지 않는다 — 원본의 `.filter(([, v]) => v)`. */
export interface MetaRow {
  label: string;
  value: ReactNode;
}

interface DrawerMetaProps {
  rows: readonly MetaRow[];
  /** 격자 아래에 붙는 접이식 블록들. */
  children?: ReactNode;
}

export function DrawerMeta({ rows, children }: DrawerMetaProps) {
  return (
    <div className="drawer-meta">
      {rows.map((row) => (
        <Fragment key={row.label}>
          <div className="meta-key">{row.label}</div>
          <div className="meta-val">{row.value}</div>
        </Fragment>
      ))}
      {children}
    </div>
  );
}
