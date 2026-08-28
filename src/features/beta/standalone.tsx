/*
 * /beta 를 앱 라우터 없이 단독으로 그리는 나무.
 *
 * ── 왜 따로 있나 ────────────────────────────────────────────────────────────
 * /beta 는 빌드 때 미리 그려져 정적 HTML(dist/beta.html)로 나가고, 브라우저는 그 HTML 을
 * 버리지 않고 이어받는다(hydrate). 이어받기가 성립하려면 **서버가 그린 마크업과 브라우저의
 * 첫 렌더가 같아야** 한다. 그런데 router.tsx 의 /beta 는 React.lazy 다 — 브라우저의 첫
 * 렌더는 랜딩이 아니라 BetaFallback(스피너)이고, 청크가 도착한 다음 렌더에야 랜딩이 된다.
 * lazy 를 미리 불러 놔도 마찬가지다. lazy 는 첫 렌더에서 반드시 한 번 suspend 하도록
 * 만들어져 있어서(내부 상태가 Pending 을 거친다) "이미 받아 둔 모듈"이라는 사실을 밖에서
 * 알려 줄 방법이 없다.
 *
 * 그래서 프리렌더 경로는 라우터를 통과하지 않는다. main.tsx 가 프리렌더된 문서를 알아보면
 * 이 컴포넌트를 직접 hydrate 하고(청크는 그 전에 import 로 받아 둔다), 라우터는 앱 안에서
 * /beta 로 이동하는 경우에만 쓰인다. 두 경로가 같은 화면을 그리므로 화면 코드는 하나다.
 *
 * ── 왜 여기에 라우터가 없나 ─────────────────────────────────────────────────
 * 라우터 컨텍스트는 **호출부가** 씌운다. 서버는 StaticRouter, 브라우저는 BrowserRouter 다
 * (둘 다 DOM 을 한 글자도 그리지 않으므로 마크업은 같다). 여기서 하나로 고정하면 서버
 * 번들에 BrowserRouter 가 들어가고, BrowserRouter 는 history 를 만들면서 window 를 만진다.
 *
 * 랜딩 자체는 지금 라우터 훅을 쓰지 않지만 컨텍스트는 필요하다 — ACTION-PLAN 2.1 의
 * useSeoMeta() 가 useLocation() 을 쓰고, 그 브랜치는 BetaLandingScreen 안에서 그것을
 * 호출한다. 라우터 없이 그리면 그 브랜치가 머지되는 순간 이 경로가 통째로 터진다.
 */
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { BetaLandingScreen } from '@/routes/BetaLandingScreen';

interface Props {
  /**
   * 쿼리 클라이언트도 호출부가 넘긴다. 브라우저에서는 main.tsx 의 것을 그대로 써야
   * 하고(앱 전역 기본값이 여기 붙어 있다), 서버에서는 요청마다 새로 만든 빈 것을 쓴다.
   */
  queryClient: QueryClient;
}

export function BetaStandalone({ queryClient }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <BetaLandingScreen />
    </QueryClientProvider>
  );
}
