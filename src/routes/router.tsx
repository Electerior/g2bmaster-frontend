/*
 * 라우트 표 — 화면 14개 + 기본 리다이렉트 + 404.
 *
 * 모든 화면은 App(셸) 아래에 중첩된다. 셸을 매 화면이 각자 그리면 탭을 옮길 때마다
 * 헤더·배너가 언마운트됐다 다시 붙어 스크롤과 포커스가 튄다.
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import { App } from '@/App';
import { AnalysisLabScreen } from './AnalysisLabScreen';
import { CompanyProfileScreen } from './CompanyProfileScreen';
import { DealRadarScreen } from './DealRadarScreen';
import { NotFoundScreen } from './NotFoundScreen';
import { NoticeSearchScreen } from './NoticeSearchScreen';
import { NoticeTableScreen } from './NoticeTableScreen';
import { OfficerDirectoryScreen } from './OfficerDirectoryScreen';
import { SavedNoticesScreen } from './SavedNoticesScreen';
import { SpecSearchScreen } from './SpecSearchScreen';
import { SystemDashboardScreen } from './SystemDashboardScreen';
import { TrendScreen } from './TrendScreen';
import { DEFAULT_ROUTE, ROUTES } from './routePaths';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<App />}>
        {/* 기본 경로 — 히스토리에 '/' 를 남기지 않도록 replace 로 동작하는 Navigate 를 쓴다. */}
        <Route path="/" element={<Navigate to={DEFAULT_ROUTE} replace />} />

        {/* 공고 통합 검색 — 로컬 색인만 조회한다(나라장터 호출 없음) */}
        <Route path={ROUTES.unifiedSearch} element={<NoticeSearchScreen />} />

        {/* 공고 표 4종 — 원본 탭 bid-plan / pre-spec / bid-announce / bid-result */}
        <Route path={ROUTES.bidPlan} element={<NoticeTableScreen kind="bid-plan" />} />
        <Route path={ROUTES.preSpec} element={<NoticeTableScreen kind="pre-spec" />} />
        <Route path={ROUTES.bidAnnounce} element={<NoticeTableScreen kind="bid-announce" />} />
        <Route path={ROUTES.bidResult} element={<NoticeTableScreen kind="bid-result" />} />

        {/* 탭이지만 표가 아닌 화면들 */}
        <Route path={ROUTES.dealRadar} element={<DealRadarScreen />} />
        <Route path={ROUTES.saved} element={<SavedNoticesScreen />} />
        <Route path={ROUTES.specSearch} element={<SpecSearchScreen />} />

        {/* 트렌드 3종 */}
        <Route path={ROUTES.trendProduct} element={<TrendScreen kind="product" />} />
        <Route path={ROUTES.trendService} element={<TrendScreen kind="service" />} />
        <Route path={ROUTES.trendConstruction} element={<TrendScreen kind="construction" />} />

        {/* 원본에서 검색 모드였던 것들 — 이제 각자 주소를 가진다 */}
        <Route path={ROUTES.company} element={<CompanyProfileScreen />} />
        <Route path={ROUTES.officers} element={<OfficerDirectoryScreen />} />
        <Route path={ROUTES.analysisLab} element={<AnalysisLabScreen />} />

        {/* 원본에서 별도 페이지였던 것 */}
        <Route path={ROUTES.system} element={<SystemDashboardScreen />} />

        <Route path="*" element={<NotFoundScreen />} />
      </Route>
    </Routes>
  );
}
