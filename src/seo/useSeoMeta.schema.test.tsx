/*
 * useSeoMeta 가 라우트별 JSON-LD 를 문서에 **심고, 떠날 때 걷는다**.
 *
 * routeSchema.test.ts 가 값을 본다면 여기는 **정리**를 본다. 이 훅에서 가장 위험한 것은
 * 심는 쪽이 아니라 지우는 쪽이라, 그 사고가 어떻게 끝나는지를 먼저 적어 둔다:
 *
 *   /notices 에서 심은 `"url": ".../notices"` 노드가 /beta 로 옮긴 뒤에도 남아 있으면,
 *   /beta 의 head 는 canonical 이 /beta 라고 말하면서 동시에 자기가 /notices 라고
 *   주장하는 문서가 된다. 화면에는 아무 증상이 없고, 왕복하면 노드가 쌓인다 —
 *   한 문서가 여러 페이지를 동시에 주장하는 상태다. 저장소는 같은 종류의 사고를
 *   robots 에서 이미 한 번 다뤘고(useSeoMeta.ts 의 applyRobots 주석), JSON-LD 쪽이 더 나쁘다.
 *
 * 그래서 여기서 잠그는 것은 넷이다.
 *   1. 스키마 있는 라우트 → 있는 라우트 (앞 노드가 남지 않는다)
 *   2. 스키마 있는 라우트 → 없는 라우트 (통째로 사라진다)
 *   3. 언마운트만 해도 사라진다 (다음 화면이 훅을 잊었을 때의 안전한 실패 방향)
 *   4. 여러 번 왕복해도 누적되지 않는다
 * 그리고 셸의 정적 블록을 건드리지 않는다는 것을 함께 본다.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROUTES } from '@/routes/routePaths';
import { routeSchemaFor, ROUTE_SCHEMA_ATTR } from './routeSchema';

/*
 * 셸을 흉내 낸다 — 정적 robots 와 **정적 JSON-LD 블록**. 후자가 이 파일의 절반이다.
 * 훅이 자기 태그만 골라 지우는지를 보려면 지우면 안 되는 태그가 문서에 있어야 한다.
 * 모듈 평가 전에 세워야 프로덕션과 같은 조건이 된다(useSeoMeta 는 평가 시점에 head 를 읽는다).
 */
const STATIC_ROBOTS = 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1';
const STATIC_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [{ '@type': 'WebSite', '@id': 'https://g2b-masters.electerior.co.kr/#website' }],
});
const STATIC_HEAD =
  `<meta name="robots" content="${STATIC_ROBOTS}" />` +
  `<script type="application/ld+json">${STATIC_LD}</script>`;

document.head.innerHTML = STATIC_HEAD;
const { useSeoMeta } = await import('./useSeoMeta');

/** 훅이 심은 태그들. 셸의 정적 블록은 표식이 없어 여기 잡히지 않는다. */
const routeTags = () => [
  ...document.head.querySelectorAll(`script[type="application/ld+json"][${ROUTE_SCHEMA_ATTR}]`),
];

/** 훅이 심은 그래프. 없으면 `null`. 문자열이 아니라 **파싱한 객체**를 돌려준다. */
function injectedGraph(): unknown | null {
  const tags = routeTags();
  // 둘 이상이면 그 자체가 결함이다 — 여기서 잡아 준다.
  expect(tags.length, '훅이 심은 JSON-LD 가 둘 이상이다').toBeLessThanOrEqual(1);
  return tags.length === 0 ? null : JSON.parse(tags[0].textContent ?? '');
}

/** 셸의 정적 블록(표식 없는 것)만 센다. */
const staticTags = () => [
  ...document.head.querySelectorAll(
    `script[type="application/ld+json"]:not([${ROUTE_SCHEMA_ATTR}])`,
  ),
];

function Screen({ to }: { to: string }) {
  useSeoMeta();
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)}>
      옮기기
    </button>
  );
}

/** 라우트마다 다른 <Route> — 옮기면 화면이 언마운트되고 새 화면이 마운트된다(실제 앱 경로). */
function renderRouted(from: string, to: string) {
  return render(
    <MemoryRouter initialEntries={[from]}>
      <Routes>
        {[ROUTES.noticeSearch, ROUTES.bidResult, ROUTES.saved, ROUTES.beta].map((path) => (
          <Route key={path} path={path} element={<Screen to={to} />} />
        ))}
      </Routes>
    </MemoryRouter>,
  );
}

const move = () => fireEvent.click(screen.getByText('옮기기'));

beforeEach(() => {
  document.head.innerHTML = STATIC_HEAD;
  document.title = '';
});

describe('심는다', () => {
  it('스키마가 있는 라우트에 그 라우트의 그래프가 들어간다', () => {
    renderRouted(ROUTES.noticeSearch, ROUTES.beta);
    expect(injectedGraph()).toEqual(routeSchemaFor(ROUTES.noticeSearch));
  });

  it('스키마가 없는 라우트에는 아무것도 만들지 않는다', () => {
    renderRouted(ROUTES.saved, ROUTES.noticeSearch);
    expect(routeTags()).toHaveLength(0);
  });

  it('태그가 하나이고 type 이 application/ld+json 이다', () => {
    renderRouted(ROUTES.beta, ROUTES.noticeSearch);
    expect(routeTags()).toHaveLength(1);
    expect(routeTags()[0].getAttribute('type')).toBe('application/ld+json');
  });
});

describe('셸의 정적 블록은 건드리지 않는다', () => {
  it('훅이 도는 동안에도 그대로 있다', () => {
    renderRouted(ROUTES.noticeSearch, ROUTES.beta);
    expect(staticTags()).toHaveLength(1);
    expect(JSON.parse(staticTags()[0].textContent ?? '')).toEqual(JSON.parse(STATIC_LD));
  });

  it('라우트를 옮기고 언마운트해도 살아남는다', () => {
    const view = renderRouted(ROUTES.noticeSearch, ROUTES.beta);
    move();
    view.unmount();
    expect(staticTags()).toHaveLength(1);
    expect(JSON.parse(staticTags()[0].textContent ?? '')).toEqual(JSON.parse(STATIC_LD));
  });
});

describe('걷는다 — 이 파일의 본론', () => {
  it('스키마 있는 라우트 → 있는 라우트: 앞 노드가 남지 않는다', () => {
    renderRouted(ROUTES.noticeSearch, ROUTES.beta);
    move();

    // 태그는 여전히 하나이고, 내용은 새 라우트의 것이다.
    expect(routeTags()).toHaveLength(1);
    expect(injectedGraph()).toEqual(routeSchemaFor(ROUTES.beta));

    /*
     * 값 비교만으로는 부족하다 — 앞 라우트의 url 이 문서 어딘가에 남아 있으면 그 자체로
     * 사고다. 문서 전체를 훑어 확인한다.
     */
    const head = document.head.innerHTML;
    expect(head).not.toContain('/notices#webpage');
  });

  it('스키마 있는 라우트 → 없는 라우트: 통째로 사라진다', () => {
    renderRouted(ROUTES.bidResult, ROUTES.saved);
    expect(routeTags()).toHaveLength(1);

    move();
    expect(routeTags()).toHaveLength(0);
    // BreadcrumbList 도 함께 사라져야 한다 — 노드 둘짜리 그래프였다.
    expect(document.head.innerHTML).not.toContain('BreadcrumbList');
  });

  it('화면이 언마운트되기만 해도 사라진다', () => {
    /*
     * 다음 화면이 이 훅을 부르는 것을 잊었을 때 남는 값이 '라우트별 노드 없음'이어야 한다.
     * 셸의 정적 노드는 모든 주소에서 참이므로 그것만 남으면 문서는 여전히 옳다.
     */
    const view = renderRouted(ROUTES.beta, ROUTES.noticeSearch);
    expect(routeTags()).toHaveLength(1);

    view.unmount();
    expect(routeTags()).toHaveLength(0);
    expect(staticTags()).toHaveLength(1);
  });

  it('여러 번 왕복해도 누적되지 않는다', () => {
    /*
     * 누적이 이 결함의 최종 형태다 — 한 문서가 여러 페이지를 동시에 주장한다.
     * 훅이 심기 전에 자기 태그를 **전부** 지우므로 몇 번을 오가도 하나여야 한다.
     */
    const view = render(
      <MemoryRouter initialEntries={[ROUTES.noticeSearch]}>
        <Routes>
          <Route path={ROUTES.noticeSearch} element={<Screen to={ROUTES.bidResult} />} />
          <Route path={ROUTES.bidResult} element={<Screen to={ROUTES.noticeSearch} />} />
        </Routes>
      </MemoryRouter>,
    );

    for (let i = 0; i < 6; i += 1) {
      move();
      expect(routeTags(), `${i + 1}번째 이동`).toHaveLength(1);
    }

    // 짝수 번 옮겼으므로 출발점(/notices)으로 돌아와 있다.
    expect(injectedGraph()).toEqual(routeSchemaFor(ROUTES.noticeSearch));

    view.unmount();
    expect(routeTags()).toHaveLength(0);
  });

  it('noindex 라우트를 거쳐 돌아와도 마지막 상태가 정확하다', () => {
    const view = render(
      <MemoryRouter initialEntries={[ROUTES.beta]}>
        <Routes>
          <Route path={ROUTES.beta} element={<Screen to={ROUTES.saved} />} />
          <Route path={ROUTES.saved} element={<Screen to={ROUTES.beta} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(injectedGraph()).toEqual(routeSchemaFor(ROUTES.beta));
    move();
    expect(routeTags()).toHaveLength(0);
    move();
    expect(injectedGraph()).toEqual(routeSchemaFor(ROUTES.beta));

    view.unmount();
  });
});

describe('프리렌더된 문서를 이어받는 경우', () => {
  it('프리렌더가 심어 둔 태그를 자기 것으로 알아보고 하나로 만든다', () => {
    /*
     * dist/beta.html 은 같은 표식을 단 태그를 이미 갖고 있다(scripts/prerender-beta.mjs).
     * 브라우저가 이어받으면 훅이 처음 돌면서 그것을 걷어내고 같은 내용으로 다시 만든다.
     * 표식이 갈라지면 여기서 둘이 남아 같은 노드가 두 번 선언된다.
     */
    document.head.innerHTML =
      STATIC_HEAD +
      `<script type="application/ld+json" ${ROUTE_SCHEMA_ATTR}>${JSON.stringify(
        routeSchemaFor(ROUTES.beta),
      )}</script>`;
    expect(routeTags()).toHaveLength(1);

    renderRouted(ROUTES.beta, ROUTES.noticeSearch);
    expect(routeTags()).toHaveLength(1);
    expect(injectedGraph()).toEqual(routeSchemaFor(ROUTES.beta));
    expect(staticTags()).toHaveLength(1);
  });
});
