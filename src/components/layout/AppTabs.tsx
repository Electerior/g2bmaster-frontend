/*
 * 책 인덱스 탭 — 패널 왼쪽에 세로로 꽂히는 레일.
 *
 * 활성 탭의 배경을 --surface 로 덮어 패널과 이어 붙인 것처럼 보이게 하는 원본의 트릭을
 * 그대로 쓰되, 90도 돌렸다(layout.css .app-tab.active). 가로 스트립이던 시절에는 탭 9개가
 * 뷰포트 ~1150px 아래에서 넘쳤는데 스크롤바를 숨긴 탓에 넘쳤다는 신호가 없어 뒤 두 탭은
 * 존재조차 알 수 없었다. 세로로 세우면 탭 수가 폭을 먹지 않아 그 문제가 사라진다.
 *
 * 원본은 클릭 핸들러가 state.tab 을 바꾸고 다시 렌더했다. 여기서는 NavLink 라
 * 가운데 클릭·새 탭 열기·주소 복사가 전부 공짜로 따라온다.
 */
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { TAB_ITEMS, showsTabs, type TabItem } from '@/routes/routePaths';
import './layout.css';

const TREND_KINDS = new Set<TabItem['kind']>([
  'product-trend',
  'service-trend',
  'construction-trend',
]);

interface AppTabLinkProps {
  tab: TabItem;
  search: string;
  nested?: boolean;
}

function AppTabLink({ tab, search, nested = false }: AppTabLinkProps) {
  return (
    <NavLink
      to={{ pathname: tab.path, search }}
      /*
       * end 가 없으면 NavLink 는 접두 일치로도 활성이 된다. 공고 검색이 '/notices' 가 되면서
       * '/notices/bid-result' 의 접두가 됐고, 그대로 두면 입찰 결과 화면에서 탭 두 개가 함께
       * 켜진다 — .app-tab.active 는 아래 패널과 이어 붙이려고 아래 테두리를 덮는 트릭이라
       * 둘이 켜지면 어느 화면인지 알 수 없게 된다(aria-current 도 둘이 된다).
       */
      end
      className={({ isActive }) =>
        [
          isActive ? 'app-tab active' : 'app-tab',
          tab.notReady ? 'not-ready' : '',
          nested ? 'app-tab--nested' : '',
        ]
          .filter(Boolean)
          .join(' ')
      }
    >
      {/* 라벨 span 은 «준비» 배지를 라벨과 함께 묶고 활성 탭 테스트의 안정적인 기준이 된다. */}
      <span className="app-tab-label">
        {tab.label}
        {/* 화면 속이 아직 준비 중임을 클릭 전에 알린다 — routePaths.ts TabItem.notReady 참고. */}
        {tab.notReady ? <span className="tab-ready-badge">준비</span> : null}
      </span>
    </NavLink>
  );
}

export function AppTabs() {
  const location = useLocation();
  const isTrendRoute = TAB_ITEMS.some(
    (tab) => tab.path === location.pathname && TREND_KINDS.has(tab.kind),
  );
  const [trendOpen, setTrendOpen] = useState(isTrendRoute);

  /* 트렌드 화면에서는 현재 위치가 숨지 않게 펼치고, 다른 화면으로 나가면 다시 한 줄로 접는다. */
  useEffect(() => {
    setTrendOpen(isTrendRoute);
  }, [isTrendRoute]);

  if (!showsTabs(location.pathname)) return null;

  const mainTabs = TAB_ITEMS.filter(
    (tab) => tab.kind !== 'saved-notices' && !TREND_KINDS.has(tab.kind),
  );
  const trendTabs = TAB_ITEMS.filter((tab) => TREND_KINDS.has(tab.kind));
  const savedTabs = TAB_ITEMS.filter((tab) => tab.kind === 'saved-notices');

  return (
    <nav className="app-tabs" aria-label="조회 화면">
      <div className="app-tab-section">
        {mainTabs.map((tab) => (
          <AppTabLink key={tab.path} tab={tab} search={location.search} />
        ))}
      </div>

      <div className="app-tab-section app-tab-section--spaced">
        <button
          type="button"
          className={[
            'app-tab app-tab-disclosure',
            trendOpen ? 'is-open' : '',
            isTrendRoute ? 'is-current' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-expanded={trendOpen}
          aria-controls="trend-tab-submenu"
          onClick={() => setTrendOpen((open) => !open)}
        >
          <span className="app-tab-label">트렌드 분석</span>
          <span className="app-tab-chevron" aria-hidden="true">
            ›
          </span>
        </button>

        {trendOpen ? (
          <div className="app-tab-submenu" id="trend-tab-submenu">
            {trendTabs.map((tab) => (
              <AppTabLink key={tab.path} tab={tab} search={location.search} nested />
            ))}
          </div>
        ) : null}
      </div>

      <div className="app-tab-section app-tab-section--spaced">
        {savedTabs.map((tab) => (
          <AppTabLink key={tab.path} tab={tab} search={location.search} />
        ))}
      </div>
    </nav>
  );
}
