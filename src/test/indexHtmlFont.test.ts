/*
 * index.html 의 폰트 로딩 블록을 잠그는 회귀 시험.
 *
 * 이 블록의 실수는 전부 "화면에는 아무 증상이 없는" 종류다. preload 버전이 stylesheet 와
 * 어긋나도 글자는 멀쩡히 나오고(그냥 아무도 안 쓰는 파일을 하나 더 받을 뿐이다), crossorigin
 * 을 빠뜨려도 글자는 나온다(같은 파일을 두 번 받을 뿐이다). 사람이 <head> 를 다시 읽을 이유가
 * 없으므로 눈으로는 영원히 안 잡힌다 — indexHtmlSeo.test.ts 와 같은 이유로 시험이 잡는다.
 *
 * 결정의 근거는 docs/font-loading.md 에 있다. 여기서 잠그는 건 그 결정이 무너지는 지점들이다.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// indexHtmlSeo.test.ts 와 같은 이유로 cwd 가 아니라 이 파일 위치 기준으로 푼다.
// (`new URL(..., import.meta.url)` 은 vite 가 자산 참조로 바꿔치기하므로 쓰면 안 된다.)
const INDEX_HTML_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html');
const html = readFileSync(INDEX_HTML_PATH, 'utf8');

const FONT_CDN = 'https://cdn.jsdelivr.net';

/** 여러 줄에 걸친 <link ...> 를 통째로 집는다. rel 속성이 어느 자리에 있든 걸린다. */
function linkTags(): string[] {
  return html.match(/<link\b[\s\S]*?\/?>/g) ?? [];
}

function linksWithRel(rel: string): string[] {
  return linkTags().filter((tag) => new RegExp(`rel="${rel}"`).test(tag));
}

/** jsdelivr URL 에서 `@v1.3.9` 의 버전만 뽑는다. */
function pretendardVersion(tag: string): string | null {
  return tag.match(/pretendard@(v[\d.]+)/)?.[1] ?? null;
}

describe('index.html 폰트 로딩', () => {
  it('Pretendard dynamic-subset 을 평범한 블로킹 stylesheet 로 부른다', () => {
    // 비블로킹(media="print" onload) 으로 바꾸면 크롬이 우선순위를 내려 CSS 가 늦게 오고,
    // 규칙이 전부 font-display:swap 이라 교체가 첫 페인트 뒤로 밀린다 — CLS 를 만든다.
    // 블로킹이라는 사실이 <noscript> 폴백이 필요 없는 이유이기도 하다.
    const stylesheets = linksWithRel('stylesheet').filter((tag) => tag.includes('pretendard'));
    expect(stylesheets).toHaveLength(1);
    expect(stylesheets[0]).toContain('pretendardvariable-dynamic-subset.min.css');
    expect(stylesheets[0]).not.toMatch(/media=/);
  });

  it('폰트 블록에 인라인 이벤트 핸들러가 없다', () => {
    // CSP 담당이 script-src 를 조일 때 걸릴 유일한 지점이다. 인라인 onload 를 쓰는 순간
    // 폰트 하나 때문에 'unsafe-inline' 을 열어 줘야 한다. 그 거래를 하지 않기로 했다.
    for (const tag of linkTags()) {
      expect(tag).not.toMatch(/\son[a-z]+=/i);
    }
  });

  it('첫 화면용 조각 두 개를 preload 한다', () => {
    // 폰트 요청은 CSS 가 아니라 React 가 글자를 그린 뒤에 시작된다. 이 두 줄이 그것을
    // HTML 파싱 시점으로 당겨 JS 다운로드와 겹치게 한다 — 교체(FOUT)를 없애는 수단이다.
    const preloads = linksWithRel('preload').filter((tag) => tag.includes('pretendard'));
    expect(preloads).toHaveLength(2);
    for (const tag of preloads) {
      expect(tag).toContain('as="font"');
      expect(tag).toContain('type="font/woff2"');
      // crossorigin 이 없으면 preload 와 실제 폰트 요청의 CORS 모드가 달라 재사용되지
      // 않는다. 같은 파일을 두 번 받게 되고, 아무 오류도 나지 않는다.
      expect(tag).toMatch(/\bcrossorigin\b/);
    }
  });

  it('preload 와 stylesheet 의 Pretendard 버전이 같다', () => {
    // 한쪽만 올리면 preload 가 아무도 안 쓰는 파일을 받아 온다. 증상은 "느려진 것 같다"가
    // 전부라 추적이 안 된다. 버전을 올릴 때는 세 URL 을 함께 올려라.
    const tags = [...linksWithRel('preload'), ...linksWithRel('stylesheet')].filter((tag) =>
      tag.includes('pretendard'),
    );
    const versions = new Set(tags.map(pretendardVersion));
    expect(versions.size).toBe(1);
    expect([...versions][0]).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  it('폰트 오리진에 preconnect 를 걸고, 그 링크가 폰트 요청보다 앞에 있다', () => {
    const preconnects = linksWithRel('preconnect');
    expect(preconnects.some((tag) => tag.includes(FONT_CDN))).toBe(true);

    // 순서가 뒤집히면 preconnect 는 아무것도 앞당기지 못한다.
    const preconnectAt = html.indexOf('rel="preconnect"');
    const firstFontFetchAt = html.indexOf('rel="preload"');
    expect(preconnectAt).toBeGreaterThan(-1);
    expect(firstFontFetchAt).toBeGreaterThan(preconnectAt);
  });

  it('폰트를 자체 호스팅으로 옮기지 않았다 — 옮겼다면 이 시험부터 다시 써라', () => {
    // 92개 조각 2.82 MB 를 저장소에 넣지 않기로 한 결정이다(docs/font-loading.md).
    // 언젠가 뒤집는다면 그건 의도된 큰 변경이므로, 여기가 그 사실을 알리는 자리다.
    const fontTags = linkTags().filter((tag) => tag.includes('pretendard'));
    expect(fontTags.length).toBeGreaterThan(0);
    for (const tag of fontTags) {
      expect(tag).toContain(FONT_CDN);
    }
  });
});
