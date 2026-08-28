/*
 * 라우트 표(routePaths.ts) ↔ 엣지 설정(deploy/nginx-g2b-masters.conf) 동기화.
 *
 * 이 테스트가 존재하는 이유는 하나다. nginx 가 알려진 라우트에만 SPA 셸을 내주기
 * 시작했으므로(2026-08-27 SEO 감사 #2, soft 404), **화면을 새로 추가하고 설정을
 * 잊으면 그 화면이 라이브에서 404 가 된다.** 그리고 개발 서버(vite)는 모든 경로에
 * index.html 을 돌려주므로 로컬에서는 끝까지 멀쩡해 보인다 — 배포하고 나서야 안다.
 * 두 곳에 같은 목록을 손으로 유지하는 구조는 반드시 갈라지고, 갈라진 사실이 늦게
 * 드러날수록 비싸다. 그래서 갈라지는 즉시 CI 를 깨뜨린다.
 *
 * nginx 문법 전체를 파싱하지 않는다. 필요한 지시자(중괄호 블록 · add_header ·
 * return 301 · if 의 정규식)만 뽑고, nginx 의 정규식은 JS RegExp 로 옮겨 판정한다.
 * PCRE 와 JS 정규식은 여기 쓰인 범위(문자 클래스 · 비캡처 그룹 · 앵커)에서 같다.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LEGACY_NOTICE_ROUTES, ROUTES } from '@/routes/routePaths';

/*
 * 이 파일 위치를 기준으로 저장소 루트를 찾는다 — vitest 의 cwd 에 기대지 않는다.
 * jsdom 환경의 전역 URL 은 Node 의 URL 이 아니라서 fs 가 그대로 받지 못한다.
 * href(문자열)로 넘겨 fileURLToPath 가 경로로 바꾸게 한다.
 */
function repoFile(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url).href);
}

const CONF_PATH = repoFile('../../deploy/nginx-g2b-masters.conf');
const PAGE_404_PATH = repoFile('../../public/404.html');
const PRERENDER_SCRIPT_PATH = repoFile('../../scripts/prerender-beta.mjs');

const RAW = readFileSync(CONF_PATH, 'utf8');

/**
 * 주석을 걷어낸 설정.
 *
 * 주석에도 `/swagger-ui` 같은 문자열이 남아 있다 — 지운 이유를 근거와 함께 적어
 * 두었기 때문이다. 그것을 "설정에 남아 있다"로 읽으면 안 되므로 검사는 언제나
 * 이 사본 위에서 한다.
 */
const CONF = RAW.replace(/#.*$/gm, '');

interface NginxBlock {
  /** 여는 중괄호 앞의 선언부. 예: `location /assets/`, `if ($args = "")` */
  header: string;
  /** 중괄호 안. 중첩 블록을 포함한다. */
  body: string;
}

/** 중괄호 깊이만 세는 스캐너. 중첩 블록도 각각 하나씩 나온다. */
function blocksOf(source: string): NginxBlock[] {
  const found: NginxBlock[] = [];
  for (let open = 0; open < source.length; open += 1) {
    if (source[open] !== '{') continue;

    // 선언부는 직전 구분자(`;` `{` `}`) 다음부터 여는 중괄호 직전까지다.
    let from = open - 1;
    while (from >= 0 && !';{}'.includes(source[from])) from -= 1;

    let depth = 0;
    let close = open;
    for (; close < source.length; close += 1) {
      if (source[close] === '{') depth += 1;
      else if (source[close] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    found.push({
      header: source.slice(from + 1, open).replace(/\s+/g, ' ').trim(),
      body: source.slice(open + 1, close),
    });
  }
  return found;
}

const BLOCKS = blocksOf(CONF);

/** 중첩 블록의 본문을 지운 것 — "이 블록이 직접 가진 지시자"만 남는다. */
function ownDirectives(body: string): string {
  let depth = 0;
  let own = '';
  for (const char of body) {
    if (char === '{') depth += 1;
    else if (char === '}') depth -= 1;
    else if (depth === 0) own += char;
  }
  return own;
}

/*
 * server 블록이 둘이다(평문 80, TLS 8001). 둘 다 `location /` 을 가지고 있으므로
 * 이름만으로 찾으면 파일에서 먼저 나오는 80 쪽이 잡힌다 — 조회 범위를 먼저 좁힌다.
 */
const SERVERS = BLOCKS.filter((block) => block.header === 'server');

function serverWith(pattern: RegExp): NginxBlock {
  const found = SERVERS.find((block) => pattern.test(ownDirectives(block.body)));
  if (!found) throw new Error(`${pattern} 를 가진 server 블록이 없다`);
  return found;
}

/** 앱을 서빙하는 TLS server. 이 파일의 검사는 대부분 이 안쪽을 본다. */
const TLS_BLOCKS = blocksOf(serverWith(/ssl_certificate\s/).body);
/** 평문 80 — HTTPS 로 넘기는 일만 한다. */
const HTTP_BLOCKS = blocksOf(serverWith(/listen\s+80\s*;/).body);

function blockNamed(header: string, within: NginxBlock[] = TLS_BLOCKS): NginxBlock {
  const found = within.find((block) => block.header === header);
  if (!found) throw new Error(`설정에 \`${header}\` 블록이 없다`);
  return found;
}

/* ─── SPA 폴백 ─────────────────────────────────────────────────────────────── */

/** `location @spa` 의 `if ($uri !~ '…')` 안에 적힌 정규식 원문. */
function spaFallbackSource(): string {
  const spa = blockNamed('location @spa');
  const matched = /\$uri\s*!~\s*'([^']+)'/.exec(spa.body);
  if (!matched) throw new Error('`location @spa` 에서 SPA 폴백 정규식을 찾지 못했다');
  return matched[1];
}

/** 그 정규식을 JS RegExp 로 옮긴다. */
function spaFallbackPattern(): RegExp {
  return new RegExp(spaFallbackSource());
}

/**
 * 정규식이 열거하는 주소 목록.
 *
 * `^/(?:a|b|c)/?$` 한 가지 모양만 받는다. 중첩 그룹(`notices(?:/bid-result)?`)을
 * 허용하면 목록을 기계가 읽을 수 없고, 그러면 아래의 집합 비교가 성립하지 않는다 —
 * 즉 "죽은 화면이 목록에 남아 있는" 방향을 잡을 수 없게 된다. 설정 쪽 주석에도
 * 같은 이유를 적어 두었다.
 */
function spaRoutePaths(): string[] {
  const source = spaFallbackSource();
  const shape = /^\^\/\(\?:([^()]+)\)\/\?\$$/.exec(source);
  if (!shape) {
    throw new Error(
      `@spa 정규식이 \`^/(?:a|b|c)/?$\` 모양이 아니다: ${source}\n` +
        '라우트 하나에 항목 하나로 적어야 한다 — 축약하면 ROUTES 와 대조할 수 없다.',
    );
  }
  return shape[1].split('|').map((alternative) => `/${alternative}`);
}

describe('SPA 폴백 — ROUTES 의 모든 화면이 셸을 받는가', () => {
  const pattern = spaFallbackPattern();

  it.each(Object.entries(ROUTES))('%s (%s) 가 폴백 정규식에 매치된다', (_name, path) => {
    /*
     * 여기서 깨졌다면 화면을 추가하고 deploy/nginx-g2b-masters.conf 의 `location @spa`
     * 정규식을 고치지 않은 것이다. 그대로 배포하면 그 주소가 404 를 낸다.
     */
    expect(pattern.test(path)).toBe(true);
  });

  it('끝의 슬래시가 붙어도 매치된다 — 그래야 404 가 아니라 301 로 접힌다', () => {
    /*
     * 슬래시가 붙은 주소는 여기서 걸러지면 안 된다. 걸러지면 `/notices/` 가 404 가
     * 되는데, React Router 는 둘을 같은 라우트로 보므로 앱 안에서는 멀쩡한 주소다.
     * 통과시킨 뒤 바로 아래 규칙이 슬래시 없는 쪽으로 301 한다(아래 describe 참고).
     */
    expect(pattern.test(`${ROUTES.noticeSearch}/`)).toBe(true);
    expect(pattern.test(`${ROUTES.bidResult}/`)).toBe(true);
    expect(pattern.test(`${ROUTES.beta}/`)).toBe(true);
  });

  it('목록과 ROUTES 가 같은 집합이다 — 죽은 화면이 남아 있으면 깨진다', () => {
    /*
     * ⚠ 한쪽 방향(ROUTES ⊆ 목록)만 보면 잡히지 않는 고장이 있다. 2026-08-28 main 을
     *   병합했더니 화면 아홉 개가 없어져 있었는데(deal-radar · spec-search ·
     *   price-db · trends 셋 · company · officers · analysis-lab) 설정의 목록에는
     *   그대로 남아 있었다. 위의 it.each 는 전부 통과한다 — 목록이 더 넓기만 하기
     *   때문이다. 그동안 죽은 주소 아홉 개가 200 + 셸을 냈고, 그게 이 브랜치가 없애고
     *   있는 soft 404(감사 #2) 그 자체다.
     *
     *   화면을 지우는 쪽이 nginx 설정을 볼 이유는 없으므로 사람에게 맡길 수 없다.
     */
    expect([...spaRoutePaths()].sort()).toEqual([...Object.values(ROUTES)].sort());
  });

  it.each(spaRoutePaths())('%s 는 정규식 메타문자 없는 그대로의 경로다', (path) => {
    // 목록을 그대로 주소로 읽는 위 비교가 성립하려면 `.` `+` 같은 것이 없어야 한다.
    expect(path).toMatch(/^\/[a-z0-9/-]+$/);
  });

  it.each([
    '/definitely-not-a-route',
    '/sitemap_index.xml',
    '/notices/nope',
    // 계층 경로를 `trends/.*` 로 열어 두면 이 둘이 다시 soft 404 가 된다.
    '/trends',
    '/trends/aaaa',
    // 접힌 화면들. 목록에 남겨 두면 죽은 주소가 200 + 셸을 낸다.
    '/price-db',
    '/analysis-lab',
    '/deal-radar',
  ])('%s 는 매치되지 않는다 (진짜 404 여야 한다)', (path) => {
    expect(spaFallbackPattern().test(path)).toBe(false);
  });

  it('/llms.txt 는 정규식에 걸리지 않고 실제 파일로 나간다', () => {
    /*
     * 감사 당시에는 없는 파일이라 200 + 셸이 나갔지만 PR #17 이 public/llms.txt 를
     * 넣었다. 지금은 `location /` 의 `try_files $uri` 가 먼저 집으므로 @spa 까지
     * 오지 않는다 — 정규식이 이것을 매치하면 안 되는 이유는 404 여서가 아니라
     * 여기까지 올 일이 없기 때문이다.
     */
    expect(spaFallbackPattern().test('/llms.txt')).toBe(false);
  });

  it('실제 파일을 먼저 찾는 순서가 유지된다', () => {
    /*
     * `try_files $uri` 가 앞에 없으면 /sitemap.xml·/robots.txt 같은 실제 파일이
     * 404 분기에 걸린다. 특히 /google9c899d4c05ca14dc.html 은 Search Console
     * 소유확인 파일이라 404 가 되는 순간 확인이 풀린다.
     */
    expect(ownDirectives(blockNamed('location /').body)).toMatch(
      /try_files\s+\$uri\s+\$uri\/\s+@spa\s*;/,
    );
  });

  it('404 본문이 error_page 로 연결되고 직접 열리지는 않는다', () => {
    expect(CONF).toMatch(/error_page\s+404\s+\/404\.html\s*;/);
    // internal 이 없으면 /404.html 이 200 으로 열려 soft 404 가 주소 하나로 되살아난다.
    expect(ownDirectives(blockNamed('location = /404.html').body)).toMatch(/\binternal\s*;/);
  });
});

/* ─── /beta 프리렌더 ──────────────────────────────────────────────────────── */

describe('/beta — 프리렌더된 문서가 실제로 나가는가', () => {
  /*
   * 이 describe 가 잠그는 것은 "빌드 산출물 이름"과 "nginx 가 찾는 파일 이름"의 결합이다.
   * 둘이 갈라져도 아무 데서도 오류가 나지 않는다 — /beta 는 계속 200 을 내고, 다만
   * 내용이 34,874 B 짜리 문서가 아니라 7,676 B 짜리 빈 셸이 된다. 화면은 JS 가 그리니
   * 사람 눈에는 똑같고, 손해는 JS 를 실행하지 않는 수집기 쪽에서만 난다. 이 사이트에서
   * 산문이 있는 유일한 페이지이고 사이트맵 priority 가 1.0 인 주소라, 조용히 비는 것을
   * 그대로 두면 프리렌더 작업(ACTION-PLAN 2.2) 전체가 없던 일이 된다.
   */
  const betaBlock = () => blockNamed(`location = ${ROUTES.beta}`);

  function betaTryFiles(): string[] {
    const matched = /try_files\s+([^;]+);/.exec(ownDirectives(betaBlock().body));
    if (!matched) throw new Error(`\`location = ${ROUTES.beta}\` 에 try_files 가 없다`);
    return matched[1].trim().split(/\s+/);
  }

  it('전용 location 이 있다', () => {
    /*
     * 없으면 /beta 는 `location /` 의 try_files 를 전부 지나 @spa 로 떨어지고 셸이
     * 나간다. docs/beta-prerender.md 가 "이 변경만으로는 라이브에서 아무 일도 일어나지
     * 않는다"고 적어 둔 자리가 여기다.
     */
    expect(() => betaBlock()).not.toThrow();
  });

  it('셸보다 프리렌더 산출물을 먼저 찾는다', () => {
    const files = betaTryFiles();
    expect(files[0]).toBe(`${ROUTES.beta}.html`);
    // 프리렌더가 돌지 않은 빌드에서도 화면은 살아 있어야 한다 — 뒤에 셸을 둔다.
    expect(files).toContain('/index.html');
    expect(files[files.length - 1]).toBe('=404');
  });

  it('프리렌더 스크립트가 쓰는 파일 이름과 nginx 가 찾는 이름이 같다', () => {
    /*
     * scripts/prerender-beta.mjs 가 출력 이름을 바꾸면(예: dist/beta/index.html) nginx 는
     * 아무 말 없이 셸을 내보낸다. 그 조합을 여기서 깨뜨린다.
     */
    const script = readFileSync(PRERENDER_SCRIPT_PATH, 'utf8');
    const fileName = betaTryFiles()[0].replace(/^\//, '');
    expect(script).toContain(`'${fileName}'`);
  });

  it('@spa 목록에도 남아 있다 — /beta/ 를 알아봐야 한다', () => {
    // 전용 location 이 /beta 를 먼저 집지만, 끝 슬래시가 붙은 쪽은 @spa 로 온다.
    expect(spaRoutePaths()).toContain(ROUTES.beta);
  });
});

/* ─── 끝 슬래시 · 리다이렉트 형식 ──────────────────────────────────────────── */

describe('끝 슬래시 — 한 화면이 두 주소로 200 이 되지 않게', () => {
  /** `location @spa` 의 끝 슬래시 301 규칙을 꺼내 그대로 적용한다. */
  function normalize(uri: string): string | null {
    const spa = blockNamed('location @spa');
    const rule = /\$uri\s*~\s*'([^']+)'\s*\)\s*\{\s*return\s+301\s+([^;]+);/.exec(spa.body);
    if (!rule) throw new Error('`location @spa` 에 끝 슬래시 301 규칙이 없다');

    const matched = new RegExp(rule[1]).exec(uri);
    if (!matched) return null;
    return rule[2].trim().replace('$1', matched[1]).replace('$is_args$args', '');
  }

  it.each(Object.values(ROUTES))('%s/ 가 슬래시 없는 주소로 301 된다', (path) => {
    /*
     * /beta 에서 이것이 특히 중요하다. 슬래시 없는 쪽은 프리렌더 문서를, 붙은 쪽은
     * 빈 셸을 내므로 **서로 다른 내용이 두 주소에서 200** 이 된다. 사이트맵과
     * canonical 이 가리키는 것은 슬래시 없는 쪽 하나뿐이다.
     */
    expect(normalize(`${path}/`)).toBe(path);
  });

  it('슬래시가 없는 주소는 건드리지 않는다', () => {
    expect(normalize(ROUTES.noticeSearch)).toBeNull();
  });

  it('쿼리스트링을 넘겨준다', () => {
    // `return` 은 rewrite 와 달리 인자를 붙여 주지 않는다 — 빠뜨리면 조건이 사라진다.
    expect(blockNamed('location @spa').body).toContain('$1$is_args$args');
  });

  it('404 판정이 끝 슬래시 규칙보다 먼저다', () => {
    /*
     * 뒤로 가면 없는 주소 `/nope/` 가 301 한 번을 거친 뒤에야 404 가 된다 — 왕복이
     * 늘고 크롤 로그에 없는 주소가 리다이렉트 체인으로 남는다.
     */
    const body = blockNamed('location @spa').body;
    expect(body.indexOf('return 404')).toBeLessThan(body.indexOf('return 301'));
  });
});

describe('리다이렉트 Location', () => {
  it('absolute_redirect 가 꺼져 있다 — Location 에 포트가 붙지 않게', () => {
    /*
     * nginx 는 `return 301 /경로` 에 스킴·호스트·포트를 붙여 절대 URL 로 바꾼다.
     * 실제로 찍으면 `Location: https://g2b-masters.electerior.co.kr:8001/notices?…`
     * 가 나가는데, 8001 은 Cloudflare 가 프록시하는 포트가 아니라서 옛 주소 301 이
     * 링크 자산을 합치기는커녕 엣지 밖으로 안내하게 된다.
     */
    expect(ownDirectives(serverWith(/ssl_certificate\s/).body)).toMatch(
      /absolute_redirect\s+off\s*;/,
    );
  });
});

/* ─── 옛 주소 301 ──────────────────────────────────────────────────────────── */

describe('옛 주소 — LEGACY_NOTICE_ROUTES 에 서버측 301 이 걸려 있는가', () => {
  function redirectTargetOf(path: string): string {
    const location = blockNamed(`location = ${path}`);
    const matched = /return\s+301\s+"([^"]+)"/.exec(location.body);
    if (!matched) throw new Error(`\`location = ${path}\` 에 return 301 이 없다`);
    return matched[1];
  }

  it.each(LEGACY_NOTICE_ROUTES.map((legacy) => [legacy.path, legacy] as const))(
    '%s 가 통합 검색으로 301 된다',
    (path) => {
      expect(redirectTargetOf(path).startsWith(`${ROUTES.noticeSearch}?`)).toBe(true);
    },
  );

  it.each(LEGACY_NOTICE_ROUTES.map((legacy) => [legacy.path, legacy] as const))(
    '%s 의 단계 필터가 라우트 표와 일치한다',
    (_path, legacy) => {
      const target = redirectTargetOf(legacy.path);
      if (legacy.category) {
        // 한글 단계 이름은 URL 인코딩해서 넘긴다.
        expect(target).toContain(`cat=${encodeURIComponent(legacy.category)}`);
      } else {
        /*
         * routePaths.ts 가 /search 와 /notices/bid-announce 에 단계를 걸지 않는
         * 이유를 적어 두었다 — '입찰'로 고정하면 '마감'으로 분류된 같은 공고가
         * 빠져서 예전 탭보다 좁은 결과가 나온다. 그 의도를 엣지에서도 지킨다.
         */
        expect(target).not.toContain('cat=');
      }
    },
  );

  it.each(LEGACY_NOTICE_ROUTES.map((legacy) => legacy.path))(
    '%s 는 진행 중 필터(active=true)를 심어서 넘긴다',
    (path) => {
      /*
       * 옛 주소는 "파라미터 없음 = 진행 중만"이었는데 지금 화면의 기본값은
       * "마감 포함"이다. 심지 않으면 같은 링크가 예전보다 넓은 결과를 낸다.
       * (LegacyNoticeRedirect 의 3번 주석과 같은 근거 — 서버·클라이언트가 같은
       *  주소로 착지해야 한다.)
       */
      expect(redirectTargetOf(path)).toContain('active=true');
    },
  );

  it.each(LEGACY_NOTICE_ROUTES.map((legacy) => legacy.path))(
    '%s 에 쿼리스트링이 있으면 301 하지 않고 셸을 준다',
    (path) => {
      /*
       * LegacyNoticeRedirect 는 파라미터 이름도 변환한다(q→and, category→cat, …).
       * 301 이 먼저 걸리면 그 컴포넌트가 마운트되지 않아 변환이 돌지 않고, 옛 링크의
       * 검색 조건이 오류 없이 사라진다. 그래서 301 은 쿼리가 없을 때로 제한하고
       * (`if ($args = "")`), 쿼리가 있으면 셸을 200 으로 내보내 클라이언트가 마저
       * 변환하게 한다. 자세한 근거는 docs/nginx-edge.md 5절.
       */
      const location = blockNamed(`location = ${path}`);
      expect(location.body).toMatch(/if\s*\(\s*\$args\s*=\s*""\s*\)/);
      expect(ownDirectives(location.body)).toMatch(/try_files\s+\/index\.html\s+=404\s*;/);
    },
  );
});

/* ─── 노출 범위 · 보안 헤더 ────────────────────────────────────────────────── */

describe('엣지에서 열어 두면 안 되는 것', () => {
  it.each(['/swagger-ui', '/v3/api-docs'])('%s 프록시가 설정에 없다', (path) => {
    /*
     * 감사 #8 — 라이브에서는 이 둘이 닫혀 있는데 저장소 설정에는 프록시가 남아
     * 있었다. 그대로 적용하면 "설정을 저장소로 되돌린다"가 API 문서를 새로
     * 공개하는 변경이 된다. 되살리지 말 것 — 근본 차단은 백엔드의
     * SPRINGDOC_*_ENABLED=false 다.
     */
    expect(CONF).not.toContain(path);
  });
});

describe('보안 헤더', () => {
  const SECURITY_HEADERS = [
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Permissions-Policy',
  ] as const;

  /** 자기 add_header 를 직접 가진 블록들 — 여기가 상속이 끊기는 자리다. */
  const carriers = BLOCKS.map((block) => ({ header: block.header, own: ownDirectives(block.body) }))
    .filter((block) => /add_header\s/.test(block.own));

  it('add_header 를 가진 블록이 넷 이상 잡힌다', () => {
    // 스캐너가 고장 나면 아래 검사가 조용히 0건을 돌게 되므로 먼저 세어 둔다.
    expect(carriers.length).toBeGreaterThanOrEqual(4);
  });

  it.each(SECURITY_HEADERS)('%s 가 존재한다', (header) => {
    expect(CONF).toContain(`add_header ${header} `);
  });

  it.each(carriers.map((block) => [block.header, block] as const))(
    '`%s` 가 보안 헤더 다섯 종을 함께 갖는다',
    (_header, block) => {
      /*
       * ⚠ nginx 의 add_header 는 상속되지 않는다 — 하위 블록에 add_header 가
       *   하나라도 있으면 상위 목록이 통째로 대체된다. 그래서 Cache-Control 한 줄
       *   때문에 그 경로에서만 보안 헤더가 증발할 수 있고, 응답을 직접 찍기 전까지
       *   아무 데서도 드러나지 않는다. 반복본이 갈라지는 것을 여기서 막는다.
       */
      for (const header of SECURITY_HEADERS) {
        expect(block.own).toContain(`add_header ${header} `);
      }
    },
  );

  it('CSP 는 아직 Report-Only 다', () => {
    /*
     * 강제로 바꾸는 것은 위반을 관측한 뒤다(docs/nginx-edge.md 1절). 이 앱은
     * jsdelivr 폰트 CDN 과 /api 를 쓰므로 잘못 걸면 "글자가 시스템 폰트로 떨어지고
     * 검색이 안 되는" 형태로 조용히 죽는다.
     */
    expect(CONF).toContain('add_header Content-Security-Policy-Report-Only ');
    expect(CONF).not.toMatch(/add_header\s+Content-Security-Policy\s/);
  });
});

/* ─── HTTP → HTTPS ─────────────────────────────────────────────────────────── */

describe('평문 HTTP', () => {
  it('listen 80 서버 블록이 HTTPS 로 301 한다', () => {
    const catchAll = blockNamed('location /', HTTP_BLOCKS);
    expect(catchAll.body).toMatch(/return\s+301\s+https:\/\/\$host\$request_uri\s*;/);
  });

  it('ACME 챌린지는 리다이렉트에서 빠져 있다', () => {
    /*
     * 없으면 certbot 이 --webroot 로 넘어가는 순간 갱신이 조용히 실패하고,
     * 사이트는 그때가 아니라 최대 90일 뒤에 죽는다.
     */
    const acme = blockNamed('location ^~ /.well-known/acme-challenge/', HTTP_BLOCKS);
    expect(acme.body).not.toMatch(/return\s+301/);
  });
});

/* ─── 404 페이지 ───────────────────────────────────────────────────────────── */

describe('정적 404 페이지', () => {
  const page = readFileSync(PAGE_404_PATH, 'utf8');

  it('noindex 를 달고 있다', () => {
    expect(page).toMatch(/<meta\s+name="robots"\s+content="noindex"\s*\/?>/);
  });

  it('번들을 로드하지 않는다', () => {
    /*
     * 없는 주소마다 SPA 전체를 태워서 "없습니다"를 그리는 것이 지금 고치고 있는
     * 문제(감사 #2)의 축소판이다. 크롤러가 이 페이지를 대량으로 받아 간다.
     */
    expect(page).not.toContain('<script');
  });
});
