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
          /*
           * end 가 없으면 NavLink 는 접두 일치로도 활성이 된다. 공고 검색이 '/notices' 가 되면서
           * '/notices/bid-result' 의 접두가 됐고, 그대로 두면 입찰 결과 화면에서 탭 두 개가 함께
           * 켜진다 — .app-tab.active 는 아래 패널과 이어 붙이려고 아래 테두리를 덮는 트릭이라
           * 둘이 켜지면 어느 화면인지 알 수 없게 된다(aria-current 도 둘이 된다).
           */
          end
          className={({ isActive }) =>
            [isActive ? 'app-tab active' : 'app-tab', tab.notReady ? 'not-ready' : '']
              .filter(Boolean)
              .join(' ')
          }
        >
          {/*
            라벨은 폭에 상관없이 늘 글자 그대로다. 한때 ≤760px 에서 이모지로 갈음했는데,
            아홉 개가 세로로 늘어서면 '용역 트렌드'와 '공사 트렌드'를 글리프만으로 구분할 수
            없었다. 감싸는 span 은 «준비» 배지를 라벨에 묶어 두기 위한 것이다.
          */}
          <span className="app-tab-label">
            {tab.label}
            {/* 화면 속이 아직 준비 중임을 클릭 전에 알린다 — routePaths.ts TabItem.notReady 참고. */}
            {tab.notReady ? <span className="tab-ready-badge">준비</span> : null}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}
