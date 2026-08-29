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

/** 비활성 탭에 붙는 설명. 왜 못 쓰는지를 적지 않으면 고장으로 읽힌다. */
const UNAVAILABLE_HINT = '이 화면에서는 쓸 수 없는 검색 방식입니다.';

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
  /**
   * 이 화면에서 결과를 낼 수 있는 모드. 넘기지 않으면 전부 쓸 수 있다.
   *
   * 감추는 대신 **비활성으로 남기는** 이유는 이 저장소의 기존 규칙과 같다(notReadyContext
   * 주석 참고) — 탭이 사라지면 사용자는 그런 검색 방식이 있었다는 사실 자체를 모른다.
   * 다만 문구는 '준비 중'이 아니다. 입찰 결과의 품목 검색은 나중에 열리는 기능이 아니라
   * 낙찰정보에 품목 필드가 없어서 **구조적으로 성립하지 않는** 조합이다.
   */
  availableModes?: readonly SearchMode[];
}

export function SearchModeTabs({ mode, onModeChange, availableModes }: SearchModeTabsProps) {
  const usable = (tab: SearchMode) => !availableModes || availableModes.includes(tab);
  /*
   * 쓸 수 없는 모드가 URL 에 남아 있으면(탭을 넘어와도 mode 는 보존된다) 실제 조회는
   * 키워드 검색으로 나간다 — buildQuery 가 searchField 를 싣지 않기 때문이다. 그때
   * 활성 탭도 키워드로 그려야 화면과 결과가 같은 말을 한다.
   */
  const activeMode = usable(mode) ? mode : 'keyword';

  return (
    <div className="search-mode-tabs" role="tablist" aria-label="검색 방식">
      {MODE_TABS.map((tab) => {
        const disabled = !usable(tab.mode);
        return (
          <button
            key={tab.mode}
            type="button"
            role="tab"
            aria-selected={tab.mode === activeMode}
            disabled={disabled}
            title={disabled ? UNAVAILABLE_HINT : undefined}
            className={tab.mode === activeMode ? 'search-mode-btn active' : 'search-mode-btn'}
            onClick={() => onModeChange(tab.mode)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
