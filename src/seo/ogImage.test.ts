/*
 * 공유 카드 — 선언과 실물이 같은가.
 *
 * 이 파일이 보는 것은 타입도 훅도 잡지 못하는 자리다. 표에 `path: '/og/beta.png'` 라고
 * 적는 것은 **그 파일이 실제로 있다는 약속이 아니다.** 오타가 나거나 파일 이름이 바뀌면
 * 타입은 통과하고 빌드도 통과하고 화면에도 아무 증상이 없다. 드러나는 것은 배포 뒤,
 * 누군가 링크를 카카오톡에 붙여 넣고 미리보기가 비어 나올 때다.
 *
 * 이 감사가 발견한 원래 결함이 정확히 그것이었다 — index.html 의 og:image 가 남의 도메인
 * 404 를 가리킨 채 몇 달을 지났고, 자산 자체는 이 도메인에 200 으로 멀쩡히 있었다.
 * 그러니 여기서는 표를 읽는 것으로 끝내지 않고 **파일을 연다.**
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ROUTES, type RoutePath } from '@/routes/routePaths';
import { resolveOgImage, ROUTE_META, type OgImage } from './routeMeta';
import { SITE_ORIGIN } from './siteOrigin';

/*
 * ⚠ `new URL('../../public/', import.meta.url)` 을 쓰지 않는다.
 *
 * 그 형태는 vite 가 **자산 참조로 알아보고 빌드 시점에 고쳐 쓰는** 특수 구문이다. 테스트도
 * vite 의 변환을 거치므로 여기서도 발동해, 파일 경로 대신 `http://localhost:3000/public`
 * 이 나온다(그 뒤 fileURLToPath 가 "must be of scheme file" 로 죽는다). 화면에서는 편리한
 * 기능이지만 여기서는 그냥 디렉터리 하나를 가리키려는 것뿐이라 path 로 잇는다.
 */
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

/** 카카오톡이 미리보기를 포기하기 시작하는 지점. 기존 카드는 64,819 B 다. */
const MAX_BYTES = 200_000;

const CARDS: ReadonlyArray<[RoutePath, OgImage]> = (Object.values(ROUTES) as RoutePath[])
  .map((path) => [path, ROUTE_META[path].image] as const)
  .filter((entry): entry is [RoutePath, OgImage] => entry[1] !== undefined);

/**
 * PNG 헤더에서 실제 픽셀 크기를 읽는다.
 *
 * IHDR 은 규격상 언제나 첫 청크라 위치가 고정이다 — 서명 8바이트, 길이 4, 타입 4 다음
 * 16번째 바이트부터 폭·높이가 각각 4바이트 빅엔디언으로 온다. 라이브러리를 붙이지 않는
 * 이유는 이 열여섯 바이트를 읽자고 의존성을 하나 늘릴 일이 아니어서다.
 */
function readPng(file: string): { width: number; height: number; bytes: number } {
  const buffer = readFileSync(file);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buffer.subarray(0, 8).equals(signature)) {
    throw new Error(`${file} 이 PNG 가 아닙니다. og:image 는 반드시 래스터여야 합니다.`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bytes: buffer.length,
  };
}

describe('카드 파일이 실재한다', () => {
  it('표가 카드를 가진 라우트가 있다', () => {
    // 0장이면 아래 검사들이 전부 조용히 통과한다. 배선만 남고 카드가 사라진 상태를 잡는다.
    expect(CARDS.length).toBeGreaterThan(0);
  });

  it.each(CARDS)('%s 의 카드가 public/ 아래에 있다', (_path, image) => {
    expect(image.path.startsWith('/'), `${image.path} 는 '/' 로 시작해야 한다`).toBe(true);
    // 열리지 않으면 readFileSync 가 던진다 — 그것이 곧 이 테스트의 실패다.
    expect(() => readPng(join(PUBLIC_DIR, image.path))).not.toThrow();
  });

  it.each(CARDS)('%s 의 선언한 크기가 PNG 헤더와 같다', (_path, image) => {
    const png = readPng(join(PUBLIC_DIR, image.path));
    expect({ width: png.width, height: png.height }).toEqual({
      width: image.width,
      height: image.height,
    });
  });

  it.each(CARDS)('%s 의 카드가 1200×630 이다', (_path, image) => {
    /*
     * og:image:width·height 가 실물과 달라도 크롤러는 대개 알아서 다시 재지만, 그 전에
     * 첫 스크랩 결과를 캐시한다. 1200×630 을 벗어나면 카카오톡이 정사각형으로 잘라
     * 카드 왼쪽·오른쪽 글자가 사라진다.
     */
    expect([image.width, image.height]).toEqual([1200, 630]);
  });

  it.each(CARDS)('%s 의 카드가 파일 크기 한도 안이다', (_path, image) => {
    const png = readPng(join(PUBLIC_DIR, image.path));
    expect(png.bytes, `${image.path}: ${png.bytes.toLocaleString()} B`).toBeLessThanOrEqual(
      MAX_BYTES,
    );
  });

  it.each(CARDS)('%s 의 alt 가 카드 내용을 설명한다', (_path, image) => {
    // 빈 alt 는 "장식용 이미지"라는 선언이다. 공유 카드는 그 반대 — 문서의 얼굴이다.
    expect(image.alt.trim().length).toBeGreaterThanOrEqual(20);
  });
});

/** 표에서 카드를 꺼낸다. 없으면 던진다 — 없는 것 자체가 이 파일이 잡아야 할 실패다. */
function cardFor(path: RoutePath): OgImage {
  const image = ROUTE_META[path].image;
  if (!image) throw new Error(`${path} 에 카드가 없다`);
  return image;
}

describe('resolveOgImage', () => {
  it('절대 URL 을 만든다', () => {
    expect(resolveOgImage(cardFor(ROUTES.beta)).url).toBe(`${SITE_ORIGIN}/og/beta.png`);
  });

  it('크기를 문자열로 내보낸다', () => {
    // meta content 는 문자열이다. 숫자를 그대로 넣으면 setAttribute 가 조용히 바꿔 주지만,
    // 프리렌더처럼 문자열을 직접 조립하는 쪽에서는 그 관용이 없다.
    const resolved = resolveOgImage({ path: '/og/x.png', width: 1200, height: 630, alt: 'x' });
    expect(resolved.width).toBe('1200');
    expect(resolved.height).toBe('630');
  });

  it('상대 경로를 내보내지 않는다', () => {
    /*
     * OG 소비자는 상대 경로를 해석하지 않는다. 이 한 줄이 이 파일에서 제일 중요하다 —
     * 상대 경로를 내보내면 태그는 멀쩡히 있는데 미리보기만 비어 나가고, 그 상태가
     * 사람 눈에는 "og:image 가 잘 들어가 있다"로 보인다.
     */
    for (const [, image] of CARDS) {
      const { url } = resolveOgImage(image);
      expect(url.startsWith(`${SITE_ORIGIN}/`), url).toBe(true);
      expect(url).not.toContain('vercel.app');
    }
  });
});

describe('카드를 두지 않은 라우트', () => {
  it('색인 제외 라우트에는 카드가 없다', () => {
    /*
     * 색인되지 않는 화면에 공유 카드를 만드는 것은 아무도 도착하지 않는 주소에 간판을
     * 다는 일이다. 누군가 "이왕 만드는 김에"로 늘리는 것을 여기서 막는다.
     */
    for (const path of Object.values(ROUTES) as RoutePath[]) {
      const meta = ROUTE_META[path];
      if (meta.robots?.includes('noindex')) {
        expect(meta.image, `${path} 는 noindex 인데 카드가 있다`).toBeUndefined();
      }
    }
  });

  it('/notices 는 범용 카드를 그대로 쓴다', () => {
    // public/og-image.png 에 그려진 글자가 이미 이 화면의 제목이다. 따로 그리면 같은 말을
    // 하는 카드가 두 장이 되고, 랜딩 카피가 바뀌는 날 둘 중 하나만 고쳐진다.
    expect(ROUTE_META[ROUTES.noticeSearch].image).toBeUndefined();
  });

  it('/beta 만 카드를 가진다', () => {
    expect(CARDS.map(([path]) => path)).toEqual([ROUTES.beta]);
  });
});
