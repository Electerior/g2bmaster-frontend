/*
 * 고전 폴더 탭 스트립. 활성 탭의 아래 테두리를 --surface 색으로 덮어 아래 패널과
 * 이어 붙인 것처럼 보이게 하는 원본의 트릭을 그대로 쓴다(layout.css .app-tab.active).
 *
 * 원본은 클릭 핸들러가 state.tab 을 바꾸고 다시 렌더했다. 여기서는 NavLink 라
 * 가운데 클릭·새 탭 열기·주소 복사가 전부 공짜로 따라온다.
 */
import { NavLink, useLocation } from 'react-router-dom';
import { TAB_ITEMS, showsTabs } from '@/routes/routePaths';
import './layout.css';

export function AppTabs() {
  const location = useLocation();
  if (!showsTabs(location.pathname)) return null;

  return (
    <nav className="app-tabs" aria-label="조회 화면">
      {TAB_ITEMS.map((tab) => (
        <NavLink
          key={tab.path}
          to={{ pathname: tab.path, search: location.search }}
          className={({ isActive }) => (isActive ? 'app-tab active' : 'app-tab')}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
