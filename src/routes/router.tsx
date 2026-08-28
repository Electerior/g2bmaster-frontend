/*
 * 라우트 표 — 운영 중인 조회 화면 + 기본 리다이렉트 + 404.
 *
 * 모든 화면은 App(셸) 아래에 중첩된다. 셸을 매 화면이 각자 그리면 탭을 옮길 때마다
 * 헤더·배너가 언마운트됐다 다시 붙어 스크롤과 포커스가 튄다.
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import { App } from '@/App';
import { BetaLandingScreen } from './BetaLandingScreen';
import { LegacyNoticeRedirect } from './LegacyNoticeRedirect';
import { NotFoundScreen } from './NotFoundScreen';
import { NoticeSearchScreen } from './NoticeSearchScreen';
import { NoticeTableScreen } from './NoticeTableScreen';
import { SavedNoticesScreen } from './SavedNoticesScreen';
import { SystemDashboardScreen } from './SystemDashboardScreen';
import { DEFAULT_ROUTE, LEGACY_NOTICE_ROUTES, ROUTES } from './routePaths';

export function AppRouter() {
  return (
    <Routes>
      {/*
        베타 모집 랜딩만 셸 밖이다. 로그인 전 방문자용 페이지라 활동 바·파트너 배너·
        헤더·검색창·탭이 위에 얹히면 안 된다. 셸 안에 넣으면 랜딩이 아니라 앱의 한 탭이 된다.
      */}
      <Route path={ROUTES.beta} element={<BetaLandingScreen />} />

      <Route element={<App />}>
        {/* 기본 경로 — 히스토리에 '/' 를 남기지 않도록 replace 로 동작하는 Navigate 를 쓴다. */}
        <Route path="/" element={<Navigate to={DEFAULT_ROUTE} replace />} />

        {/*
          공고 통합 검색 — 계획 · 사전규격 · 입찰 · 마감이 한 목록에 온다.
          예전 표 셋(bid-plan / pre-spec / bid-announce)이 여기로 합쳐졌다.
        */}
        <Route path={ROUTES.noticeSearch} element={<NoticeSearchScreen />} />

        {/* 옛 주소는 단계 필터를 붙여 넘긴다 — 공유된 링크를 죽이지 않는다. */}
        {LEGACY_NOTICE_ROUTES.map((legacy) => (
          <Route
            key={legacy.path}
            path={legacy.path}
            element={<LegacyNoticeRedirect category={legacy.category} />}
          />
        ))}

        {/* 낙찰 결과는 색인에 없다(색인은 공고까지다) — 팬아웃 API 를 그대로 쓴다. */}
        <Route path={ROUTES.bidResult} element={<NoticeTableScreen kind="bid-result" />} />

        {/* 저장한 공고를 다시 보는 화면 */}
        <Route path={ROUTES.saved} element={<SavedNoticesScreen />} />

        {/* 원본에서 별도 페이지였던 것 */}
        <Route path={ROUTES.system} element={<SystemDashboardScreen />} />

        <Route path="*" element={<NotFoundScreen />} />
      </Route>
    </Routes>
  );
}
