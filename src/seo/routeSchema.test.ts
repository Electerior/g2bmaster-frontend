/*
 * 라우트별 JSON-LD — 값과 그래프 연결.
 *
 * **문자열 포함 검사를 하지 않는다.** 전부 JSON.parse 로 실제 객체를 만들어 놓고 단언한다.
 * 구조화 데이터가 고장 나는 방식은 "문자열이 없다"보다 "문자열은 있는데 그래프가 끊겼다"
 * 쪽이 훨씬 흔하고, 후자는 `toContain` 으로는 보이지 않는다. 예를 들어 isPartOf 의 @id 에
 * 오타가 하나 나도 문서에는 그 문자열이 멀쩡히 들어 있다 — 가리키는 노드가 없을 뿐이다.
 *
 * 그리고 셸(index.html)을 실제로 읽어 대조한다. 이 파일이 조립하는 @id 는 SITE_ORIGIN 에서
 * 나오고 셸의 그것은 손으로 적혀 있으므로, 둘이 갈라질 수 있는 자리가 남아 있다. 갈라지면
 * 아무 증상도 없이 그래프만 끊긴다.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildBetaDocument } from '@/features/beta/prerenderDocument';
import { ROUTES, LEGACY_NOTICE_ROUTES, type RoutePath } from '@/routes/routePaths';
import { ROUTE_META } from './routeMeta';
import {
  DATASET_ID,
  EXCLUDED_TYPES,
  ROUTE_SCHEMA_ATTR,
  routeSchemaFor,
  routeSchemaJsonFor,
  routeSchemaScriptTag,
  WEBSITE_ID,
} from './routeSchema';
import { SITE_ORIGIN } from './siteOrigin';

// 워크트리·CI 어디서 돌아도 같은 파일을 보도록 cwd 가 아니라 이 파일 위치를 기준으로 푼다.
const SHELL = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'index.html'),
  'utf8',
);

type Node = Record<string, unknown>;

/** 셸의 정적 JSON-LD 를 실제로 파싱한다. 마크업이 아니라 그래프를 본다. */
function shellNodes(): Node[] {
  const block = SHELL.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  )?.[1];
  expect(block, 'index.html 에 정적 JSON-LD 블록이 없다').toBeTruthy();
  const parsed = JSON.parse(block!) as { '@graph': Node[] };
  return parsed['@graph'];
}

function graphOf(path: string): Node[] {
  const graph = routeSchemaFor(path);
  expect(graph, `${path} 에 그래프가 없다`).not.toBeNull();
  return graph!['@graph'];
}

const nodeOfType = (nodes: Node[], type: string) =>
  nodes.find((node) => node['@type'] === type);

/** 스키마를 내보내는 라우트 — 아래 여러 describe 가 공유한다. */
const SCHEMA_PATHS: RoutePath[] = [ROUTES.noticeSearch, ROUTES.bidResult, ROUTES.beta];

describe('어느 주소가 스키마를 갖는가', () => {
  it('색인 대상 셋만 갖는다', () => {
    const withSchema = Object.values(ROUTES).filter((path) => routeSchemaFor(path) !== null);
    expect(withSchema.sort()).toEqual([...SCHEMA_PATHS].sort());
  });

  /*
   * 이 두 시험이 "색인하지 말라고 해 놓고 이런 문서다라고 선언하지 않는다"를 잠근다.
   * 근거는 routeSchema.ts 의 isSchemaRoute 주석에 길게 적어 두었다.
   */
  it('noindex 라우트에는 아무 노드도 내지 않는다', () => {
    for (const path of [ROUTES.saved, ROUTES.system]) {
      expect(ROUTE_META[path].robots, `${path} 는 noindex 여야 이 시험이 의미가 있다`).toContain(
        'noindex',
      );
      expect(routeSchemaFor(path), path).toBeNull();
    }
  });

  it('noindex 목록과 스키마 없는 목록이 정확히 맞물린다', () => {
    // 한쪽만 고쳐지는 것을 막는다 — 새 noindex 라우트가 생기면 여기서 깨진다.
    const noindex = Object.values(ROUTES).filter((path) =>
      ROUTE_META[path].robots?.includes('noindex'),
    );
    for (const path of noindex) expect(routeSchemaFor(path), path).toBeNull();
  });

  it('경유지(`/` 와 옛 주소 넷)에는 내지 않는다', () => {
    for (const path of ['/', ...LEGACY_NOTICE_ROUTES.map((r) => r.path)]) {
      expect(routeSchemaFor(path), path).toBeNull();
    }
  });

  it('표에 없는 주소(404)에는 내지 않는다', () => {
    expect(routeSchemaFor('/이런-주소는-없다')).toBeNull();
  });

  it('끝 슬래시가 붙어도 같은 라우트로 본다', () => {
    expect(routeSchemaFor('/notices/')).toEqual(routeSchemaFor(ROUTES.noticeSearch));
  });

  it('쿼리가 붙어도 canonical 과 같은 url 을 쓴다', () => {
    // canonical 규칙(ACTION-PLAN 1.6)과 어긋나면 필터 상태마다 다른 문서를 주장하게 된다.
    const webPage = nodeOfType(graphOf('/notices?from=2026-07-28&cat=입찰'), 'WebPage')!;
    expect(webPage.url).toBe(`${SITE_ORIGIN}/notices`);
    expect(String(webPage['@id'])).not.toContain('?');
  });
});

describe('WebPage', () => {
  for (const path of SCHEMA_PATHS) {
    it(`${path} — 값이 전부 ROUTE_META 에서 온다`, () => {
      const webPage = nodeOfType(graphOf(path), 'WebPage')!;
      expect(webPage['@id']).toBe(`${SITE_ORIGIN}${path}#webpage`);
      expect(webPage.url).toBe(`${SITE_ORIGIN}${path}`);
      /*
       * 두 번째 복사본을 만들지 않았다는 것이 이 두 줄의 요점이다. 여기서 문자열을 직접
       * 적었다면 이 시험은 "내가 적은 것과 내가 적은 것이 같다"를 확인할 뿐이었을 것이다.
       */
      expect(webPage.name).toBe(ROUTE_META[path].title);
      expect(webPage.description).toBe(ROUTE_META[path].description);
      expect(webPage.inLanguage).toBe('ko-KR');
      expect(webPage.isPartOf).toEqual({ '@id': WEBSITE_ID });
    });
  }
});

describe('셸의 노드를 다시 선언하지 않고 @id 로만 가리킨다', () => {
  const shell = shellNodes();

  it('참조한 @id 가 셸에 실재한다', () => {
    /*
     * 오타 하나면 그래프가 끊긴다. 셸의 문자열을 여기 옮겨 적으면 그 순간 세 번째 복사본이
     * 되므로, 셸을 **파싱해서** 그 안에 있는지를 본다.
     */
    const shellIds = shell.map((node) => node['@id']);
    expect(shellIds).toContain(WEBSITE_ID);
    expect(shellIds).toContain(DATASET_ID);
  });

  it('참조한 @id 가 기대한 타입의 노드다', () => {
    expect(shell.find((n) => n['@id'] === WEBSITE_ID)?.['@type']).toBe('WebSite');
    expect(shell.find((n) => n['@id'] === DATASET_ID)?.['@type']).toBe('Dataset');
  });

  it('셸에 이미 있는 타입을 라우트별로 다시 선언하지 않는다', () => {
    const shellTypes = new Set(shell.map((node) => String(node['@type'])));
    for (const path of SCHEMA_PATHS) {
      for (const node of graphOf(path)) {
        expect(shellTypes, `${path} 의 ${String(node['@type'])}`).not.toContain(
          String(node['@type']),
        );
      }
    }
  });

  it('라우트별 @id 는 셸의 @id 와 겹치지 않는다', () => {
    // 겹치면 같은 엔티티에 서로 다른 두 정의가 붙는다.
    const shellIds = new Set(shell.map((node) => String(node['@id'])));
    for (const path of SCHEMA_PATHS) {
      for (const node of graphOf(path)) {
        expect(shellIds, `${path} 의 ${String(node['@id'])}`).not.toContain(String(node['@id']));
      }
    }
  });
});

describe('mainEntity — /notices 하나뿐', () => {
  it('/notices 는 셸의 Dataset 을 주제로 가리킨다', () => {
    const webPage = nodeOfType(graphOf(ROUTES.noticeSearch), 'WebPage')!;
    expect(webPage.mainEntity).toEqual({ '@id': DATASET_ID });
  });

  it('근거는 셸이 이미 말하고 있다 — Dataset.url 이 /notices 다', () => {
    /*
     * 이 시험이 실제로 지키는 것은 mainEntity 가 아니라 **그 근거**다. 셸의 Dataset.url 이
     * 다른 주소로 옮겨 가면 /notices 의 mainEntity 는 근거를 잃는다. 그때 조용히 남는 대신
     * 여기서 깨져야 한다.
     */
    const dataset = shellNodes().find((node) => node['@id'] === DATASET_ID)!;
    expect(dataset.url).toBe(`${SITE_ORIGIN}${ROUTES.noticeSearch}`);
  });

  it('나머지 둘에는 없다', () => {
    for (const path of [ROUTES.bidResult, ROUTES.beta]) {
      expect(nodeOfType(graphOf(path), 'WebPage')!.mainEntity, path).toBeUndefined();
    }
  });
});

describe('BreadcrumbList — 실재하는 계층만', () => {
  it('/notices/bid-result 만 갖는다', () => {
    const withCrumbs = SCHEMA_PATHS.filter((path) =>
      graphOf(path).some((node) => node['@type'] === 'BreadcrumbList'),
    );
    expect(withCrumbs).toEqual([ROUTES.bidResult]);
  });

  it('두 계단이고, 부모가 실재하는 라우트다', () => {
    const crumbs = nodeOfType(graphOf(ROUTES.bidResult), 'BreadcrumbList')!;
    const items = crumbs.itemListElement as Node[];

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      name: '공고 검색',
      item: `${SITE_ORIGIN}${ROUTES.noticeSearch}`,
    });
    expect(items[1]).toEqual({
      '@type': 'ListItem',
      position: 2,
      name: '입찰 결과',
      item: `${SITE_ORIGIN}${ROUTES.bidResult}`,
    });

    /*
     * 지어낸 주소가 없다는 것을 라우트 표에 대고 확인한다. 감사가 예로 든 `/trends` 처럼
     * 표에 없는 중간 단계를 넣으면 크롤러가 소프트 404 를 받으러 간다.
     */
    const known = new Set<string>(Object.values(ROUTES));
    for (const item of items) {
      expect(known, String(item.item)).toContain(String(item.item).replace(SITE_ORIGIN, ''));
    }
  });

  it('사이트 루트를 첫 계단으로 세우지 않는다', () => {
    // `/` 는 머무르는 문서가 아니라 /notices 로 넘기는 경유지다.
    const items = nodeOfType(graphOf(ROUTES.bidResult), 'BreadcrumbList')!
      .itemListElement as Node[];
    expect(items.map((i) => i.item)).not.toContain(`${SITE_ORIGIN}/`);
  });

  it('WebPage 가 같은 그래프의 BreadcrumbList 를 @id 로 문다', () => {
    const nodes = graphOf(ROUTES.bidResult);
    const webPage = nodeOfType(nodes, 'WebPage')!;
    const crumbs = nodeOfType(nodes, 'BreadcrumbList')!;
    expect(webPage.breadcrumb).toEqual({ '@id': crumbs['@id'] });
  });

  it('계단이 하나뿐인 라우트에는 만들지 않는다', () => {
    for (const path of [ROUTES.noticeSearch, ROUTES.beta]) {
      expect(nodeOfType(graphOf(path), 'BreadcrumbList'), path).toBeUndefined();
      expect(nodeOfType(graphOf(path), 'WebPage')!.breadcrumb, path).toBeUndefined();
    }
  });
});

describe('일부러 넣지 않은 타입', () => {
  /*
   * '없음'은 코드에 흔적을 남기지 않아서, 잠그지 않으면 다음 사람이 선의로 되돌려 놓는다.
   * 이 저장소가 hreflang 에 이미 쓴 장치와 같다(src/test/indexHtmlSeo.test.ts).
   * 각각의 이유는 routeSchema.ts 의 EXCLUDED_TYPES 주석에 있다.
   */
  it(`어느 라우트에도 ${EXCLUDED_TYPES.join(' · ')} 가 없다`, () => {
    for (const path of SCHEMA_PATHS) {
      const json = routeSchemaJsonFor(path)!;
      for (const type of EXCLUDED_TYPES) {
        expect(json, `${path} 에 ${type} 이 들어갔다`).not.toContain(type);
      }
    }
  });

  it('/beta 에 FAQPage 가 없다 — 화면에 Q&A UI 가 없기 때문이다', () => {
    const types = graphOf(ROUTES.beta).map((node) => node['@type']);
    expect(types).toEqual(['WebPage']);
  });
});

describe('직렬화', () => {
  it('유효한 JSON 이고 @context 가 schema.org 다', () => {
    for (const path of SCHEMA_PATHS) {
      const parsed = JSON.parse(routeSchemaJsonFor(path)!) as { '@context': string };
      expect(parsed['@context'], path).toBe('https://schema.org');
    }
  });

  it("`<` 를 이스케이프해 script 를 조기에 닫지 못하게 한다", () => {
    // 지금 값에는 `<` 가 없다. 없을 때 막아 두는 것이 이런 종류의 방어다.
    for (const path of SCHEMA_PATHS) {
      expect(routeSchemaJsonFor(path), path).not.toContain('<');
    }
  });

  it('스키마가 없는 주소는 문자열도 태그도 null 이다', () => {
    expect(routeSchemaJsonFor(ROUTES.saved)).toBeNull();
    expect(routeSchemaScriptTag(ROUTES.saved)).toBeNull();
  });
});

describe('프리렌더용 script 태그', () => {
  const tag = routeSchemaScriptTag(ROUTES.beta)!;

  it('훅과 같은 표식을 단다 — 이어받을 때 자기 것으로 인식돼야 한다', () => {
    /*
     * 표식이 다르면 브라우저가 이어받은 뒤 훅이 심은 태그와 프리렌더가 심은 태그가 나란히
     * 남아 같은 노드가 두 번 선언된다. useSeoMeta 의 applyRouteSchema 주석 참고.
     */
    expect(tag).toContain(`<script type="application/ld+json" ${ROUTE_SCHEMA_ATTR}>`);
  });

  it('안쪽이 파싱되고 /beta 의 그래프와 같다', () => {
    const inner = tag.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    expect(JSON.parse(inner)).toEqual(routeSchemaFor(ROUTES.beta));
  });

  it('닫는 태그가 안쪽에 나타나지 않는다', () => {
    expect(tag.match(/<\/script>/g)).toHaveLength(1);
  });
});

describe('프리렌더된 /beta 문서에 실제로 들어간다', () => {
  /*
   * 여기까지 와야 이 브랜치가 /beta 에서 효과를 갖는다. 크롤러가 읽는 것은 dist/beta.html 의
   * 정적 head 이고 훅은 브라우저에서만 돌기 때문이다 — 태그를 만들 수 있다는 것과 그것이
   * 산출물의 <head> 안에 들어간다는 것은 별개의 사실이라 따로 잠근다.
   *
   * 조립은 저장소의 index.html 을 셸로 먹여 확인한다(betaPrerender.test.tsx 와 같은 수법).
   * dist 를 만들지 않아도 셸이 바뀌면 여기서 깨진다. 실제로 headExtras 에 이 태그를 넣는
   * 쪽은 scripts/prerender-beta.mjs 이고, 거기서 빠지면 `npm run build` 가 던진다.
   */
  const tag = routeSchemaScriptTag(ROUTES.beta)!;
  const html = buildBetaDocument({ shell: SHELL, body: '<p>본문</p>', headExtras: [tag] });

  const headOf = (doc: string) => doc.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';

  it('</head> 앞에 들어간다 — body 가 아니다', () => {
    expect(headOf(html)).toContain(ROUTE_SCHEMA_ATTR);
  });

  it('문서에서 도로 꺼내 파싱하면 /beta 의 그래프다', () => {
    const inner = headOf(html).match(
      new RegExp(`<script type="application/ld\\+json" ${ROUTE_SCHEMA_ATTR}>([\\s\\S]*?)</script>`),
    )?.[1];
    expect(inner, '프리렌더 문서에서 라우트별 JSON-LD 를 찾지 못했다').toBeTruthy();
    expect(JSON.parse(inner!)).toEqual(routeSchemaFor(ROUTES.beta));
  });

  it('셸의 정적 JSON-LD 는 그대로 남는다 — 문서에 블록이 둘이다', () => {
    // 하나는 셸의 노드 넷, 하나는 /beta 의 WebPage. 라우트별 노드가 정적 그래프를
    // 덮어써 버리면 Organization·WebSite·Dataset 이 통째로 사라진다.
    const blocks = html.match(/<script type="application\/ld\+json"/g) ?? [];
    expect(blocks).toHaveLength(2);
    expect(html).toContain('"@type": "Dataset"');
  });
});
