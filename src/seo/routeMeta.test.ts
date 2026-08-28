/*
 * 라우트 메타 표 자체의 성질.
 *
 * 표는 `Record<RoutePath, RouteMeta>` 라 항목이 **빠지면** 컴파일이 깨진다. 하지만 타입은
 * 항목이 **비었는지**(빈 문자열), 열다섯 항목이 서로 **같은지**는 잡지 못한다 — 그리고 이
 * 감사가 지적한 원래 문제가 정확히 "열다섯 주소가 같은 제목·같은 설명"이었다. 타입이 못 보는
 * 그 자리를 여기서 본다.
 */
import { describe, expect, it } from 'vitest';
import { ROUTES, type RoutePath } from '@/routes/routePaths';
import { metaForPath, NOT_FOUND_META, ROUTE_META } from './routeMeta';
import { canonicalUrlFor, SITE_ORIGIN } from './siteOrigin';

const ALL_PATHS = Object.values(ROUTES) as RoutePath[];
const ALL_META = [...ALL_PATHS.map((path) => ROUTE_META[path]), NOT_FOUND_META];

/**
 * description 길이 범위.
 *
 * ACTION-PLAN 2.1 은 80~130자를 목표로 적었지만 정작 그 절이 준 초안들은 45~65자다. 초안을
 * 그대로 쓰라는 지시와 길이 목표가 어긋나므로, 여기서는 **검색 결과에 실릴 수 있는 한 줄인가**
 * 만 본다: 너무 짧으면 아무 정보가 없고, 너무 길면 어차피 잘린다.
 */
const MIN_DESCRIPTION = 40;
const MAX_DESCRIPTION = 160;

describe('라우트 메타 표', () => {
  it('ROUTES 의 모든 값에 메타가 있다', () => {
    // 타입으로 막혀 있지만 런타임에서도 확인한다 — 표에 키만 있고 값이 비어 있는 경우,
    // 그리고 ROUTES 가 늘었는데 이 테스트만 통과하는 경우를 함께 잡는다.
    for (const path of ALL_PATHS) {
      const meta = ROUTE_META[path];
      expect(meta, `${path} 의 메타가 없다`).toBeDefined();
      expect(meta.title.trim(), `${path} 의 title 이 비었다`).not.toBe('');
      expect(meta.description.trim(), `${path} 의 description 이 비었다`).not.toBe('');
    }
    expect(Object.keys(ROUTE_META)).toHaveLength(ALL_PATHS.length);
  });

  it('라우트마다 제목이 서로 다르다', () => {
    const titles = ALL_PATHS.map((path) => ROUTE_META[path].title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('라우트마다 설명이 서로 다르다', () => {
    const descriptions = ALL_PATHS.map((path) => ROUTE_META[path].description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it('설명이 비어 있지 않고 합리적인 길이다', () => {
    for (const path of ALL_PATHS) {
      const { description } = ROUTE_META[path];
      expect(description.length, `${path}: ${description.length}자`).toBeGreaterThanOrEqual(
        MIN_DESCRIPTION,
      );
      expect(description.length, `${path}: ${description.length}자`).toBeLessThanOrEqual(
        MAX_DESCRIPTION,
      );
    }
  });

  it('제목에 브랜드가 붙어 있다', () => {
    for (const meta of ALL_META) expect(meta.title).toContain('G2B Masters');
  });

  it('어떤 메타에도 옛 호스트(vercel.app)가 없다', () => {
    /*
     * 이 감사의 근본 원인. index.html 이 아홉 군데에 옛 호스트를 박아 두었다가 배포지가
     * 옮겨간 뒤 통째로 틀렸다. TS 쪽에서는 호스트가 SITE_ORIGIN 한 곳에만 살아야 하고,
     * 메타 문자열에 호스트가 직접 적히는 일이 없어야 한다.
     */
    expect(SITE_ORIGIN).not.toContain('vercel.app');
    for (const meta of ALL_META) {
      expect(meta.title).not.toContain('vercel.app');
      expect(meta.description).not.toContain('vercel.app');
      expect(meta.canonicalPath ?? '').not.toContain('vercel.app');
    }
    for (const path of ALL_PATHS) expect(canonicalUrlFor(path)).toContain(SITE_ORIGIN);
  });
});

describe('색인 제외 라우트', () => {
  /*
   * 다섯 개다.
   *  - /saved · /system · /analysis-lab : ACTION-PLAN 2.1 이 명시한 사용자별·내부 화면
   *  - /company · /officers             : ACTION-PLAN 1.3 이 sitemap 에서 빼며 "noindex 대상"
   *                                       으로 분류(2.1 의 목록에는 빠져 있어 두 절이 어긋난다)
   * 목록을 여기 다시 적어 두는 이유: 새 라우트에 실수로 noindex 가 붙거나, 있던 noindex 가
   * 조용히 사라지는 것 — 둘 다 화면에는 아무 증상이 없다.
   */
  const EXPECTED_NOINDEX: RoutePath[] = [
    ROUTES.saved,
    ROUTES.system,
    ROUTES.analysisLab,
    ROUTES.company,
    ROUTES.officers,
  ];

  it('다섯 화면만 noindex 다', () => {
    const actual = ALL_PATHS.filter((path) => ROUTE_META[path].robots?.includes('noindex'));
    expect(actual.sort()).toEqual([...EXPECTED_NOINDEX].sort());
  });

  it('noindex 는 follow 를 남긴다', () => {
    // 색인에서 빼려는 것이지 크롤러를 되돌려 보내려는 것이 아니다.
    for (const path of EXPECTED_NOINDEX) expect(ROUTE_META[path].robots).toBe('noindex,follow');
  });

  it('색인 허용 라우트는 robots 를 아예 두지 않는다', () => {
    // 값이 없다는 것이 "정적 head 의 기본값으로 되돌린다"는 뜻이다 — useSeoMeta 참고.
    const indexable = ALL_PATHS.filter((path) => !EXPECTED_NOINDEX.includes(path));
    for (const path of indexable) expect(ROUTE_META[path].robots).toBeUndefined();
  });

  it('404 는 noindex 이고 canonical 을 두지 않는다', () => {
    expect(NOT_FOUND_META.robots).toContain('noindex');
    expect(NOT_FOUND_META.canonicalPath).toBeNull();
  });
});

describe('metaForPath', () => {
  it('경로로 메타를 찾는다', () => {
    expect(metaForPath(ROUTES.beta)).toBe(ROUTE_META[ROUTES.beta]);
  });

  it("끝의 '/' 는 같은 라우트로 본다", () => {
    expect(metaForPath('/notices/')?.title).toBe(ROUTE_META[ROUTES.noticeSearch].title);
  });

  it('옛 주소는 통합 검색 메타를 쓰되 canonical 은 /notices 로 고정한다', () => {
    // ACTION-PLAN 2.1 의 "canonical-to-/notices for the four legacy paths".
    for (const legacy of ['/search', '/notices/bid-plan', '/notices/pre-spec', '/notices/bid-announce']) {
      const meta = metaForPath(legacy);
      expect(meta, legacy).not.toBeNull();
      expect(meta?.canonicalPath, legacy).toBe(ROUTES.noticeSearch);
    }
  });

  it("루트('/')도 경유지라 canonical 은 /notices 다", () => {
    /*
     * 지금은 '/' 에서 Navigate 가 곧장 넘어가므로 이 분기를 태우는 화면이 없다. 그래도
     * 잠가 둔다 — 프리렌더(ACTION-PLAN 2.2)가 붙거나 '/' 에 랜딩을 두는 날, 루트가 자기
     * 자신을 canonical 로 선언하면 사이트의 대표 주소가 둘로 갈라진다. 그 갈라짐은
     * 화면에 아무 증상도 남기지 않는다.
     */
    expect(metaForPath('/')?.canonicalPath).toBe(ROUTES.noticeSearch);
  });

  it('표에 없는 주소는 null 이다', () => {
    expect(metaForPath('/이런-주소는-없다')).toBeNull();
  });
});

describe('canonicalUrlFor', () => {
  it('오리진 + 경로만 만든다', () => {
    expect(canonicalUrlFor('/notices')).toBe('https://g2b-masters.electerior.co.kr/notices');
  });

  it('통째로 넘어온 쿼리·해시도 잘라 낸다', () => {
    // 호출부가 pathname 만 넘기게 돼 있지만, 방어선을 하나 더 둔다.
    expect(canonicalUrlFor('/notices?cat=입찰#top')).toBe(
      'https://g2b-masters.electerior.co.kr/notices',
    );
  });
});
