/*
 * 진입점 — 마운트 · 쿼리 클라이언트 · 라우터 · 오류 경계.
 */
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import {
  PRERENDER_MARKER,
  PRERENDER_MARKER_VALUE,
} from '@/features/beta/prerenderDocument';
import { AppRouter } from '@/routes/router';
import '@/styles/global.css';

/**
 * 쿼리 기본값.
 *  - staleTime 60초: 공고 데이터는 분 단위로도 잘 안 바뀌는데 서버는 G2B 원본 API 를
 *    다시 두드리므로, 탭을 오갈 때마다 재조회하면 호출 한도만 축낸다.
 *  - retry 1: 서버가 G2B 인증/한도 오류를 503·429 로 그대로 넘겨 준다. 세 번 더 두드려도
 *    결과가 같고 한도만 더 쓴다.
 *  - refetchOnWindowFocus 끔: 사용자가 결과를 읽는 도중 창을 다녀왔다고 표가 갈리면
 *    보던 행을 잃는다. 갱신은 명시적인 '검색'으로만.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('#root 엘리먼트를 찾지 못했습니다.');

/*
 * 마운트 방식이 둘이다 — 이 문서가 이미 그려져 있느냐에 따라 갈린다.
 *
 * /beta 는 빌드 때 미리 그려져 정적 HTML(dist/beta.html)로 나간다. 그 문서에서
 * createRoot 를 부르면 React 는 #root 의 자식을 전부 버리고 처음부터 다시 그린다 —
 * 미리 그린 값이 통째로 낭비되고, 브라우저는 같은 화면을 두 번 만든다. hydrateRoot 는
 * 이미 있는 DOM 을 그대로 이어받아 이벤트만 붙인다.
 *
 * 표식은 프리렌더가 심은 data-prerender 다(prerenderDocument.ts). "자식이 있으면
 * 프리렌더" 같은 추측을 쓰지 않는 이유는, 추측이 틀리는 경우에 화면 전체가 깨지고
 * 그 원인이 어디에도 드러나지 않기 때문이다.
 *
 * ⚠ 이어받기 경로는 라우터 밖의 랜딩을 **직접** 그린다. router.tsx 의 /beta 는
 *   React.lazy 라, 그 길로 가면 브라우저의 첫 렌더가 랜딩이 아니라 스피너
 *   (BetaFallback)가 되어 서버가 그린 마크업과 어긋난다. 어긋나면 React 18 은
 *   이어받기를 포기하고 전부 다시 그리므로 프리렌더가 사실상 없던 일이 된다.
 *   lazy 를 미리 불러 둬도 첫 렌더는 반드시 한 번 suspend 한다 — 자세한 사정은
 *   features/beta/standalone.tsx 주석에 적어 두었다.
 *
 *   그래서 랜딩 청크를 import 로 먼저 받고, 도착한 뒤에 이어받는다. 청크는 어차피
 *   받아야 하는 것이고(라우터로 갔어도 lazy 가 같은 파일을 받는다), 프리렌더된 문서는
 *   그 사이에도 읽을 수 있는 상태로 화면에 떠 있다. beta.html 에는 이 청크를 미리
 *   받게 하는 modulepreload 가 들어 있어 왕복이 직렬로 붙지 않는다.
 */
if (container.getAttribute(PRERENDER_MARKER) === PRERENDER_MARKER_VALUE) {
  void import('@/features/beta/standalone').then(({ BetaStandalone }) => {
    hydrateRoot(
      container,
      <StrictMode>
        <ErrorBoundary>
          <BrowserRouter>
            <BetaStandalone queryClient={queryClient} />
          </BrowserRouter>
        </ErrorBoundary>
      </StrictMode>,
    );
  });
} else {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
