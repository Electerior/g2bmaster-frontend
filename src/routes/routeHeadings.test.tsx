/*
 * 라우트별 H1 잠금.
 *
 * ── 무엇을 막는 테스트인가 ─────────────────────────────────────────────────
 * 예전에는 앱 전체에서 h1 이 셸의 AppHeader 하나였고 그 내용은 14개 라우트 어디서나
 * "G2B Masters" 였다. 화면 제목은 h2(.panel-title)였다. 그래서 온페이지에서 가장 강한
 * 제목 신호가 모든 주소에서 같은 브랜드명이었고, 이 주소와 저 주소를 구분할 근거가 없었다.
 * SPA 라 <head> 도 정적 하나뿐이라 더 그랬다(라우트별 title·canonical 은 별도 브랜치).
 *
 * 지금은 브랜드가 제목이 아니고(div.app-title) 화면이 h1 을 가진다.
 *
 * ── 왜 테스트가 필요한가 ───────────────────────────────────────────────────
 * 이 변경은 **화면에 아무 증상도 남기지 않는다.** 스타일을 요소가 아니라 클래스가 나르기
 * 때문에 h1 이든 h2 든 픽셀이 같다. 그래서 다음 사람이 "화면 제목이 왜 h1 이지" 하고
 * h2 로 되돌리거나, 헤더에 h1 을 되살려도 눈으로는 아무도 알아채지 못한다.
 * 이 파일이 그 되돌림을 잡는 유일한 장치다.
 *
 * ── 문구는 왜 그대로인가 ───────────────────────────────────────────────────
 * 아래 표의 문구는 전부 탭 라벨(SCREENS[...].label)과 같다. routePaths.ts 에 "탭 이름과
 * 화면 제목이 갈라지면 안 된다"고 적혀 있고, 눈에 보이지 않는 제목(sr-only)에만 키워드를
 * 더 얹는 것은 화면에 없는 말을 크롤러에게만 보여 주는 셈이라 하지 않았다.
 * 문구를 손대려면 탭 라벨과 함께 옮기고 이 표도 같이 고쳐야 한다.
 *
 * ── 이 테스트가 못 보는 곳 ─────────────────────────────────────────────────
 * 화면이 그리는 markdown(저장 공고 요약·서랍 요약)은 서버·LLM 이 만든 문자열이라 `# 제목`이
 * 섞이면 그 자리에 진짜 h1 이 하나 더 생긴다. 지금 서버 프롬프트는 굵게와 줄바꿈만 쓰므로
 * (components/markdown/Markdown.tsx 주석) 실제로 그런 일은 없고, 셸에 h1 이 있던 시절에도
 * 같은 노출이었다. 서버가 제목을 쓰기 시작하면 Markdown 이 제목 단계를 낮춰 그려야 한다.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';

/*
 * 조회는 "성공했지만 비어 있다"로 답한다. 영원히 대기시키면(다른 테스트들이 쓰는 방식)
 * 트렌드 화면의 소제목 여섯 개가 아예 렌더되지 않아 제목 계층을 볼 수 없다.
 * vi.mock 팩토리는 호이스팅되므로 바깥 상수를 참조할 수 없다 — 응답을 여기 인라인으로 둔다.
 */
vi.mock('@/lib/apiClient', () => ({
  get: vi.fn((url: string) =>
    Promise.resolve(
      url.startsWith('/api/beta')
        ? // 랜딩이 대체값 대신 정상 경로로 그려지도록 실제 응답 모양을 준다.
          { total: 50, remaining: 12, deadline: '2026-12-31T23:59:59+09:00', open: true }
        : url.startsWith('/api/search/notices?')
          ? // 공고가 한 건은 있어야 AI 수주 데스크가 카드를 그리고 그 안의 소제목이 보인다.
            {
              items: [
                {
                  id: 'R26-0001',
                  noticeName: 'GPU 서버 도입',
                  businessDivision: '물품',
                  estimatedPrice: 45_000_000,
                },
              ],
              totalCount: 1,
              pageNo: 1,
              numOfRows: 20,
            }
          : { items: [], totalCount: 0, pageNo: 1, numOfRows: 20 },
    ),
  ),
  post: vi.fn(() => new Promise(() => {})),
  put: vi.fn(),
  del: vi.fn(),
  apiClient: {},
  ApiError: class ApiError extends Error {},
}));

const { AppRouter } = await import('./router');
const { ROUTES } = await import('./routePaths');
const { SCREENS } = await import('@/domain/columns');

/** 랜딩(/beta)의 등장 애니메이션이 jsdom 에 없는 두 API 를 쓴다 — 관찰은 하지 않는 껍데기로 채운다. */
beforeAll(() => {
  if (!('IntersectionObserver' in globalThis)) {
    class NoopObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    Object.assign(globalThis, { IntersectionObserver: NoopObserver });
  }
  if (!globalThis.matchMedia) {
    Object.assign(globalThis, {
      matchMedia: () => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
      }),
    });
  }
});

/**
 * 라우트 → 그 주소의 H1.
 *
 * 셸 안의 14개 화면 전부와 404 까지. 여기 빠진 라우트가 생기면 그 주소는 브랜드명 시절로
 * 조용히 돌아가도 아무도 모른다 — 라우트를 추가하면 이 표에도 한 줄을 추가할 것.
 */
const ROUTE_H1: ReadonlyArray<readonly [path: string, h1: string]> = [
  [ROUTES.noticeSearch, SCREENS['notice-search'].label],
  [ROUTES.bidResult, SCREENS['bid-result'].label],
  [ROUTES.dealRadar, 'AI 수주 데스크'],
  [ROUTES.saved, '저장 공고'],
  [ROUTES.specSearch, '하드웨어 스펙 검색'],
  [ROUTES.priceDb, '단가 DB'],
  [ROUTES.trendProduct, '물품 구매 트렌드'],
  [ROUTES.trendService, '용역 트렌드'],
  [ROUTES.trendConstruction, '공사 트렌드'],
  [ROUTES.company, '낙찰자 조회'],
  [ROUTES.officers, '담당자 조회'],
  [ROUTES.analysisLab, '업로드 분석'],
  [ROUTES.system, '시스템 상태'],
  ['/없는-주소', '페이지를 찾을 수 없습니다'],
];

/** 랜딩은 셸 밖이고 문구도 길다 — 표에 넣지 않고 따로 본다(줄바꿈은 span 이라 공백 없이 붙는다). */
const BETA_H1 = '연 200조 입찰 시장,공고를 찾는 데더 이상 아침을 쓰지 마세요';

function renderAt(pathname: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[pathname]}>
        <AppRouter />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const HEADINGS = 'h1, h2, h3, h4, h5, h6';

/**
 * 렌더한 뒤 조회 결과가 화면에 다 반영될 때까지 기다린다.
 *
 * 고정된 틱 수를 흘려 보내면 안 된다 — 파일 하나만 돌릴 때는 한 틱으로 충분하지만 전체
 * 스위트에서는 트렌드 소제목 여섯 개가 아직 없는 채로 단언에 도달한다(실제로 그렇게 깨졌다).
 * 제목 개수가 두 번 연속 같아질 때까지 기다리는 편이 화면 사정에 기대지 않아 안전하다.
 */
async function renderSettled(pathname: string) {
  const utils = renderAt(pathname);
  let previous = -1;
  await waitFor(() => {
    const now = utils.container.querySelectorAll(HEADINGS).length;
    const settled = now === previous;
    previous = now;
    expect(settled, `${pathname}: 제목이 아직 늘고 있다`).toBe(true);
  });
  return utils;
}

function textOf(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

async function h1TextsAt(pathname: string): Promise<string[]> {
  const { container } = await renderSettled(pathname);
  return [...container.querySelectorAll('h1')].map(textOf);
}

describe('라우트마다 자기 H1 을 가진다', () => {
  it.each(ROUTE_H1)('%s 의 H1 은 "%s" 하나다', async (pathname, expected) => {
    const h1s = await h1TextsAt(pathname);
    expect(h1s).toEqual([expected]);
  });

  it('/ 로 들어오면 공고 검색으로 착지하고 그 화면의 H1 을 받는다', async () => {
    expect(await h1TextsAt('/')).toEqual([SCREENS['notice-search'].label]);
  });

  it('셸 밖의 랜딩(/beta)도 자기 H1 하나만 가진다', async () => {
    expect(await h1TextsAt(ROUTES.beta)).toEqual([BETA_H1]);
  });

  it('어느 주소에서도 H1 이 브랜드명이 아니다', async () => {
    for (const [pathname] of ROUTE_H1) {
      for (const text of await h1TextsAt(pathname)) {
        expect(text).not.toBe('G2B Masters');
        expect(text).not.toContain('G2B Masters');
      }
    }
  });

  it('라우트끼리 H1 이 겹치지 않는다', () => {
    // 겹치면 그 두 주소는 온페이지에서 같은 페이지로 보인다 — 브랜드명 시절과 같은 문제다.
    const texts = [...ROUTE_H1.map(([, h1]) => h1), BETA_H1];
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe('셸은 제목을 갖지 않는다', () => {
  it('상단 헤더 안에 제목 요소가 하나도 없다', async () => {
    const { container } = await renderSettled(ROUTES.noticeSearch);
    const header = container.querySelector('.app-header')!;
    expect(header).toBeTruthy();
    expect(header.querySelectorAll(HEADINGS)).toHaveLength(0);
  });

  it('브랜드 표기는 남아 있고 스타일을 나르는 클래스도 그대로다', async () => {
    // 요소만 바꾸고 클래스를 빠뜨리면 글자가 20px 흰색에서 14px 로 주저앉는다 — 눈에는 보이지만
    // 그때는 이미 배포된 뒤다. global.css `.app-title` · layout.css `.app-header .app-title` 참고.
    const { container } = await renderSettled(ROUTES.noticeSearch);
    const brand = container.querySelector('.app-header .app-title')!;
    expect(brand).toBeTruthy();
    expect(brand.tagName).not.toBe('H1');
    expect(textOf(brand)).toBe('G2B Masters');
  });
});

/*
 * 제목은 단계를 건너뛰면 안 된다. h1 다음에 바로 h3 가 오면 스크린리더의 제목 이동에서
 * 한 단계가 비어 보이고, 문서 구조도 실제 포함 관계와 어긋난다.
 * 화면 제목이 h2 에서 h1 로 올라갔으므로 그 아래 소제목도 한 단계씩 올라가야 했다
 * (TrendScreen 의 여섯 소제목, DealRadarScreen 의 카드 제목).
 */
describe('제목 계층에 빈 단계가 없다', () => {
  function ladderOf(container: HTMLElement) {
    return [...container.querySelectorAll(HEADINGS)].map((el) => ({
      level: Number(el.tagName[1]),
      text: textOf(el),
    }));
  }

  async function expectNoSkip(pathname: string) {
    const { container } = await renderSettled(pathname);
    const ladder = ladderOf(container);
    expect(ladder.length).toBeGreaterThan(0);
    expect(ladder[0].level).toBe(1);
    ladder.forEach((heading, i) => {
      if (i === 0) return;
      const previous = ladder[i - 1].level;
      expect(
        heading.level,
        `${pathname}: h${previous} 다음에 h${heading.level}("${heading.text}")가 온다`,
      ).toBeLessThanOrEqual(previous + 1);
    });
  }

  it.each([...ROUTE_H1.map(([path]) => path), ROUTES.beta])('%s', async (pathname) => {
    await expectNoSkip(pathname);
  });

  it('AI 수주 데스크의 카드 제목은 h2 다 — h3 면 h2 단계가 빈다', async () => {
    const { container } = await renderSettled(ROUTES.dealRadar);
    const cardTitle = container.querySelector('.deal-card-title')!;
    expect(cardTitle).toBeTruthy();
    expect(cardTitle.tagName).toBe('H2');
  });

  it('트렌드 화면의 소제목 여섯은 h2 다 — h3 면 h2 단계가 빈다', async () => {
    const { container } = await renderSettled(ROUTES.trendProduct);
    const subtitles = [...container.querySelectorAll('.trend-section h2')].map(textOf);
    expect(subtitles).toContain('키워드 TOP');
    expect(subtitles).toContain('발주기관 TOP');
    expect(subtitles).toContain('계약방법');
    expect(container.querySelectorAll('.trend-section h3')).toHaveLength(0);
  });
});
