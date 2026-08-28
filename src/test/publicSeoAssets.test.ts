/// <reference types="node" />
/*
 * public/ 의 크롤러용 정적 파일에 대한 잠금 장치.
 *
 * 이 파일들은 아무도 임포트하지 않는다. 빌드가 통째로 베껴 갈 뿐이라 타입 검사도 린트도
 * 닿지 않고, 틀려도 화면에는 아무 표시가 나지 않는다. 실제로 사이트맵의 유일한 <loc> 이
 * 반년 넘게 남의 도메인(g2bmasters-open.vercel.app)을 가리키고 있었는데 아무도 몰랐다.
 *
 * 특히 값이 있는 검사는 **사이트맵의 모든 <loc> 이 ROUTES 에 실제로 있는 경로인가**이다.
 * 라우트 이름을 바꾸거나 화면을 접으면 사이트맵은 조용히 죽은 주소를 가리키게 되고, 그
 * 결과는 크롤러가 404 를 긁는 것이라 배포한 쪽에서는 영영 보이지 않는다. 여기서 잡는다.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ROUTES } from '@/routes/routePaths';

/** 이 사이트의 유일한 정본 오리진. 여기서 벗어난 호스트는 전부 사고다. */
const ORIGIN = 'https://g2b-masters.electerior.co.kr';

/**
 * cwd 가 아니라 이 파일 위치를 기준으로 푼다. vitest 를 어디서 실행하든(루트·에디터·CI)
 * 같은 파일을 읽어야 한다.
 *
 * `new URL('../../public/x', import.meta.url)` 로 쓰지 않는다. 그 모양은 vite 가 에셋
 * 참조로 알아보고 변환해 버려서, 런타임에는 파일 경로가 아니라 개발 서버의 URL
 * (`http://localhost:3000/sitemap.xml`)이 들어온다. 여기서 필요한 것은 디스크 경로다.
 */
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

function readPublic(name: string): string {
  return readFileSync(join(PUBLIC_DIR, name), 'utf-8');
}

const sitemap = readPublic('sitemap.xml');
const robots = readPublic('robots.txt');
const llms = readPublic('llms.txt');

/**
 * <loc> 값을 뽑는다. 주석 안의 경로는 잡히지 않는다 — 사이트맵 주석에는 '왜 뺐는지'를
 * 적느라 제외한 경로 이름들이 그대로 들어 있어서, 원문 문자열을 훑는 방식으로 검사하면
 * 그 설명 때문에 테스트가 깨진다. 검사 대상은 언제나 파싱된 값이어야 한다.
 */
function locsOf(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return [...doc.getElementsByTagName('loc')].map((el) => el.textContent?.trim() ?? '');
}

describe('public/sitemap.xml', () => {
  it('유효한 XML 이다', () => {
    const doc = new DOMParser().parseFromString(sitemap, 'application/xml');
    // 파서는 던지지 않고 문서 안에 parsererror 노드를 심는다.
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.documentElement.tagName).toBe('urlset');
  });

  it('모든 <loc> 이 이 도메인이다', () => {
    const locs = locsOf(sitemap);
    expect(locs.length).toBeGreaterThan(0);
    for (const loc of locs) {
      expect(loc.startsWith(`${ORIGIN}/`)).toBe(true);
    }
  });

  it('모든 <loc> 의 경로가 ROUTES 에 실제로 있다', () => {
    // 이 테스트의 핵심. 사이트맵이 죽은 라우트를 가리키는 사고를 막는다.
    const known = new Set<string>(Object.values(ROUTES));
    const unknown = locsOf(sitemap)
      .map((loc) => loc.slice(ORIGIN.length))
      .filter((path) => !known.has(path));
    expect(unknown).toEqual([]);
  });

  it('공개 화면 셋을 모두 담는다', () => {
    // 화면을 늘렸다고 아무 주소나 흘러들어오거나, 반대로 조용히 빠지는 것을 함께 막는다.
    // ACTION-PLAN 1.3 은 8개를 지정했지만, 그 뒤 화면이 공고 중심으로 정리되면서
    // 단가 DB·트렌드 셋·스펙 검색이 없어졌다. 남은 공개 주소는 이 셋이다.
    expect(locsOf(sitemap).map((loc) => loc.slice(ORIGIN.length)).sort()).toEqual(
      [ROUTES.beta, ROUTES.noticeSearch, ROUTES.bidResult].sort(),
    );
  });

  it('사용자별·내부 화면은 담지 않는다', () => {
    // noindex 로 처리할 화면들이다. 사이트맵에 올리면 "색인해 달라"와 "색인하지 마라"를
    // 동시에 말하는 셈이라 신호가 서로 부딪힌다.
    const locs = locsOf(sitemap);
    for (const path of [ROUTES.saved, ROUTES.system]) {
      expect(locs).not.toContain(`${ORIGIN}${path}`);
    }
  });
});

describe('public/robots.txt', () => {
  it('백엔드 API 를 막는다', () => {
    expect(robots).toMatch(/^Disallow:\s*\/api\/\s*$/m);
  });

  it('Sitemap 지시자가 이 도메인을 가리킨다', () => {
    expect(robots).toMatch(
      new RegExp(`^Sitemap:\\s*${ORIGIN.replace(/[.]/g, '\\.')}/sitemap\\.xml\\s*$`, 'm'),
    );
  });

  it('내부 화면을 robots 로 막지 않는다', () => {
    // 일부러 막지 않는다. Disallow 는 "가져오지 마라"이지 "색인하지 마라"가 아니라서,
    // 막으면 크롤러가 그 화면의 noindex 를 읽지 못한 채 URL 만 색인에 남긴다.
    // 선의로 한 줄 추가하는 일을 여기서 막는다 — 근거는 robots.txt 주석에 있다.
    const directives = robots
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^Disallow:/i.test(line));
    expect(directives).toEqual(['Disallow: /api/']);
  });
});

describe('public/llms.txt', () => {
  it('내용이 있고 이 서비스의 이름으로 시작한다', () => {
    expect(llms.trim().startsWith('# G2B Masters')).toBe(true);
  });
});

describe('크롤러용 정적 파일 전체', () => {
  it('어디에도 옛 vercel 호스트가 남아 있지 않다', () => {
    // 이 세 파일이 vercel 도메인을 말하면 이 도메인의 신호가 통째로 남에게 넘어간다.
    // 주석까지 포함해 원문을 훑는다 — 주석에 옛 호스트를 예시로 남기는 것도 막는다.
    for (const [name, text] of [
      ['sitemap.xml', sitemap],
      ['robots.txt', robots],
      ['llms.txt', llms],
    ] as const) {
      expect(`${name}: ${text}`).not.toContain('vercel.app');
    }
  });
});
