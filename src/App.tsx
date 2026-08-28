/*
 * 앱 셸 — 라우트가 바뀌어도 살아 있는 껍데기.
 * 순서는 원본 index.html 과 같다: 활동 바 → 파트너 배너 → 헤더 → main(검색창 + 탭 + 결과).
 */
import { Outlet, useLocation } from 'react-router-dom';
import { NotReadyProvider } from '@/components/feedback/NotReady';
import { AiActivityBar } from '@/components/layout/AiActivityBar';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppTabs } from '@/components/layout/AppTabs';
import { SearchHeader } from '@/features/search/SearchHeader';
import { ROUTES } from '@/routes/routePaths';

/**
 * 검색창을 감출 라우트. 시스템 대시보드는 원본에서 아예 별도 페이지(system.html)였고
 * 공고 검색과 아무 관계가 없다.
 */
const SEARCHLESS_ROUTES: readonly string[] = [ROUTES.system];

export function App() {
  const location = useLocation();
  const showsSearch = !SEARCHLESS_ROUTES.includes(location.pathname);

  return (
    /*
      "아직 준비 중" 알림은 셸이 한 번만 감싼다. 검색창과 결과 화면이 각자 토스트를 그리면
      검색창에서 누른 알림과 표에서 누른 알림이 겹쳐 두 장이 뜬다.
    */
    <NotReadyProvider>
      <AiActivityBar />
      {/*
        상단은 통합 헤더 하나다(예전의 흰색 파트너 배너 + 파란 앱 헤더를 합쳤다).
        '⚙ 우리 회사' 버튼의 모달(SettingsModal)은 다음 웨이브에서 붙는다 —
        핸들러를 넘기지 않으면 버튼은 아무 일도 하지 않는다.
      */}
      <AppHeader />
      <main>
        {showsSearch ? <SearchHeader /> : null}
        {/*
          탭 레일과 결과 패널은 가로로 나란히 놓인다(책 인덱스). 운영 중인 조회 화면만
          레일에 남기며, 세부 배치는 layout.css .app-shell-body 가 맡는다.

          TABLESS_ROUTES(/system)에서는 AppTabs 가 null 을 내므로 패널이
          유일한 flex 항목이 되어 자동으로 전폭을 쓴다. 분기를 따로 두지 않는 이유다.
        */}
        <div className="app-shell-body">
          <AppTabs />
          <Outlet />
        </div>
      </main>
    </NotReadyProvider>
  );
}
