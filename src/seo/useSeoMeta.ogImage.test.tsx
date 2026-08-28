/*
 * useSeoMeta — 라우트별 공유 카드가 붙고, 또 제대로 떨어지는가.
 *
 * 이 파일이 지켜보는 것은 둘이고, **두 번째가 훨씬 중요하다.**
 *
 *  1. 카드가 있는 라우트(/beta)에서 og:image 가 절대 URL 로 나간다. 상대 경로를 내보내면
 *     태그는 멀쩡한데 미리보기만 비어 나가고, head 를 눈으로 보는 사람에게는 잘 들어간
 *     것처럼 보인다.
 *  2. **카드가 없는 라우트에서 기본 카드로 되돌아간다.** /beta 에서 심은 모집 카드가 그
 *     다음 라우트까지 따라가면, 랜딩을 한 번 들른 방문자가 공유한 /notices 링크에 '베타
 *     테스터 모집' 카드가 붙는다. 심은 값이 다음 라우트로 새는 사고는 이 훅에서 가장
 *     위험하고(robots 쪽 주석 참고), 화면에는 아무 증상도 남기지 않는다.
 *
 * 파일을 따로 두는 이유는 useSeoMeta.noStaticRobots.test.tsx 와 같다: 훅은 모듈이 처음
 * 평가될 때 문서의 정적 값을 한 번만 읽어 두므로, 서로 다른 정적 head 를 한 파일에서 볼
 * 수 없다. 여기서는 index.html 의 **og:image 블록이 있는** 문서를 흉내 낸다.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROUTES } from '@/routes/routePaths';
import { ROUTE_META } from './routeMeta';
import { SITE_ORIGIN } from './siteOrigin';

/*
 * index.html 의 og:image 블록을 그대로 옮긴다(호스트는 fix/seo-canonical-host 가 이미
 * 바로잡은 값). twitter:image 가 **없는** 것도 그대로다 — X 는 없으면 og:image 로 물러나므로
 * 정적 head 에 둘 이유가 없었고, 그래서 이 훅은 카드가 있는 라우트에서 그것을 새로 만들고
 * 떠날 때 다시 지워야 한다. 그 왕복이 이 파일의 검사 대상 중 하나다.
 */
const DEFAULT_CARD = `${SITE_ORIGIN}/og-image.png`;
const DEFAULT_ALT = 'G2B Masters - 나라장터·국방전자조달 입찰정보 통합 검색';
const STATIC_ROBOTS = 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1';
const STATIC_HEAD = [
  `<meta name="robots" content="${STATIC_ROBOTS}" />`,
  `<meta property="og:image" content="${DEFAULT_CARD}" />`,
  '<meta property="og:image:width" content="1200" />',
  '<meta property="og:image:height" content="630" />',
  `<meta property="og:image:alt" content="${DEFAULT_ALT}" />`,
  '<meta name="twitter:card" content="summary_large_image" />',
].join('\n');

document.head.innerHTML = STATIC_HEAD;
const { useSeoMeta } = await import('./useSeoMeta');

const prop = (key: string) =>
  document.head.querySelector(`meta[property="${key}"]`)?.getAttribute('content') ?? null;
const named = (key: string) =>
  document.head.querySelector(`meta[name="${key}"]`)?.getAttribute('content') ?? null;

const BETA_CARD = `${SITE_ORIGIN}/og/beta.png`;

function Screen() {
  useSeoMeta();
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(ROUTES.noticeSearch)}>
      공고 검색으로
    </button>
  );
}

/** 주소만 옮긴다 — 같은 컴포넌트가 유지되고 effect 만 다시 돈다. */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<Screen />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** 실제 앱의 경로 — 라우트가 바뀌면 화면이 언마운트되고 다른 화면이 마운트된다. */
function renderRouted(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.beta} element={<Screen />} />
        <Route path={ROUTES.noticeSearch} element={<Screen />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  document.head.innerHTML = STATIC_HEAD;
  document.title = '';
});

describe('카드가 있는 라우트', () => {
  it('og:image 가 그 라우트의 카드다', () => {
    renderAt(ROUTES.beta);
    expect(prop('og:image')).toBe(BETA_CARD);
  });

  it('og:image 가 절대 URL 이고 SITE_ORIGIN 으로 시작한다', () => {
    renderAt(ROUTES.beta);
    const url = prop('og:image');
    expect(url?.startsWith(`${SITE_ORIGIN}/`)).toBe(true);
    // 상대 경로였다면 여기서 걸린다 — 크롤러는 그것을 해석해 주지 않는다.
    expect(url).toMatch(/^https:\/\//);
    expect(url).not.toContain('vercel.app');
  });

  it('크기와 alt 도 그 카드의 것이다', () => {
    renderAt(ROUTES.beta);
    const card = ROUTE_META[ROUTES.beta].image;
    expect(prop('og:image:width')).toBe(String(card?.width));
    expect(prop('og:image:height')).toBe(String(card?.height));
    expect(prop('og:image:alt')).toBe(card?.alt);
    expect(prop('og:image:alt')).not.toBe(DEFAULT_ALT);
  });

  it('정적 head 에 없던 twitter:image 를 만든다', () => {
    renderAt(ROUTES.beta);
    expect(named('twitter:image')).toBe(BETA_CARD);
    expect(named('twitter:image:alt')).toBe(ROUTE_META[ROUTES.beta].image?.alt);
  });
});

describe('카드가 없는 라우트는 기본 카드로 되돌아간다', () => {
  it('처음부터 카드 없는 라우트면 정적 값이 그대로다', () => {
    renderAt(ROUTES.priceDb);
    expect(prop('og:image')).toBe(DEFAULT_CARD);
    expect(prop('og:image:alt')).toBe(DEFAULT_ALT);
  });

  it('카드 있는 라우트를 들렀다 나와도 남지 않는다 (같은 화면, 주소만 이동)', () => {
    renderAt(ROUTES.beta);
    expect(prop('og:image')).toBe(BETA_CARD);

    fireEvent.click(screen.getByText('공고 검색으로'));
    expect(prop('og:image')).toBe(DEFAULT_CARD);
    expect(prop('og:image:alt')).toBe(DEFAULT_ALT);
  });

  it('카드 있는 라우트를 들렀다 나와도 남지 않는다 (화면 자체가 교체될 때)', () => {
    renderRouted(ROUTES.beta);
    expect(prop('og:image')).toBe(BETA_CARD);

    fireEvent.click(screen.getByText('공고 검색으로'));
    expect(prop('og:image')).toBe(DEFAULT_CARD);
  });

  it('정적 head 에 없던 twitter:image 는 떠날 때 지운다', () => {
    /*
     * 되돌릴 값이 없는 태그는 지운다. 남겨 두면 og:image 는 기본 카드인데 twitter:image 만
     * /beta 카드인 문서가 되어, 채널마다 다른 그림이 나가고 그 사실을 아무도 모른다.
     */
    renderAt(ROUTES.beta);
    expect(named('twitter:image')).toBe(BETA_CARD);

    fireEvent.click(screen.getByText('공고 검색으로'));
    expect(document.head.querySelector('meta[name="twitter:image"]')).toBeNull();
    expect(document.head.querySelector('meta[name="twitter:image:alt"]')).toBeNull();
  });

  it('화면이 언마운트되기만 해도 기본 카드로 돌아온다', () => {
    // 다음 화면이 훅을 부르는 것을 잊더라도 남는 값은 범용 제품 카드여야 한다.
    const view = renderAt(ROUTES.beta);
    expect(prop('og:image')).toBe(BETA_CARD);

    view.unmount();
    expect(prop('og:image')).toBe(DEFAULT_CARD);
    expect(document.head.querySelector('meta[name="twitter:image"]')).toBeNull();
  });

  it('여러 번 오가도 마지막 상태가 정확하다', () => {
    for (const path of [ROUTES.beta, ROUTES.dealRadar, ROUTES.beta, ROUTES.saved]) {
      const view = renderAt(path);
      const expected = path === ROUTES.beta ? BETA_CARD : DEFAULT_CARD;
      expect(prop('og:image'), path).toBe(expected);
      view.unmount();
    }
    renderAt(ROUTES.trendService);
    expect(prop('og:image')).toBe(DEFAULT_CARD);
  });

  it('라우트마다 달라지지 않는 태그는 건드리지 않는다', () => {
    // twitter:card 는 카드가 바뀌어도 summary_large_image 다. 훅의 관리 대상이 아니다.
    renderAt(ROUTES.beta);
    expect(named('twitter:card')).toBe('summary_large_image');
  });
});
