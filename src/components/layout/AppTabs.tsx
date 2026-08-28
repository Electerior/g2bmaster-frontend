/*
 * 책 인덱스 탭 — 패널 왼쪽에 세로로 꽂히는 레일.
 *
 * 활성 탭의 배경을 --surface 로 덮어 패널과 이어 붙인 것처럼 보이게 하는 원본의 트릭을
 * 그대로 쓰되, 90도 돌렸다(layout.css .app-tab.active). 현재는 운영 중인 조회 화면만
 * 세로 레일에 노출한다.
 *
 * 원본은 클릭 핸들러가 state.tab 을 바꾸고 다시 렌더했다. 여기서는 NavLink 라
 * 가운데 클릭·새 탭 열기·주소 복사가 전부 공짜로 따라온다.
 */
import { NavLink, useLocation } from 'react-router-dom';
import { TAB_ITEMS, showsTabs, type TabItem } from '@/routes/routePaths';
import './layout.css';

interface AppTabLinkProps {
  tab: TabItem;
  search: string;
}

function AppTabLink({ tab, search }: AppTabLinkProps) {
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
        isActive ? 'app-tab active' : 'app-tab'
      }
    >
      <span className="app-tab-label">{tab.label}</span>
    </NavLink>
  );
}

export function AppTabs() {
  const location = useLocation();
  if (!showsTabs(location.pathname)) return null;

  const mainTabs = TAB_ITEMS.filter((tab) => tab.kind !== 'saved-notices');
  const savedTabs = TAB_ITEMS.filter((tab) => tab.kind === 'saved-notices');

  return (
    <nav className="app-tabs" aria-label="조회 화면">
      <div className="app-tab-section">
        {mainTabs.map((tab) => (
          <AppTabLink key={tab.path} tab={tab} search={location.search} />
        ))}
      </div>

      <div className="app-tab-section app-tab-section--spaced">
        {savedTabs.map((tab) => (
          <AppTabLink key={tab.path} tab={tab} search={location.search} />
        ))}
      </div>
    </nav>
  );
}
