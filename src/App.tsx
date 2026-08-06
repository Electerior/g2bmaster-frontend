/*
 * 앱 셸 — 라우트가 바뀌어도 살아 있는 껍데기.
 * 순서는 원본 index.html 과 같다: 활동 바 → 파트너 띠 → 헤더 → main(검색창 + 탭 + 결과).
 */
import { Outlet, useLocation } from 'react-router-dom';
import { AiActivityBar } from '@/components/layout/AiActivityBar';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppTabs } from '@/components/layout/AppTabs';
import { PartnerStrip } from '@/components/layout/PartnerStrip';
import { SearchHeader } from '@/features/search/SearchHeader';
import { ROUTES } from '@/routes/routePaths';

/**
 * 검색창을 감출 라우트. 시스템 대시보드는 원본에서 아예 별도 페이지(system.html)였고
 * 공고 검색과 아무 관계가 없다.
 * 통합 검색(/search)은 자기 검색창(IndexSearchHeader)을 직접 그린다 — 조건이 다르기 때문이다
 * (생애주기 단계·지역이 있고, 첨부 전수조사·유사도가 없다). 공용 검색창까지 뜨면 화면에
 * 검색창이 둘이 되어, 어느 쪽이 결과를 바꾸는지 알 수 없게 된다.
 * 업로드 분석(/analysis-lab)에서는 검색창이 남되 모드 탭만 보인다 — 그 조절은
 * searchModeLayout 이 한다(원본 setSearchMode 와 같은 규칙).
 */
const SEARCHLESS_ROUTES: readonly string[] = [ROUTES.system, ROUTES.unifiedSearch];

export function App() {
  const location = useLocation();
  const showsSearch = !SEARCHLESS_ROUTES.includes(location.pathname);

  return (
    <>
      <AiActivityBar />
      <PartnerStrip />
      {/*
        '⚙ 우리 회사' 버튼의 모달(SettingsModal)은 다음 웨이브에서 붙는다.
        핸들러를 넘기지 않으면 버튼은 아무 일도 하지 않는다 — 셸의 배치만 확정한 상태.
      */}
      <AppHeader />
      <main>
        {showsSearch ? <SearchHeader /> : null}
        <AppTabs />
        <Outlet />
      </main>
    </>
  );
}
