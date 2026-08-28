/*
 * 아이콘·매니페스트 세트가 "선언한 대로 실재하는지" 지키는 회귀 시험.
 *
 * 왜 시험까지 두는가: 이 카테고리의 사고는 **선언과 실물이 갈라지는 것** 한 가지였고,
 * 그것이 배포에서 눈에 띄지 않는 이유가 둘이나 있었다.
 *
 * 1) `<link rel="icon">` 이 가리키던 `/electerior-logo.svg` 는 viewBox 가 192×42 인
 *    가로 워드마크였다. 파일은 200 으로 잘 내려갔고 SVG 자체도 잘 만들어져 있어서
 *    "아이콘이 있다"는 사실만 보면 아무 문제가 없다. 4.57:1 을 정사각 슬롯에 밀어 넣으면
 *    글자가 뭉개진다는 것은 파일 존재 검사로는 절대 잡히지 않는다.
 * 2) 관습적인 아이콘 경로(`/favicon.ico`, `/apple-touch-icon.png`, `/site.webmanifest` …)가
 *    하나도 없었는데, nginx 의 try_files 캐치올이 그 자리에 **HTTP 200 + text/html + SPA 셸**을
 *    돌려줬다. 상태 코드로는 "있다"고 나오고, 파비콘을 요청한 브라우저는 HTML 문서를 받았다.
 *    없는 것이 없다고 보이지 않는 상태였다.
 *
 * 그래서 이 시험은 파일이 있는지만 묻지 않는다. **선언한 sizes 가 파일의 실제 픽셀 크기와
 * 같은지**까지 본다. 이미지 라이브러리 없이 PNG 의 IHDR 과 ICO 디렉터리를 직접 읽으면 된다 —
 * 그 두 헤더는 파일 맨 앞 몇십 바이트에 고정 위치로 들어 있다.
 *
 * 검사 대상은 빌드 산출물이 아니라 저장소의 index.html 과 public/ 자체다. vite 는 index.html 을
 * 그대로, public/ 을 통째로 dist 로 내보내므로 원본을 잠그면 배포본도 잠긴다.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DEFAULT_ROUTE } from '@/routes/routePaths';

// cwd 가 아니라 이 파일 위치를 기준으로 푼다 — 워크트리·CI 어디서 돌아도 같은 파일을 본다.
// `new URL(..., import.meta.url)` 로 쓰면 vite 가 자산 참조로 알고 개발 서버 주소로 바꿔치기한다
// (indexHtmlSeo.test.ts 의 같은 주석 참고). import.meta.url 을 먼저 경로로 바꾼 뒤 올라간다.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const INDEX_HTML_PATH = resolve(REPO_ROOT, 'index.html');
const PUBLIC_DIR = resolve(REPO_ROOT, 'public');

const html = readFileSync(INDEX_HTML_PATH, 'utf8');
const doc = new DOMParser().parseFromString(html, 'text/html');

/** public/ 의 자산은 절대 경로(`/foo.png`)로 선언된다 — 그 경로를 파일 경로로 되돌린다. */
function publicPath(href: string): string {
  return resolve(PUBLIC_DIR, href.replace(/^\//, ''));
}

function readPublic(href: string): Buffer {
  return readFileSync(publicPath(href));
}

/**
 * PNG 의 실제 픽셀 크기와 색 타입을 IHDR 에서 직접 읽는다.
 *
 * PNG 는 8바이트 시그니처 뒤 첫 청크가 반드시 IHDR 이고 그 자리가 고정이라, 라이브러리 없이
 * 읽을 수 있다: 16..19 폭, 20..23 높이, 24 비트깊이, 25 색 타입.
 * 색 타입 0(회색)·2(RGB) 만 알파 채널이 없다 — 4·6 은 알파, 3(팔레트)은 tRNS 로 투명을 갖는다.
 */
function readPng(buf: Buffer): { width: number; height: number; colorType: number } {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(buf.subarray(0, 8).equals(signature), 'PNG 시그니처가 아니다').toBe(true);
  expect(buf.subarray(12, 16).toString('ascii'), '첫 청크가 IHDR 이 아니다').toBe('IHDR');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] };
}

/**
 * ICO 가 실제로 담고 있는 프레임 크기 목록을 디렉터리에서 읽는다.
 *
 * 머리 6바이트(예약 0 / 타입 1 / 프레임 수) 뒤로 16바이트짜리 항목이 이어지고, 각 항목의
 * 첫 두 바이트가 폭·높이다. 0 은 256 을 뜻한다(한 바이트에 256 이 안 들어가서 생긴 규약).
 */
function readIcoSizes(buf: Buffer): string[] {
  expect(buf.readUInt16LE(0), 'ICO 예약 필드가 0 이 아니다').toBe(0);
  expect(buf.readUInt16LE(2), 'ICO 타입이 아이콘(1)이 아니다').toBe(1);
  const count = buf.readUInt16LE(4);
  expect(count, 'ICO 에 프레임이 하나도 없다').toBeGreaterThan(0);
  return Array.from({ length: count }, (_, i) => {
    const entry = 6 + i * 16;
    const w = buf[entry] === 0 ? 256 : buf[entry];
    const h = buf[entry + 1] === 0 ? 256 : buf[entry + 1];
    return `${w}x${h}`;
  });
}

function svgViewBox(href: string): number[] {
  const text = readPublic(href).toString('utf8');
  const match = /viewBox="([^"]+)"/.exec(text);
  expect(match, `${href} 에 viewBox 가 없다`).not.toBeNull();
  return match![1].trim().split(/\s+/).map(Number);
}

/** 이 파일이 쓰는 fill 값의 집합. 단색(mask-icon) 여부를 판정하는 데 쓴다. */
function svgFills(href: string): Set<string> {
  const text = readPublic(href).toString('utf8');
  return new Set(Array.from(text.matchAll(/fill="([^"]+)"/g), (m) => m[1].toLowerCase()));
}

function attr(selector: string, name: string): string {
  const el = doc.querySelector(selector);
  expect(el, `index.html 에 ${selector} 가 없다`).not.toBeNull();
  const value = el!.getAttribute(name);
  expect(value, `${selector} 에 ${name} 속성이 없다`).not.toBeNull();
  return value!;
}

/** index.html 이 자산을 가리키는 모든 아이콘·매니페스트 링크. */
const ICON_LINK_SELECTOR =
  'link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="mask-icon"], link[rel="manifest"]';
const iconLinks = Array.from(doc.querySelectorAll(ICON_LINK_SELECTOR)).map((el) => ({
  rel: el.getAttribute('rel')!,
  href: el.getAttribute('href')!,
  sizes: el.getAttribute('sizes'),
}));

const manifestHref = attr('link[rel="manifest"]', 'href');
const manifestRaw = readPublic(manifestHref).toString('utf8');

describe('index.html 이 선언한 아이콘 자산', () => {
  it('아이콘·매니페스트 링크가 다섯 슬롯을 모두 채운다', () => {
    // 슬롯이 조용히 사라지는 것도 회귀다 — 아래 검사들은 "선언된 것"만 보므로,
    // 무엇이 선언돼 있어야 하는지를 여기서 먼저 못 박는다.
    expect(iconLinks.map((l) => l.rel).sort()).toEqual([
      'apple-touch-icon',
      'icon',
      'icon',
      'manifest',
      'mask-icon',
    ]);
  });

  it.each(iconLinks.map((link) => [link.rel, link.href] as const))(
    'rel=%s 가 가리키는 %s 가 public/ 에 실재한다',
    (_rel, href) => {
      // 감사 시점에는 이 경로들이 전부 404 대신 5,851 바이트짜리 SPA 셸을 돌려줬다.
      // 파일이 없는데도 200 이 나오는 배포 구성이라, 파일 존재는 여기서 잠근다.
      expect(() => readPublic(href)).not.toThrow();
      expect(readPublic(href).length, `${href} 가 빈 파일이다`).toBeGreaterThan(0);
    },
  );

  it.each(
    iconLinks
      .filter((link) => link.sizes && link.sizes !== 'any')
      .map((link) => [link.href, link.sizes!] as const),
  )('%s 의 sizes="%s" 가 파일의 실제 픽셀 크기와 일치한다', (href, sizes) => {
    // 이번 감사의 근본 원인이 "선언과 실물이 갈라진 것"이다. 존재 검사만으로는
    // 192×42 워드마크를 16×16 슬롯에 선언해 둔 상태를 잡아내지 못했다.
    const declared = sizes.split(/\s+/).sort();
    const buf = readPublic(href);
    if (href.endsWith('.ico')) {
      // ICO 는 양방향으로 본다 — 선언에 없는 프레임이 들어 있는 것도, 선언한 프레임이
      // 빠진 것도 똑같이 거짓말이다.
      expect(readIcoSizes(buf).sort()).toEqual(declared);
    } else {
      const { width, height } = readPng(buf);
      expect([`${width}x${height}`]).toEqual(declared);
    }
  });

  it('아이콘 슬롯의 SVG 는 정사각 viewBox 를 갖는다', () => {
    // 감사가 잡은 첫 번째 결함이 바로 이것이다: `viewBox="0 0 192 42"` 인 4.57:1 워드마크가
    // 정사각 탭 슬롯에 걸려 있었다. 비율 하나만 보면 되는 검사라 값싸고, 다시는 못 들어온다.
    const svgLinks = iconLinks.filter((link) => link.href.endsWith('.svg'));
    expect(svgLinks.length, '아이콘 슬롯에 SVG 가 하나도 없다').toBeGreaterThan(0);
    for (const link of svgLinks) {
      const [, , width, height] = svgViewBox(link.href);
      expect(width, `${link.href} 의 viewBox 가 정사각이 아니다`).toBe(height);
    }
  });

  it('워드마크는 아이콘 슬롯으로 돌아오지 않고, 파일 자체는 남아 있다', () => {
    // 워드마크를 지우지 않은 것은 실수가 아니다 — JSON-LD 의 Organization "logo" 가 그것을
    // 가리키고, schema.org 의 logo 는 정사각 마크가 아니라 실제 로고 락업을 원한다.
    // 지워야 할 것은 파일이 아니라 그 파일이 아이콘 슬롯에 놓여 있던 배치였다.
    expect(iconLinks.map((link) => link.href)).not.toContain('/electerior-logo.svg');
    expect(html).toContain('/electerior-logo.svg'); // JSON-LD 쪽 참조는 살아 있어야 한다
    expect(readPublic('/electerior-logo.svg').length).toBeGreaterThan(0);
  });

  it('apple-touch-icon 은 알파 채널이 없는 불투명 PNG 다', () => {
    // iOS 는 홈 화면 아이콘의 알파를 **검게** 합성한다. 투명 배경으로 내보내면 브랜드색
    // 타일이 아니라 검은 타일이 된다. 색 타입 0(회색)·2(RGB)만 알파 채널이 없다.
    const { colorType } = readPng(readPublic(attr('link[rel="apple-touch-icon"]', 'href')));
    expect([0, 2]).toContain(colorType);
  });

  it('mask-icon 은 단색 실루엣이다', () => {
    // 사파리 고정 탭은 단색 SVG 만 받고 색은 link 의 color 속성으로 준다. 배경 판이나
    // 두 번째 색이 섞이면 실루엣이 통째로 뭉개진다.
    const href = attr('link[rel="mask-icon"]', 'href');
    expect(svgFills(href)).toEqual(new Set(['#000000']));
    expect(attr('link[rel="mask-icon"]', 'color')).toBe(
      attr('meta[name="theme-color"]', 'content'),
    );
  });

  it('SVG 아이콘의 바탕색이 theme-color 와 같다', () => {
    // 설치된 앱의 상단 크롬(theme-color)과 아이콘 바탕이 다른 파랑이면 한 화면에서 어긋나 보인다.
    // 값을 양쪽에 적어 두는 대신 여기서 묶는다.
    const themeColor = attr('meta[name="theme-color"]', 'content').toLowerCase();
    expect(svgFills('/icon.svg')).toContain(themeColor);
  });
});

describe('site.webmanifest', () => {
  const manifest = JSON.parse(manifestRaw) as {
    name: string;
    short_name: string;
    lang: string;
    start_url: string;
    scope: string;
    display: string;
    theme_color: string;
    background_color: string;
    icons: { src: string; sizes: string; type: string; purpose: string }[];
  };

  it('JSON 으로 파싱되고 필수 키가 모두 있다', () => {
    for (const key of [
      'name',
      'short_name',
      'icons',
      'theme_color',
      'background_color',
      'display',
      'lang',
      'start_url',
    ] as const) {
      expect(manifest[key], `manifest 에 ${key} 가 없다`).toBeTruthy();
    }
  });

  it('name·short_name 이 index.html 의 title·og:site_name 과 같다', () => {
    // 매니페스트 값은 지어내지 않는다. 설치 프롬프트에 뜨는 이름과 탭 제목이 다르면
    // 같은 서비스인지 알아볼 수 없다.
    const title = doc.querySelector('title')!.textContent!;
    expect(manifest.name).toBe(title);
    expect(manifest.short_name).toBe(attr('meta[property="og:site_name"]', 'content'));
  });

  it('theme_color 가 index.html 의 theme-color 와 같다', () => {
    // 둘이 갈라지면 안드로이드 스플래시와 상태 표시줄이 서로 다른 색을 쓴다.
    expect(manifest.theme_color).toBe(attr('meta[name="theme-color"]', 'content'));
  });

  it('start_url 이 라우터의 DEFAULT_ROUTE 와 같다', () => {
    // 설치된 앱이 여는 첫 화면은 `/` 진입이 실제로 도착하는 곳이어야 한다.
    // DEFAULT_ROUTE 가 옮겨 가면 이 시험이 매니페스트도 같이 옮기라고 알려 준다.
    expect(manifest.start_url).toBe(DEFAULT_ROUTE);
    expect(DEFAULT_ROUTE.startsWith(manifest.scope)).toBe(true);
  });

  it('lang 이 JSON-LD 의 inLanguage 와 같다', () => {
    expect(html).toContain(`"inLanguage": "${manifest.lang}"`);
  });

  // 같은 파일이 purpose 만 달리해 두 번 실리므로 src+sizes 기준으로 중복을 걷어 낸다.
  const uniqueIcons = Array.from(
    new Map(manifest.icons.map((icon) => [`${icon.src}|${icon.sizes}`, icon])).values(),
  ).map((icon) => [icon.src, icon.sizes] as const);

  it.each(uniqueIcons)('icons 의 %s (%s) 가 실재하고 선언한 크기와 일치한다', (src, sizes) => {
    const buf = readPublic(src);
    expect(buf.length, `${src} 가 빈 파일이다`).toBeGreaterThan(0);
    if (sizes === 'any') {
      const [, , width, height] = svgViewBox(src);
      expect(width).toBe(height);
    } else {
      const { width, height } = readPng(buf);
      expect(`${width}x${height}`).toBe(sizes);
    }
  });

  it('maskable 로 선언한 아이콘은 알파 채널이 없다', () => {
    // 안드로이드는 maskable 아이콘을 자기 모양(원·스퀘어클)으로 잘라 낸다. 그 안쪽이
    // 투명하면 잘린 자리에 배경이 비쳐 홈이 생긴다. 풀블리드 불투명이 아니면 선언하면 안 된다.
    const maskable = manifest.icons.filter((icon) => icon.purpose.split(/\s+/).includes('maskable'));
    expect(maskable.length, 'maskable 아이콘이 하나도 없다').toBeGreaterThan(0);
    for (const icon of maskable) {
      expect(icon.src.endsWith('.png'), `${icon.src} 는 래스터여야 한다`).toBe(true);
      expect([0, 2], `${icon.src} 에 알파 채널이 있다`).toContain(
        readPng(readPublic(icon.src)).colorType,
      );
    }
  });

  it('192·512 두 크기를 any 와 maskable 양쪽으로 제공한다', () => {
    // Lighthouse 의 설치 가능성 검사가 요구하는 최소 조합이다.
    const have = new Set(
      manifest.icons.flatMap((icon) =>
        icon.purpose.split(/\s+/).map((purpose) => `${icon.sizes}:${purpose}`),
      ),
    );
    for (const want of ['192x192:any', '512x512:any', '192x192:maskable', '512x512:maskable']) {
      expect(have, `manifest 에 ${want} 아이콘이 없다`).toContain(want);
    }
  });
});
