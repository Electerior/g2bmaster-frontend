/*
 * 크롤러별 색인 지시 태그(googlebot · naverbot …)도 함께 움직이는가.
 *
 * index.html 은 색인 지시를 한 곳이 아니라 **세 곳**에 적어 두었다 — `robots` ·
 * `googlebot` · `naverbot`. 훅이 `robots` 하나만 갈아 끼우면 /saved 의 head 는 색인하지
 * 말라고 하면서 동시에 색인하라고 말하는 문서가 된다. 구글은 부정 규칙의 합집합을 쓴다고
 * 밝혀 두었으니 구글에서는 noindex 가 이기지만, 이 서비스의 주 시장인 네이버는 그런 규칙을
 * 밝힌 적이 없다. 한 head 안에 서로 반대되는 말을 남겨 둘 이유가 없다.
 *
 * 파일을 따로 두는 이유는 useSeoMeta.noStaticRobots.test.tsx 와 같다: 훅은 모듈이 처음
 * 평가될 때 문서를 한 번만 훑어 관리 대상 태그를 정하므로, 서로 다른 정적 head 를 한
 * 파일에서 볼 수 없다.
 */
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { ROUTES } from '@/routes/routePaths';

/*
 * index.html 의 head 를 그대로 흉내 낸다 — 색인 지시 셋과, 지시가 **아닌** 이웃들.
 * 이웃을 함께 두는 것이 중요하다: 훅은 이름 목록이 아니라 내용의 생김새로 색인 지시 태그를
 * 찾으므로, keywords 처럼 콤마로 이어진 값이 잘못 걸려들지 않는지 여기서 확인해야 한다.
 */
const STATIC_ROBOTS = 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1';
const CRAWLER_DEFAULT = 'index,follow';
const STATIC_HEAD = [
  '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '<meta name="keywords" content="G2B Masters, 나라장터, 입찰공고, 공공조달" />',
  `<meta name="robots" content="${STATIC_ROBOTS}" />`,
  `<meta name="googlebot" content="${CRAWLER_DEFAULT}" />`,
  `<meta name="naverbot" content="${CRAWLER_DEFAULT}" />`,
  '<meta name="author" content="Electerior Group" />',
  '<meta name="theme-color" content="#1f56a7" />',
].join('\n');

document.head.innerHTML = STATIC_HEAD;
const { useSeoMeta } = await import('./useSeoMeta');

const content = (name: string) =>
  document.head.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null;

function Screen() {
  useSeoMeta();
  return null;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<Screen />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  document.head.innerHTML = STATIC_HEAD;
  document.title = '';
});

describe('색인 제외 라우트', () => {
  it('robots 뿐 아니라 크롤러별 태그도 함께 noindex 가 된다', () => {
    renderAt(ROUTES.saved);
    expect(content('robots')).toBe('noindex,follow');
    expect(content('googlebot')).toBe('noindex,follow');
    expect(content('naverbot')).toBe('noindex,follow');
  });

  it('색인 제외 다섯 화면 전부에서 그렇다', () => {
    for (const path of [
      ROUTES.saved,
      ROUTES.system,
      ROUTES.analysisLab,
      ROUTES.company,
      ROUTES.officers,
    ]) {
      const view = renderAt(path);
      for (const name of ['robots', 'googlebot', 'naverbot']) {
        expect(content(name), `${path} 의 ${name}`).toContain('noindex');
      }
      view.unmount();
    }
  });
});

describe('되돌리기', () => {
  it('색인 허용 라우트에서는 태그마다 **자기** 정적 값으로 돌아간다', () => {
    /*
     * 셋이 같은 값으로 뭉뚱그려지면 안 된다. robots 에는 max-snippet 같은 스니펫 지시가
     * 붙어 있고 크롤러별 태그에는 없다 — 되돌릴 때 한 값으로 덮으면 그 차이가 사라진다.
     */
    const view = renderAt(ROUTES.saved);
    expect(content('robots')).toContain('noindex');
    view.unmount();

    renderAt(ROUTES.noticeSearch);
    expect(content('robots')).toBe(STATIC_ROBOTS);
    expect(content('googlebot')).toBe(CRAWLER_DEFAULT);
    expect(content('naverbot')).toBe(CRAWLER_DEFAULT);
  });

  it('화면이 언마운트되기만 해도 셋 다 되돌아간다', () => {
    // 다음 화면이 훅을 부르는 것을 잊더라도 남는 값은 '색인 허용'이어야 한다.
    const view = renderAt(ROUTES.officers);
    expect(content('googlebot')).toContain('noindex');

    view.unmount();
    expect(content('robots')).toBe(STATIC_ROBOTS);
    expect(content('googlebot')).toBe(CRAWLER_DEFAULT);
    expect(content('naverbot')).toBe(CRAWLER_DEFAULT);
  });
});

describe('색인 지시가 아닌 meta 는 건드리지 않는다', () => {
  it('keywords · author · theme-color · viewport 는 그대로다', () => {
    /*
     * keywords 가 진짜 표적이다. 콤마로 이어진 값이라 형태만 보면 robots 와 닮았지만
     * 낱말이 지시어가 아니다. 여기가 깨지면 판별식이 너무 넓다는 뜻이다.
     */
    renderAt(ROUTES.saved);
    expect(content('keywords')).toBe('G2B Masters, 나라장터, 입찰공고, 공공조달');
    expect(content('author')).toBe('Electerior Group');
    expect(content('theme-color')).toBe('#1f56a7');
    expect(content('viewport')).toBe('width=device-width, initial-scale=1.0');
  });
});
