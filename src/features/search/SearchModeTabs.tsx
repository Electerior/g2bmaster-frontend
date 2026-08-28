/*
 * 검색 방식 탭 — 원본 .search-mode-tabs / setSearchMode(app.js:1066).
 *
 * 공고 검색 안에서 키워드·품목·발주기관 조건만 전환한다.
 */
import type { SearchMode } from '@/domain/searchModes';
import './search.css';

interface ModeTab {
  mode: SearchMode;
  label: string;
}

/** 순서·문구는 원본 index.html(144~151행) 그대로. */
const MODE_TABS: readonly ModeTab[] = [
  { mode: 'keyword', label: '키워드 검색' },
  { mode: 'item', label: '품목 검색' },
  { mode: 'instt', label: '발주기관 검색' },
];

interface SearchModeTabsProps {
  /** URL 파라미터의 현재 검색 모드. */
  mode: SearchMode;
  /** 검색 모드를 URL 조건에 반영하는 setter. */
  onModeChange: (mode: SearchMode) => void;
}

export function SearchModeTabs({ mode, onModeChange }: SearchModeTabsProps) {
  return (
    <div className="search-mode-tabs" role="tablist" aria-label="검색 방식">
      {MODE_TABS.map((tab) => (
        <button
          key={tab.mode}
          type="button"
          role="tab"
          aria-selected={tab.mode === mode}
          className={tab.mode === mode ? 'search-mode-btn active' : 'search-mode-btn'}
          onClick={() => onModeChange(tab.mode)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
