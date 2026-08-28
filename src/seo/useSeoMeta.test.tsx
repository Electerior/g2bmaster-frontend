/*
 * useSeoMeta — 라우트를 옮길 때 <head> 가 실제로 따라오는지.
 *
 * 이 파일이 지켜보는 것 두 가지가 나머지보다 훨씬 중요하다.
 *
 *  1. **canonical 이 쿼리를 버린다.** /notices 의 필터 조합은 사실상 무한하고 전부 200 을
 *     낸다. canonical 이 필터를 달고 나가면 크롤러에게 무한한 중복 문서를 약속하는 셈이다.
 *  2. **noindex 가 라우트를 넘어 새지 않는다.** /saved 에서 심은 noindex 가 /notices 까지
 *     따라가면, 저장 공고를 한 번 들른 방문자(그리고 링크를 따라가는 크롤러)에게 앱 전체가
 *     색인 제외로 보인다. 화면에는 아무 증상이 없어 배포 뒤 몇 주가 지나야 발견된다.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROUTES } from '@/routes/routePaths';
import { NOT_FOUND_META, ROUTE_META } from './routeMeta';
import { SITE_ORIGIN } from './siteOrigin';

/*
 * 모듈을 부르기 **전에** index.html 의 정적 robots 를 흉내 낸다.
 *
 * useSeoMeta 는 모듈이 처음 평가될 때 문서의 robots 값을 읽어 두고, 색인 허용 라우트에서
 * 그 값으로 되돌린다(하드코딩하지 않으려는 것이다). 그래서 이 테스트도 실제 문서와 같은
 * 순서 — head 가 먼저, 모듈이 나중 — 로 준비해야 프로덕션과 같은 조건이 된다.
 */
const STATIC_ROBOTS = 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1';
document.head.innerHTML = `<meta name="robots" content="${STATIC_ROBOTS}" />`;
const { useSeoMeta } = await import('./useSeoMeta');

const attr = (selector: string, name = 'content') =>
  document.head.querySelector(selector)?.getAttribute(name) ?? null;

const robots = () => attr('meta[name="robots"]');
const canonical = () => attr('link[rel="canonical"]', 'href');
const description = () => attr('meta[name="description"]');

/** 화면 하나를 흉내 낸다 — 훅을 부르고, 다른 라우트로 옮길 단추를 준다. */
function Screen() {
  useSeoMeta();
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(ROUTES.noticeSearch)}>
      공고 검색으로
    </button>
  );
}

/** 404 처럼 표에 없는 화면 — 메타를 인자로 받는다. */
function NotFoundLikeScreen() {
  useSeoMeta(NOT_FOUND_META);
  return null;
}

/** 주소 하나만 잡고 렌더 — 옮겨 다녀도 같은 컴포넌트가 유지된다(effect 재실행 경로). */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<Screen />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** 라우트마다 다른 <Route> — 옮기면 화면이 언마운트되고 새 화면이 마운트된다(실제 앱 경로). */
function renderRouted(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.saved} element={<Screen />} />
        <Route path={ROUTES.noticeSearch} element={<Screen />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // 새로 연 문서처럼 되돌린다 — 정적 robots 만 있고 나머지는 훅이 만든 것이다.
  document.head.innerHTML = `<meta name="robots" content="${STATIC_ROBOTS}" />`;
  document.title = '';
});

describe('라우트별 head', () => {
  it('제목과 설명을 그 라우트의 것으로 세운다', () => {
    renderAt(ROUTES.beta);
    expect(document.title).toBe(ROUTE_META[ROUTES.beta].title);
    expect(description()).toBe(ROUTE_META[ROUTES.beta].description);
  });

  it('og:* 와 twitter:* 도 같은 문구를 받는다', () => {
    renderAt(ROUTES.bidResult);
    const { title, description: desc } = ROUTE_META[ROUTES.bidResult];
    expect(attr('meta[property="og:title"]')).toBe(title);
    expect(attr('meta[property="og:description"]')).toBe(desc);
    expect(attr('meta[name="twitter:title"]')).toBe(title);
    expect(attr('meta[name="twitter:description"]')).toBe(desc);
  });

  it('주소를 옮기면 제목·설명이 따라 바뀐다', () => {
    renderAt(ROUTES.saved);
    expect(document.title).toBe(ROUTE_META[ROUTES.saved].title);

    fireEvent.click(screen.getByText('공고 검색으로'));
    expect(document.title).toBe(ROUTE_META[ROUTES.noticeSearch].title);
    expect(description()).toBe(ROUTE_META[ROUTES.noticeSearch].description);
  });
});

describe('canonical', () => {
  it('오리진 + 경로다', () => {
    renderAt(ROUTES.bidResult);
    expect(canonical()).toBe(`${SITE_ORIGIN}${ROUTES.bidResult}`);
  });

  it('필터가 잔뜩 붙은 주소에서도 쿼리를 버린다', () => {
    /*
     * 감사 대상이었던 바로 그 주소다. from/to 는 자유 형식 날짜이고 cat 도 열려 있어
     * 조합 가능한 주소가 사실상 무한한데 전부 200 을 낸다 — 대표 주소는 맨 /notices 하나다.
     */
    renderAt('/notices?from=2026-07-28&to=2026-08-27&mode=item&cat=입찰');
    expect(canonical()).toBe('https://g2b-masters.electerior.co.kr/notices');
    expect(canonical()).not.toContain('?');
    expect(canonical()).not.toContain('cat=');
  });

  it('og:url 이 canonical 과 같다', () => {
    renderAt('/notices/bid-result?and=GPU&page=3');
    expect(attr('meta[property="og:url"]')).toBe(canonical());
    expect(attr('meta[property="og:url"]')).toBe(`${SITE_ORIGIN}${ROUTES.bidResult}`);
  });

  it('옛 주소의 canonical 은 /notices 다', () => {
    // /search 는 이 앱에서 축적된 링크가 가장 많은 주소다(routePaths.ts).
    renderAt('/search?q=노트북');
    expect(canonical()).toBe(`${SITE_ORIGIN}${ROUTES.noticeSearch}`);
  });

  it('404 에는 canonical 도 og:url 도 두지 않는다', () => {
    render(
      <MemoryRouter initialEntries={['/없는-주소']}>
        <Routes>
          <Route path="*" element={<NotFoundLikeScreen />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(canonical()).toBeNull();
    expect(attr('meta[property="og:url"]')).toBeNull();
    expect(robots()).toContain('noindex');
  });
});

describe('noindex 가 라우트를 넘어 새지 않는다', () => {
  it('색인 제외 라우트에서는 noindex 를 심는다', () => {
    renderAt(ROUTES.saved);
    expect(robots()).toBe('noindex,follow');
  });

  it('색인 허용 라우트로 옮기면 noindex 가 남지 않는다 (같은 화면, 주소만 이동)', () => {
    renderAt(ROUTES.saved);
    expect(robots()).toContain('noindex');

    fireEvent.click(screen.getByText('공고 검색으로'));
    expect(robots()).not.toContain('noindex');
    expect(robots()).toBe(STATIC_ROBOTS);
  });

  it('색인 허용 라우트로 옮기면 noindex 가 남지 않는다 (화면 자체가 교체될 때)', () => {
    // 실제 앱의 경로다 — 라우트가 바뀌면 화면이 언마운트되고 다른 화면이 마운트된다.
    renderRouted(ROUTES.saved);
    expect(robots()).toContain('noindex');

    fireEvent.click(screen.getByText('공고 검색으로'));
    expect(robots()).toBe(STATIC_ROBOTS);
  });

  it('화면이 언마운트되기만 해도 noindex 는 사라진다', () => {
    // 다음 화면이 훅을 부르는 것을 잊더라도 남는 값은 '색인 허용'이어야 한다.
    const view = renderAt(ROUTES.saved);
    expect(robots()).toContain('noindex');

    view.unmount();
    expect(robots()).toBe(STATIC_ROBOTS);
  });

  it('색인 제외 라우트를 여러 번 오가도 마지막 상태가 정확하다', () => {
    for (const path of [ROUTES.saved, ROUTES.system, ROUTES.saved]) {
      const view = renderAt(path);
      expect(robots(), path).toContain('noindex');
      view.unmount();
    }
    renderAt(ROUTES.beta);
    expect(robots()).toBe(STATIC_ROBOTS);
  });
});
