/*
 * 배선 잠금 — **실제 화면**이 렌더될 때 head 가 그 라우트의 것이 되는가.
 *
 * useSeoMeta.test.tsx 는 훅 자체를 본다. 훅이 아무리 옳아도 화면이 부르지 않으면 그 라우트는
 * 여전히 index.html 의 범용 메타를 달고 나가는데, 그것은 화면에 아무 증상이 없어 눈으로는
 * 발견되지 않는다. 그래서 여기서는 AppRouter 를 그대로 태워 표의 다섯 주소를 한 번씩 열어 본다.
 * 새 라우트가 생기면 ROUTE_META 는 타입이 강제하지만 **훅 호출은 강제하지 못한다** — 그
 * 빈틈을 메우는 것이 이 파일의 존재 이유다.
 *
 * 훅 단위 테스트가 가짜 화면으로 보는 것들(canonical 의 쿼리 제거, 옛 주소의 canonical)을
 * 여기서 한 번 더 보는 이유도 같다. 가짜 화면은 훅만 부르지만 진짜 화면은 라우터·리다이렉트·
 * 조회 훅을 함께 태우므로, 규칙이 그 경로 위에서도 성립하는지는 별개의 사실이다.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/apiClient', () => ({
  // 조회는 영원히 대기시킨다 — head 만 보므로 데이터는 필요 없다.
  get: vi.fn(() => new Promise(() => {})),
  post: vi.fn(() => new Promise(() => {})),
  put: vi.fn(() => new Promise(() => {})),
  del: vi.fn(() => new Promise(() => {})),
  apiClient: {},
  ApiError: class ApiError extends Error {},
}));

/*
 * index.html 의 색인 지시를 그대로 흉내 낸다 — 세 이름이다.
 *
 * `robots` 하나만 두면 이 테스트는 크롤러별 태그가 noindex 라우트에서 `index,follow` 인 채로
 * 남는 것을 못 본다. 프로덕션 head 와 같은 모양으로 시작해야 프로덕션과 같은 것을 잠근다.
 * (판별 자체는 useSeoMeta.crawlerTags.test.tsx 가 따로 본다.)
 */
const STATIC_ROBOTS = 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1';
const CRAWLER_DEFAULT = 'index,follow';
const ROBOTS_NAMES = ['robots', 'googlebot', 'naverbot'] as const;
const STATIC_HEAD = [
  `<meta name="robots" content="${STATIC_ROBOTS}" />`,
  `<meta name="googlebot" content="${CRAWLER_DEFAULT}" />`,
  `<meta name="naverbot" content="${CRAWLER_DEFAULT}" />`,
].join('\n');

document.head.innerHTML = STATIC_HEAD;

const { AppRouter } = await import('@/routes/router');
const { ROUTES, LEGACY_NOTICE_ROUTES } = await import('@/routes/routePaths');
const { ROUTE_META, NOT_FOUND_META } = await import('./routeMeta');
const { SITE_ORIGIN } = await import('./siteOrigin');

/**
 * 그 주소로 앱을 띄우고, **훅이 head 를 세울 때까지 기다린다.**
 *
 * 기다림이 필요한 이유가 있다. perf/route-code-split 이 라우트를 React.lazy 로 가르면
 * 첫 렌더는 Suspense 대체 화면이고, 그 화면은 useSeoMeta() 를 부르지 않는다. 즉 head 는
 * 아직 index.html 의 범용 메타 그대로다 — 렌더 직후에 단언하면 표의 주소가 전부
 * "메타가 안 세워졌다"로 깨진다. 이 브랜치만 돌 때는 라우터가 정적 import 라 첫 렌더에
 * 이미 화면이 있어서 증상이 없고, 두 브랜치를 합쳐야 드러난다.
 *
 * 기다리는 신호는 document.title 이다. beforeEach 가 매번 빈 문자열로 지우므로,
 * 비어 있지 않다는 것은 곧 "이 라우트의 훅이 실제로 돌았다"는 뜻이다. 표에 있는
 * 다섯과 404 모두 title 이 비지 않으므로 신호가 새지 않는다.
 */
async function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AppRouter />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() => {
    expect(document.title, `${path}: 아직 훅이 head 를 세우지 않았다`).not.toBe('');
  });
  return utils;
}

const meta = (selector: string, attr = 'content') =>
  document.head.querySelector(selector)?.getAttribute(attr) ?? null;

const robots = (name: string) => meta(`meta[name="${name}"]`);
const canonical = () => meta('link[rel="canonical"]', 'href');
const description = () => meta('meta[name="description"]');

beforeAll(() => {
  /*
   * /beta 의 등장 애니메이션이 쓰는 브라우저 API 를 채운다 — jsdom 에는 없다.
   * 이 테스트가 보는 것은 head 뿐이라 관찰자는 아무 일도 하지 않아도 된다.
   */
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});

beforeEach(() => {
  document.head.innerHTML = STATIC_HEAD;
  document.title = '';
});

describe('화면이 실제로 자기 라우트의 메타를 세운다', () => {
  for (const path of Object.values(ROUTES)) {
    const expected = ROUTE_META[path];
    it(`${path}`, async () => {
      await renderAt(path);
      expect(document.title).toBe(expected.title);
      expect(description()).toBe(expected.description);
      expect(canonical()).toBe(`${SITE_ORIGIN}${path}`);

      /*
       * og:* · twitter:* 도 라우트마다 갱신돼야 한다(ACTION-PLAN 2.1). 감사가 지적한 것은
       * 제목만이 아니었다 — 아홉 화면이 document.title 을 세우는 동안 카카오톡·X·페이스북
       * 미리보기는 주소와 무관하게 같은 문구를 보이고 있었다. 공유 링크는 이 시장에서
       * 유입 경로라, 여러 주소가 같은 카드를 내보내면 어느 화면을 공유해도 같은 페이지로
       * 읽힌다.
       */
      expect(meta('meta[property="og:title"]')).toBe(expected.title);
      expect(meta('meta[property="og:description"]')).toBe(expected.description);
      expect(meta('meta[name="twitter:title"]')).toBe(expected.title);
      expect(meta('meta[name="twitter:description"]')).toBe(expected.description);
      // og:url 과 canonical 이 갈라지면 공유 주소와 대표 주소가 다른 문서가 된다.
      expect(meta('meta[property="og:url"]')).toBe(canonical());

      for (const name of ROBOTS_NAMES) {
        const fallback = name === 'robots' ? STATIC_ROBOTS : CRAWLER_DEFAULT;
        expect(robots(name), `${path} 의 ${name}`).toBe(expected.robots ?? fallback);
      }
    });
  }
});

describe('필터 상태는 문서가 아니다 (ACTION-PLAN 1.6)', () => {
  /*
   * 감사가 실제로 열어 본 주소가 여기 있다. from/to 는 자유 형식 날짜이고 cat 도 열려 있어
   * 조합 가능한 주소가 사실상 무한한데 SPA 라 전부 200 을 낸다. 그 전부의 대표 주소는
   * 맨 /notices 하나여야 한다 — 아니면 크롤 예산이 필터 조합을 훑는 데 쓰이고, 같은 내용인
   * 문서들이 중복으로 서로의 순위를 갉아먹는다.
   *
   * 훅 단위로도 보고 있지만(useSeoMeta.test.tsx) 거기서는 가짜 화면이 훅만 부른다.
   * 여기서는 진짜 NoticeSearchScreen 이 조회 훅과 함께 도는 위에서 같은 규칙을 확인한다.
   */
  it('감사가 본 그 주소에서도 canonical 은 맨 /notices 다', async () => {
    await renderAt('/notices?from=2026-07-28&to=2026-08-27&mode=item&cat=입찰');
    expect(canonical()).toBe(`${SITE_ORIGIN}${ROUTES.noticeSearch}`);
    expect(canonical()).not.toContain('?');
    expect(canonical()).not.toContain('cat=');
    expect(meta('meta[property="og:url"]')).toBe(canonical());
    // 필터가 걸렸다고 메타가 달라지지도 않는다 — 같은 문서다.
    expect(document.title).toBe(ROUTE_META[ROUTES.noticeSearch].title);
    expect(description()).toBe(ROUTE_META[ROUTES.noticeSearch].description);
  });

  it('/notices 만의 규칙이 아니다 — 다른 화면의 쿼리도 버린다', async () => {
    // pathname 만 쓰는 규칙이라 화면과 무관하게 성립해야 한다.
    await renderAt('/notices/bid-result?and=GPU&page=3&sort=amount');
    expect(canonical()).toBe(`${SITE_ORIGIN}${ROUTES.bidResult}`);
    expect(meta('meta[property="og:url"]')).toBe(canonical());
  });
});

describe('옛 주소 네 개 (ACTION-PLAN 2.1)', () => {
  /*
   * 넷 다 canonical 이 /notices 여야 한다. `/search` 는 이 앱에서 축적된 링크가 가장 많은
   * 주소이고(routePaths.ts), bid-plan · pre-spec 은 리다이렉트가 단계 필터를 **붙여서**
   * 넘긴다 — 즉 착지 주소에 `?cat=…` 이 생긴다. 그 쿼리마저 canonical 에 새지 않는지가
   * 여기서 함께 잠긴다. 서버 301(2.4)이 붙으면 이 조항은 무의미해지지만 그때까지는
   * 이것이 유일한 방어선이다.
   */
  for (const legacy of LEGACY_NOTICE_ROUTES) {
    it(`${legacy.path} → /notices`, async () => {
      await renderAt(`${legacy.path}?q=노트북`);
      expect(canonical()).toBe(`${SITE_ORIGIN}${ROUTES.noticeSearch}`);
      expect(meta('meta[property="og:url"]')).toBe(canonical());
      expect(document.title).toBe(ROUTE_META[ROUTES.noticeSearch].title);
      // 옛 주소는 색인 제외 대상이 아니다 — 대표 주소만 옮겨 준다.
      expect(robots('robots')).toBe(STATIC_ROBOTS);
    });
  }
});

describe('표 밖의 주소', () => {
  it('404 화면은 noindex 이고 canonical 을 두지 않는다', async () => {
    await renderAt('/이런-주소는-없다');
    expect(document.title).toBe(NOT_FOUND_META.title);
    expect(canonical()).toBeNull();
    // 존재하지 않는 주소를 공유 카드의 주소로 삼을 수도 없다.
    expect(meta('meta[property="og:url"]')).toBeNull();
    for (const name of ROBOTS_NAMES) {
      expect(robots(name), name).toBe(NOT_FOUND_META.robots);
    }
  });
});
