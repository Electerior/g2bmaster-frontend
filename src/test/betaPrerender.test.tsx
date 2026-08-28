/*
 * /beta 프리렌더 잠금.
 *
 * 이 단계가 고장 나는 방식은 화면에 아무 증상도 남기지 않는다 — 사이트는 멀쩡히 돌아가고
 * 다만 크롤러가 받는 HTML 이 다시 빈 껍데기가 될 뿐이다. 감사가 그것을 발견하기까지
 * 걸린 시간이 이 저장소가 이미 치른 값이다(findings/content.md: 5,851 B, 0 단어).
 * 그래서 사람 눈이 아니라 CI 가 먼저 보게 한다.
 *
 * 잠그는 것은 셋이다.
 *   1. 무엇이 그려지는가 — 카피·수치가 HTML 안에 실제로 있는가, 단어 수가 무너지지 않았는가.
 *   2. 시각에 의존하는 값이 굳지 않았는가 — 빌드 시각이 문서에 박히면 안 된다.
 *   3. 그 마크업을 브라우저가 이어받을 수 있는가 — 어긋나면 React 가 전부 다시 그리고
 *      프리렌더가 사실상 없던 일이 된다. 이건 렌더 결과만 봐서는 알 수 없어서, 실제로
 *      hydrateRoot 를 돌려 본다.
 * 그리고 문서 조립(<head> 갈아 끼우기)은 저장소의 index.html 을 그대로 먹여 확인한다 —
 * dist 를 만들지 않고도 셸이 바뀌면 여기서 깨진다.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { QueryClient } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { act } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { FALLBACK_STATUS } from '@/features/beta/landing.config';
import { ROUTES } from '@/routes/routePaths';
import { ROUTE_META, resolveOgImage } from '@/seo/routeMeta';
import { SITE_ORIGIN } from '@/seo/siteOrigin';
import { BetaStandalone } from '@/features/beta/standalone';
import { renderBetaBody } from '@/features/beta/prerender';
import {
  BETA_META,
  BETA_URL,
  buildBetaDocument,
  countVisibleWords,
  PRERENDER_MARKER,
} from '@/features/beta/prerenderDocument';

// 워크트리·CI 어디서 돌아도 같은 파일을 보도록 cwd 가 아니라 이 파일 위치를 기준으로 푼다
// (src/test/ 에서 두 단계 위가 저장소 루트다).
const SHELL = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'index.html'),
  'utf8',
);

/*
 * 랜딩은 마운트되면 /api/beta/status 를 부른다. 이 시험에 백엔드는 없고, 있어도 안 된다 —
 * 응답 여부에 따라 그려지는 숫자가 달라지면 이어받기 시험이 그날그날 다른 것을 본다.
 * 그래서 전송 계층만 "영원히 응답하지 않는" 것으로 바꾼다. 쿼리는 pending 에 머물고
 * 화면은 FALLBACK_STATUS 로 그려진다 — 프리렌더가 만드는 상태와 정확히 같다.
 */
vi.mock('@/lib/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/apiClient')>();
  return { ...actual, get: () => new Promise(() => {}) };
});

/**
 * 서버 렌더는 한 번이면 충분하다 — 아래 단언들이 전부 같은 문자열을 본다.
 *
 * ⚠ 이 렌더에서만 useLayoutEffect 경고가 나온다. useLandingMotion 은 `typeof window` 로
 *   서버를 판별하는데 vitest 의 jsdom 환경에는 window 가 있어서 브라우저로 판단하고
 *   useLayoutEffect 를 고르기 때문이다. **실제 프리렌더는 window 가 없는 node 에서 돌므로
 *   useEffect 로 떨어지고 경고도 나지 않는다**(빌드 로그에서 확인 가능). 그 사정을 모르면
 *   "SSR 에 레이아웃 효과가 남아 있다"는 잘못된 신호로 읽히므로 이 메시지만 삼킨다 —
 *   나머지 오류는 그대로 흘려보낸다.
 */
const body = (() => {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect does nothing on the server')) return;
    original(...args);
  };
  try {
    return renderBetaBody();
  } finally {
    console.error = original;
  }
})();

describe('/beta 프리렌더 — 본문', () => {
  it('히어로의 h1 세 줄이 그대로 들어 있다', () => {
    expect(body).toContain('<h1 class="hero-h">');
    expect(body).toContain('연 200조 입찰 시장,');
    expect(body).toContain('공고를 찾는 데');
    expect(body).toContain('더 이상 아침을 쓰지 마세요');
  });

  it.each([
    ['알파 테스터 12곳의 3개월', '결과 섹션 제목'],
    ['먼저 써본 조달 담당자 12명', '후기 섹션 제목'],
    ['5.5건', '도입 전 월평균 투찰 건수'],
    ['12.0건', '도입 후 월평균 투찰 건수'],
    ['11.2%', '도입 전 낙찰률'],
    ['20.6%', '도입 후 낙찰률'],
    ['+118%', '투찰 건수 증가폭'],
    ['+9.4%p', '낙찰률 증가폭'],
    ['12개 기업', '조사 방식 문단의 표본 수'],
    ['낙찰 시까지 ', '수수료 조건'],
  ])('알파 테스트 수치 %s(%s)가 HTML 안에 있다', (needle) => {
    expect(body).toContain(needle);
  });

  /*
   * 수치는 JS 가 0 에서 굴려 올리는 값들이라, 예전 구현에서는 첫 렌더가 0 이었다.
   * 그대로 프리렌더하면 문서에 "도입 전 0.0건 / 도입 후 0.0건"이 박힌다 — 없는 것보다
   * 나쁘다(틀린 사실이 된다). useCountUp 이 최종값으로 시작하도록 고친 것을 여기서 잠근다.
   */
  it('카운트업 위젯이 0 이 아니라 최종값으로 그려진다', () => {
    expect(body).not.toContain('>0.0건<');
    expect(body).not.toContain('>0.0%<');
    // 잔여 자리(정수, 접미사 없음)도 마찬가지다. 대체값 12 가 그대로 나와야 한다.
    expect(body).toContain('<span>12</span>');
  });

  it('아홉 섹션이 모두 그려진다', () => {
    // 섹션마다 그 섹션에만 있는 표지를 하나씩 고른다.
    for (const marker of [
      'class="nav"', // Nav
      'class="hero"', // Hero
      '담당자가 하는 일은 Go 아니면 Stop', // Decision
      'id="features"', // Features
      'id="results"', // Results
      'Alpha Feedback', // Feedback
      '베타 참여 혜택', // Benefits
      'id="apply"', // Apply
      '<footer>', // Footer
    ]) {
      expect(body).toContain(marker);
    }
  });

  /**
   * 단어 수 하한.
   *
   * 실측 1,267 단어다(마퀴가 후기 6장을 네 벌 그리므로 그중 360 단어는 중복이고, 고유
   * 카피는 900 단어대다). 하한을 1,000 으로 두는 이유는 정확한 값을 고정하면 카피를
   * 한 줄 고칠 때마다 테스트를 고쳐야 하기 때문이다. 여기서 잡고 싶은 것은 문구의 변화가
   * 아니라 **섹션이 통째로 사라지는 종류의 회귀**다 — 어느 섹션이 빠져도 이 선 아래로
   * 떨어진다. 감사 목표치(약 1,500 단어)는 페이지에 있는 카피 전부를 내보낸 지금이 상한에
   * 가깝고, 그보다 늘리는 일은 프리렌더가 아니라 카피를 더 쓰는 일이다.
   */
  it('본문 단어 수가 1,000 아래로 떨어지지 않는다', () => {
    expect(countVisibleWords(body)).toBeGreaterThanOrEqual(1000);
  });
});

describe('/beta 프리렌더 — 시각에 의존하는 값', () => {
  /*
   * 빌드 시각의 남은 시간을 HTML 에 박으면 두 가지가 동시에 깨진다.
   * 문서는 배포된 순간부터 틀린 값을 보여 주고(캐시된 채로 며칠 산다), 브라우저가 계산한
   * 값과 달라 이어받기도 깨진다. 그래서 서버는 안전한 초기값('—')만 그린다.
   */
  it('카운트다운은 자리표시자만 그린다', () => {
    expect(body).toContain('모집 마감까지 <b>—</b>');
    expect(body).not.toMatch(/\d+일 \d+시간 \d+분/);
  });

  it('잔여 자리는 서버 응답이 아니라 대체값의 출발점(정원)에서 시작한다', () => {
    /*
     * useCountUp 은 정원에서 출발해 실제 잔여까지 굴러떨어진다. 첫 렌더는 정원이다.
     *
     * 정원 값을 **여기 적지 않고 설정에서 읽는다.** 처음에는 50 을 문자열로 박아 뒀는데,
     * 그 사이 랜딩이 정원을 20 으로 줄이면서(feat/price-ui 의 "베타 랜딩 — 정원 20개사")
     * 이 시험만 옛 숫자를 들고 남아 깨졌다. 값이 두 곳에 있으면 언젠가 갈라진다는 것이
     * 이 감사 전체의 주제다 — 시험이라고 예외가 아니다.
     *
     * 이 시험이 지키려는 것은 숫자 20 이 아니라 **"서버 응답이 아니라 대체값에서 출발한다"**는
     * 규칙이다. 프리렌더 시점에는 /api/beta 응답이 없으므로 그것이 유일하게 옳은 출발점이고,
     * 브라우저의 첫 렌더도 같은 값이라 이어받기가 어긋나지 않는다.
     */
    expect(body).toContain(`잔여 <b>${FALLBACK_STATUS.total}<!-- -->개사</b>`);
  });
});

describe('/beta 프리렌더 — 이어받기(hydration)', () => {
  beforeAll(() => {
    /*
     * jsdom 에 없는 두 가지. 랜딩의 모션 훅이 마운트 직후 둘 다 만진다.
     * 여기서 채워 주지 않으면 이어받기가 아니라 그냥 예외로 끝나 아무것도 검증하지 못한다.
     */
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  /**
   * 서버가 그린 마크업을 브라우저가 그대로 이어받는가.
   *
   * React 18 은 마크업이 어긋나면 조용히 고쳐 주지 않는다 — 이어받기를 포기하고 트리를
   * 통째로 다시 그린 뒤 콘솔에 그 사실을 남긴다. 화면은 결국 옳게 나오므로 사람 눈으로는
   * 절대 발견되지 않는데, 그 순간 프리렌더로 얻으려던 LCP 이득은 사라진다.
   * 그래서 검증 대상은 "화면이 맞나"가 아니라 **콘솔에 그 경고가 없나**다.
   */
  it('서버 마크업과 브라우저 첫 렌더가 어긋나지 않는다', async () => {
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(' '));
    });

    document.body.innerHTML = `<div id="root" ${PRERENDER_MARKER}="beta">${body}</div>`;
    const container = document.getElementById('root')!;

    const root = await act(async () =>
      hydrateRoot(
        container,
        <StrictMode>
          <BrowserRouter>
            <BetaStandalone queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })} />
          </BrowserRouter>
        </StrictMode>,
      ),
    );

    /*
     * 네트워크 실패 같은 무관한 잡음은 걸러낸다 — 랜딩은 마운트되면 /api/beta/status 를
     * 부르고 jsdom 에는 서버가 없다. 여기서 보고 싶은 것은 이어받기 실패뿐이다.
     */
    const hydrationErrors = errors.filter((message) =>
      /hydrat|did not match|Text content|server HTML/i.test(message),
    );
    expect(hydrationErrors).toEqual([]);

    // 이어받았다면 서버가 그린 노드가 그대로 남아 있다(다시 그렸다면 교체됐을 것이다).
    expect(container.querySelector('h1.hero-h')?.textContent).toContain('연 200조 입찰 시장,');

    await act(async () => root.unmount());
    spy.mockRestore();
  });
});

describe('/beta 프리렌더 — 문서 조립', () => {
  const html = buildBetaDocument({ shell: SHELL, body: '<p>본문</p>', headExtras: ['<link rel="x" />'] });

  it('셸의 범용 메타가 /beta 것으로 바뀐다', () => {
    expect(html).toContain(`<title>${BETA_META.title}</title>`);
    expect(html).toContain(`<meta name="description" content="${BETA_META.description}" />`);
    expect(html).toContain(`<meta property="og:title" content="${BETA_META.title}" />`);
    expect(html).toContain(`<meta property="og:description" content="${BETA_META.description}" />`);
    expect(html).toContain(`<meta name="twitter:title" content="${BETA_META.title}" />`);
    expect(html).toContain(`<meta name="twitter:description" content="${BETA_META.description}" />`);
  });

  /*
   * 대표 주소는 끝에 슬래시가 없는 /beta 하나뿐이다. sitemap.xml·routePaths.ts 와 같은
   * 형태여야 하고, 산출 파일을 dist/beta/index.html 이 아니라 dist/beta.html 로 낸 이유도
   * 이것이다(디렉터리로 내면 서버가 /beta/ 를 서빙한다). docs/beta-prerender.md 참고.
   */
  it('canonical·og:url 이 모두 정확히 https://…/beta 다', () => {
    expect(BETA_URL).toBe('https://g2b-masters.electerior.co.kr/beta');
    expect(html).toContain(`<link rel="canonical" href="${BETA_URL}" />`);
    expect(html).toContain(`<meta property="og:url" content="${BETA_URL}" />`);
    expect(html).not.toContain(`${BETA_URL}/"`);
  });

  /*
   * hreflang 은 결과물에 **없어야 한다.** 단일 로케일 사이트에서 대안이 하나뿐인 hreflang 은
   * 신호가 0 이고, 셸에 남아 있으면 14개 주소가 "내 ko-KR 대안은 사이트 루트"라고 선언하는
   * 자기참조 위반이 된다(findings/hreflang.md). fix/seo-hreflang-drop 이 셸에서 지웠고,
   * 여기서는 그 브랜치가 아직 안 들어온 상태에서 이 단계가 돌더라도 결과가 같도록
   * 프리렌더가 직접 걷어낸다.
   *
   * 아래는 두 가지를 함께 본다: 셸에 태그가 있든 없든 산출물에는 없다는 것.
   *
   * 문자열 'hreflang' 이 아니라 **태그**를 찾는다. 셸의 <head> 주석이 그 낱말을 설명문에
   * 쓰고 있어서(왜 지웠는지가 거기 적혀 있다) 단순 포함 검사로는 주석에 걸린다.
   */
  const HREFLANG_TAG = /<link[^>]*\bhreflang\b[^>]*>/;

  it('hreflang 은 셸에 있든 없든 결과물에 남지 않는다', () => {
    expect(html).not.toMatch(HREFLANG_TAG);

    const shellWithTag = SHELL.replace(
      '<link rel="canonical"',
      '<link rel="alternate" hreflang="ko-KR" href="https://g2b-masters.electerior.co.kr/" />\n    <link rel="canonical"',
    );
    expect(shellWithTag).toMatch(HREFLANG_TAG);
    expect(buildBetaDocument({ shell: shellWithTag, body: '<p>본문</p>' })).not.toMatch(HREFLANG_TAG);
  });

  it('본문과 표식이 #root 안으로 들어간다', () => {
    expect(html).toContain(`<div id="root" ${PRERENDER_MARKER}="beta"><p>본문</p></div>`);
    expect(html).not.toContain('<div id="root"></div>');
  });

  it('headExtras 와 리빌 보정 스타일이 </head> 앞에 들어간다', () => {
    expect(html).toContain('<link rel="x" />');
    expect(html).toContain('.beta-landing [data-hero]{opacity:1');
    expect(html).toContain('<noscript><style>');
    expect(html.indexOf('<noscript><style>')).toBeLessThan(html.indexOf('</head>'));
  });

  /*
   * 셸에서 물려받아야 하는 것들. JSON-LD·로봇 지시·진입 스크립트는 /beta 전용 값이 아니고,
   * 여기서 다시 박으면 다른 브랜치가 고쳐도 이 파일만 옛 값으로 남는다.
   *
   * og:image 는 이 목록에서 빠졌다 — 이제 /beta 전용 카드가 있다(바로 아래 describe).
   */
  it('셸의 나머지 head 와 진입 스크립트는 건드리지 않는다', () => {
    expect(html).toContain('application/ld+json');
    expect(html).toContain('name="robots"');
    expect(html).toContain('/src/main.tsx');
  });

  /**
   * 드리프트 가드.
   *
   * 셸의 head 모양이 바뀌어 패턴이 빗나가면 조용히 옛 메타를 단 문서가 나가는 대신
   * 빌드가 멈춰야 한다. 조용히 틀린 canonical 이 나가는 사고는 이 저장소에서 이미 한 번
   * 났고(64b8f74), 배포 뒤 색인에서만 드러났다.
   */
  it('셸에 찾을 태그가 없으면 빌드를 멈춘다', () => {
    const broken = SHELL.replace(/<link\s+rel="canonical"[^>]*>/, '');
    expect(() => buildBetaDocument({ shell: broken, body: '' })).toThrow(/canonical/);
  });

  it('같은 태그가 둘이어도 빌드를 멈춘다', () => {
    const doubled = SHELL.replace(/<title>[\s\S]*?<\/title>/, (m) => `${m}\n${m}`);
    expect(() => buildBetaDocument({ shell: doubled, body: '' })).toThrow(/title/);
  });
});

/*
 * ── /beta 전용 공유 카드가 정적 head 에 실제로 들어가는가 (ACTION-PLAN 3.4) ─────
 *
 * **이 배선의 감시자는 여기뿐이다.** 카드를 세우는 훅(useSeoMeta)은 브라우저에서만 돌고,
 * 카카오톡·페이스북 스크래퍼는 JS 를 실행하지 않은 이 문서의 head 만 읽는다. 즉 화면을 아무리
 * 열어 봐도 — head 를 눈으로 훑어도 — 훅이 세운 값이 보이므로 정상으로 보인다. 어긋남은 남의
 * 대화방에 뜬 미리보기에서만 드러나고, 그때는 이미 스크랩 결과가 캐시된 뒤다.
 *
 * 값은 전부 ROUTE_META 에서 읽어 비교한다. 여기에 문자열을 다시 적으면 카드 주소가 표·훅·
 * 프리렌더에 이어 **네 번째 사본**이 되고, 그러면 이 시험은 "둘이 같은가"가 아니라 "셋 중
 * 둘이 이 파일과 같은가"를 보게 된다. 같은 사실이 여러 곳에 적히는 것이 이 감사가 잡아낸
 * 결함의 공통 형태이므로, 그것을 잡는 시험이 같은 형태를 하고 있으면 안 된다.
 */
describe('/beta 프리렌더 — 공유 카드', () => {
  const html = buildBetaDocument({ shell: SHELL, body: '<p>본문</p>' });
  const card = resolveOgImage(ROUTE_META[ROUTES.beta].image!);

  it('표에 /beta 카드가 있다', () => {
    // 아래 단언들의 전제다. 표에서 image 가 사라지면 프리렌더는 범용 카드로 되돌아가는데,
    // 그것은 고장이 아니라 설계된 동작이라 나머지 시험이 조용히 의미를 잃는다.
    expect(ROUTE_META[ROUTES.beta].image).toBeDefined();
  });

  it('og:image 계열 넷이 그 카드의 값이다', () => {
    expect(html).toContain(`<meta property="og:image" content="${card.url}" />`);
    expect(html).toContain(`<meta property="og:image:width" content="${card.width}" />`);
    expect(html).toContain(`<meta property="og:image:height" content="${card.height}" />`);
    expect(html).toContain(`<meta property="og:image:alt" content="${card.alt}" />`);
  });

  it('셸에 없던 twitter:image 둘을 새로 넣는다', () => {
    // X 는 twitter:image 가 없으면 og:image 로 물러나므로 셸에는 둘 자격이 없었다.
    // 카드가 붙는 이 문서에서는 반대로 명시해야 채널마다 다른 그림이 나가지 않는다.
    expect(SHELL).not.toContain('twitter:image');
    expect(html).toContain(`<meta name="twitter:image" content="${card.url}" />`);
    expect(html).toContain(`<meta name="twitter:image:alt" content="${card.alt}" />`);
  });

  it('여섯이 전부 절대 URL 과 전용 문구다 — 셸의 범용 카드가 남지 않는다', () => {
    /*
     * OG 소비자는 상대 경로를 해석하지 않는다. `/og/beta.png` 를 주면 태그는 멀쩡한데
     * 미리보기만 비어 나가고, head 를 눈으로 보는 사람에게는 잘 들어간 것처럼 보인다.
     */
    expect(card.url).toBe(`${SITE_ORIGIN}/og/beta.png`);
    expect(card.url).toMatch(/^https:\/\//);
    expect(html).not.toContain('vercel.app');

    // 셸의 범용 카드(/og-image.png)와 그 alt 가 한 줄도 남으면 안 된다. 한 줄만 남아도
    // 그 채널에서는 '베타 테스터 모집'이 아니라 제품 설명 카드가 나간다.
    expect(SHELL).toContain('/og-image.png');
    expect(html).not.toContain('/og-image.png');
    expect(html).not.toContain('content="G2B Masters - 나라장터·국방전자조달 입찰정보 통합 검색"');
  });

  it('선언한 크기가 PNG 헤더의 실제 픽셀과 같다', () => {
    /*
     * 선언과 실물이 갈라지는 것이 이 감사가 잡아낸 결함의 공통 형태다. 크기가 틀리면
     * 페이스북·카카오톡이 첫 스크랩에서 카드를 잘못 잘라 놓고 그 결과를 캐시한다.
     *
     * src/seo/ogImage.test.ts 가 표를 상대로 같은 것을 본다. 여기서 한 번 더 보는 이유는
     * 보는 대상이 다르기 때문이다 — 그쪽은 표의 숫자와 파일이고, 이쪽은 **문서에 실제로
     * 나간 문자열**과 파일이다. 둘 사이에 프리렌더가 있고, 이 시험은 그 구간을 본다.
     */
    const png = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'og', 'beta.png'),
    );
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(String(png.readUInt32BE(16))).toBe(card.width);
    expect(String(png.readUInt32BE(20))).toBe(card.height);
  });

  it('셸이 twitter:image 를 갖게 되면 삽입 대신 빌드를 멈춘다', () => {
    /*
     * 삽입은 "셸에 없다"를 전제로 한다. 그 전제가 깨진 날 조건 없이 붙이면 같은 태그가 두 줄
     * 있는 문서가 나가고, 크롤러가 어느 쪽을 고르는지는 규격에 없다 — 화면에는 아무 증상이
     * 없다. 그래서 replaceExactlyOnce 의 규약을 방향만 뒤집어 "정확히 0번"을 요구한다.
     */
    const shellWithTag = SHELL.replace(
      '<meta name="twitter:card"',
      '<meta name="twitter:image" content="https://g2b-masters.electerior.co.kr/og-image.png" />\n    <meta name="twitter:card"',
    );
    expect(() => buildBetaDocument({ shell: shellWithTag, body: '' })).toThrow(/twitter:image/);
  });

  it('셸에서 og:image 가 사라지면 빌드를 멈춘다', () => {
    // 치환 쪽은 원래 규약 그대로 — 0번 일치도 오류다.
    const broken = SHELL.replace(/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/, '');
    expect(() => buildBetaDocument({ shell: broken, body: '' })).toThrow(/og:image/);
  });
});
