/*
 * 라우트 표 — 운영 중인 조회 화면 + 기본 리다이렉트 + 404.
 *
 * 모든 화면은 App(셸) 아래에 중첩된다. 셸을 매 화면이 각자 그리면 탭을 옮길 때마다
 * 헤더·배너가 언마운트됐다 다시 붙어 스크롤과 포커스가 튄다.
 *
 * 셸 안쪽 화면 중 진입점이 아닌 것은 React.lazy 다. 전부 정적으로 가져오면 화면이
 * 번들 하나로 뭉치는데, index.html 의 <body> 가 비어 있는 이 앱에서는 그 덩어리가
 * 다 내려와 파싱될 때까지 아무것도 그려지지 않는다. 즉 번들 크기가 곧 첫 그림까지의
 * 시간이다. 특히 /beta 만 보러 온 방문자가 시스템 대시보드와 저장함(마크다운 렌더러
 * 포함)까지 받아 갈 이유가 없다.
 *
 * 화면 파일들은 default export 가 없어서(named export 다) lazy 안에서 한 번 풀어 준다.
 * 화면 쪽에 default export 를 새로 만들지 않는 이유는, import 방식은 라우트 표의 사정이지
 * 화면의 사정이 아니기 때문이다 — 화면을 직접 import 해 렌더하는 테스트들이 그대로 돈다.
 */
import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { App } from '@/App';
import { PanelNotice, Spinner } from '@/components/feedback/Spinner';
import { LegacyNoticeRedirect } from './LegacyNoticeRedirect';
import { NotFoundScreen } from './NotFoundScreen';
import { NoticeSearchScreen } from './NoticeSearchScreen';
import { DEFAULT_ROUTE, LEGACY_NOTICE_ROUTES, ROUTES } from './routePaths';

/*
 * 정적으로 남기는 셋 — 쪼개는 값보다 왕복 한 번이 더 비싼 자리다.
 *
 *  - NoticeSearchScreen: DEFAULT_ROUTE 다. '/' 로 들어온 모든 방문이 여기 착지하고,
 *    아래 옛 주소들도 전부 여기로 넘어온다. lazy 로 두면 진입 번들을 파싱한 뒤에야 화면
 *    청크를 요청하고, 그게 도착해야 마운트되고, 그제서야 첫 /api 호출이 나간다 — 왕복이
 *    조회 앞에 직렬로 하나 더 붙는다. 이 화면이 진입 번들에 얹는 비용은 15kB 남짓인데
 *    (표·검색창·드로어는 셸과 공유해서 어차피 진입 번들에 있다) 왕복 한 번은 4G 에서
 *    그보다 훨씬 비싸다.
 *  - LegacyNoticeRedirect: 그리는 게 없고 곧바로 통합 검색으로 넘긴다. 청크를 받으려고
 *    기다렸다가 리다이렉트만 하고 버리는 꼴이 된다. 게다가 목적지가 위의 정적 화면이라,
 *    정적으로 두면 옛 링크는 왕복 없이 착지한다.
 *  - NotFoundScreen: 문단 하나에 링크 하나다. 청크로 떼면 파일 헤더가 내용보다 크고,
 *    오타 난 주소일수록 빨리 돌아갈 길을 보여 줘야 한다.
 *
 * App(셸)도 정적이다. 셸을 lazy 로 하면 화면 청크는 셸이 도착해 <Outlet/> 을 그린 뒤에야
 * 요청되므로 앱 라우트마다 직렬 왕복이 둘이 된다.
 */
const BetaLandingScreen = lazy(() =>
  import('./BetaLandingScreen').then((m) => ({ default: m.BetaLandingScreen })),
);
const NoticeTableScreen = lazy(() =>
  import('./NoticeTableScreen').then((m) => ({ default: m.NoticeTableScreen })),
);
const SavedNoticesScreen = lazy(() =>
  import('./SavedNoticesScreen').then((m) => ({ default: m.SavedNoticesScreen })),
);
const SystemDashboardScreen = lazy(() =>
  import('./SystemDashboardScreen').then((m) => ({ default: m.SystemDashboardScreen })),
);

/**
 * 셸 안쪽 대기 자리.
 *
 * 셸(활동 바·헤더·검색창·탭 레일)은 이미 그려져 있으므로 채워야 하는 건 결과 패널 칸뿐이다.
 * 그래서 실제 화면들과 같은 `.panel` 상자를 그대로 쓴다 — 상자의 기하가 같으면 청크가
 * 도착해 내용이 바뀌어도 레일과 패널의 경계가 움직이지 않는다(.app-shell-body 의
 * align-items:stretch 가 패널을 레일 높이까지 늘려 두므로 짧은 화면에서도 마찬가지다).
 * 안쪽 문구는 이 저장소가 이미 쓰는 패널 대기 표시(PanelNotice)다.
 */
function ScreenFallback() {
  return (
    <section className="panel" aria-busy="true">
      <PanelNotice>불러오는 중…</PanelNotice>
    </section>
  );
}

/**
 * 화면 청크를 기다리는 경계. 셸과 화면 사이(= <Outlet/> 자리)에 딱 하나만 둔다.
 * 화면마다 각자 Suspense 를 두면 경계가 화면 수만큼 늘고, 셸을 감싸면 청크가 올 때마다
 * 헤더까지 다시 그려진다.
 */
function ScreenSuspense() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      <Outlet />
    </Suspense>
  );
}

/**
 * /beta 의 대기 자리 — 여긴 셸 밖이라 fallback 이 화면 전체다.
 *
 * 배경을 인라인으로 칠하는 이유: 랜딩이 lazy 가 되면서 landing.css 도 랜딩 청크와 함께
 * 온다. fallback 이 보이는 동안엔 아직 없어서, 아무것도 칠하지 않으면 global.css 의 밝은
 * 캔버스가 비치다가 검은 랜딩이 도착하는 순간 흰 화면이 번쩍인다. 값은 landing.css 의
 * `.beta-landing { background:#000 }` 과 같은 값이라 교체 시점에 색이 바뀌지 않는다.
 * min-height 도 랜딩 루트와 같은 100vh 라 스크롤 길이가 튀지 않는다.
 */
function BetaFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#000',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Spinner label="베타 랜딩 불러오는 중" />
    </div>
  );
}

export function AppRouter() {
  return (
    <Routes>
      {/*
        베타 모집 랜딩만 셸 밖이다. 로그인 전 방문자용 페이지라 활동 바·파트너 배너·
        헤더·검색창·탭이 위에 얹히면 안 된다. 셸 안에 넣으면 랜딩이 아니라 앱의 한 탭이 된다.

        셸 밖이라 Suspense 경계도 따로 가진다 — 아래 ScreenSuspense 는 <Outlet/> 자리,
        즉 패널 칸만 채우도록 만들어져 있어서 셸이 없는 이 화면에는 맞지 않는다.
      */}
      <Route
        path={ROUTES.beta}
        element={
          <Suspense fallback={<BetaFallback />}>
            <BetaLandingScreen />
          </Suspense>
        }
      />

      <Route element={<App />}>
        <Route element={<ScreenSuspense />}>
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
      </Route>
    </Routes>
  );
}
