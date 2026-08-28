/*
 * index.html 의 SEO 블록이 다시 남의 도메인을 가리키지 않는지 지키는 회귀 시험.
 *
 * 왜 시험까지 두는가: 이 블록은 한 번 사고를 냈다. 구 vercel 배포본의 index.html 에서
 * 옮겨 오면서 호스트를 재지정하지 않아, canonical·hreflang·og:url·og:image 와 JSON-LD 의
 * 식별자가 전부 남의 도메인을 가리킨 채로 배포됐다. SPA 는 모든 라우트에 같은 정적 셸을
 * 내보내므로 잘못된 canonical 한 줄이 이 도메인의 주소 전부를 색인에서 밀어낸다.
 *
 * 이런 종류의 오류는 화면에 아무 증상도 남기지 않는다 — 앱은 멀쩡히 돌고, 사람이 <head> 를
 * 다시 읽을 이유가 없다. 그래서 감사가 나올 때까지 살아남았다. 눈으로 잡히지 않는 규칙은
 * 시험이 잡아야 한다.
 *
 * 검사 대상은 빌드 산출물이 아니라 저장소 루트의 index.html 자체다. vite 는 이 파일을
 * 그대로 dist 로 내보내므로 원본을 잠그면 배포본도 잠긴다.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** 이 서비스의 프로덕션 오리진. 모든 자기 참조 URL 이 가리켜야 할 유일한 호스트다. */
const PROD_ORIGIN = 'https://g2b-masters.electerior.co.kr';

/**
 * 회사 엔티티의 식별자는 모회사 도메인이 소유한다 — 이 앱의 도메인이 아니다.
 * 아래 '전부 프로덕션 오리진' 규칙의 유일한 예외이므로, 의도된 값이라는 사실을 함께 잠근다.
 */
const ORGANIZATION_ID = 'https://www.electerior.com/#organization';

/**
 * 사고를 낸 그 문자열. 호스트가 다시 흘러갔는지 판별하는 가장 싼 한 줄이다.
 *
 * index.html 의 산문 주석은 이 규칙을 설명하면서도 `vercel.app` 을 그대로 적지 않는다
 * (경고문이 자기 시험을 깨면 안 되므로). 주석에 예시 URL 을 적고 싶어졌다면 그건 그대로
 * 사고 재현이니, 이 시험을 느슨하게 만들지 말고 주석 쪽을 고쳐라.
 */
const RETIRED_HOST_MARKER = 'vercel.app';

// 워크트리·CI 어디서 돌아도 같은 파일을 보도록 cwd 가 아니라 이 파일 위치를 기준으로 푼다
// (src/test/ 에서 두 단계 위가 저장소 루트다).
//
// `new URL('../../index.html', import.meta.url)` 로 쓰면 안 된다. vite 는 그 구문을 자산 참조로
// 알고 통째로 바꿔치기해서, 파일 경로 대신 개발 서버 주소(http://localhost:3000/index.html)를
// 돌려준다 — 시험이 파일을 못 읽고 "URL must be of scheme file" 로 죽는다.
// import.meta.url 을 먼저 경로로 바꾼 뒤 path 로 올라가면 그 변환에 걸리지 않는다.
const INDEX_HTML_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../index.html');
const html = readFileSync(INDEX_HTML_PATH, 'utf8');

/** 정규식이 못 찾으면 조용히 통과하는 대신 터뜨린다 — 태그가 사라진 것도 회귀다. */
function captureOne(pattern: RegExp, label: string): string {
  const matched = html.match(pattern);
  if (!matched?.[1]) {
    throw new Error(`index.html 에서 ${label} 를 찾지 못했다`);
  }
  return matched[1];
}

const canonicalHref = () =>
  captureOne(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/, 'rel="canonical"');
/**
 * hreflang 대체 링크를 알아보는 패턴.
 *
 * captureOne 이 아니라 패턴 그대로인 데 뜻이 있다 — 이제 이 파일이 hreflang 에 대해 지키는
 * 것은 "값이 맞는가"가 아니라 "**한 줄도 없는가**"이고, 없는 것을 확인하는 데 "못 찾으면
 * 터뜨린다"는 도우미를 쓸 수는 없다.
 *
 * index.html 의 산문 주석은 왜 지웠는지를 길게 설명하면서도 지워진 태그를 `<link …>` 통째로
 * 예시로 적지 않는다 — 적으면 그 설명이 이 패턴에 걸려 자기 시험을 깬다. RETIRED_HOST_MARKER
 * 와 같은 규칙이다. 예시를 적고 싶어졌다면 이 패턴을 느슨하게 만들지 말고 주석 쪽을 고쳐라.
 */
const HREFLANG_LINK = /<link[^>]*hreflang=/i;
const ogUrl = () => captureOne(/<meta[^>]*property="og:url"[^>]*content="([^"]+)"/, 'og:url');
// property="og:image" 뒤의 닫는 따옴표까지 요구하므로 og:image:width 등에는 걸리지 않는다.
const ogImage = () => captureOne(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/, 'og:image');

/** JSON-LD 노드 중 이 시험이 보는 필드만. 나머지는 굳이 타입으로 묶지 않는다. */
interface JsonLdNode {
  '@type'?: string;
  '@id'?: string;
  url?: string;
  logo?: string;
}

function jsonLdGraph(): JsonLdNode[] {
  const raw = captureOne(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    'JSON-LD 스크립트',
  );
  const parsed: unknown = JSON.parse(raw);
  const graph = (parsed as { '@graph'?: unknown })['@graph'];
  if (!Array.isArray(graph)) {
    throw new Error('JSON-LD 최상위에 @graph 배열이 없다');
  }
  return graph as JsonLdNode[];
}

function jsonLdNode(type: string): JsonLdNode {
  const found = jsonLdGraph().find((node) => node['@type'] === type);
  if (!found) {
    throw new Error(`JSON-LD @graph 에 ${type} 노드가 없다`);
  }
  return found;
}

describe('index.html SEO 블록', () => {
  it('폐기된 vercel 호스트가 한 군데도 남아 있지 않다', () => {
    // 아홉 군데를 하나씩 보기 전에, 통째로 흘러들어 왔는지부터 본다.
    expect(html).not.toContain(RETIRED_HOST_MARKER);
  });

  it('canonical 은 프로덕션 오리진의 루트다', () => {
    // 자기 도메인이기만 하면 되는 게 아니라 정확히 이 값이어야 한다 —
    // 정적 셸 하나가 모든 라우트에 나가므로 canonical 도 하나뿐이다.
    expect(canonicalHref()).toBe(`${PROD_ORIGIN}/`);
  });

  it('og:url·og:image 가 프로덕션 오리진을 가리킨다', () => {
    // 원래 이 시험은 hreflang 까지 셋을 함께 봤다. hreflang 은 지워졌으므로 여기서 빠지고,
    // '없어야 한다'는 별도 시험으로 바로 아래에 남는다 — 항목이 줄어든 게 아니라 뒤집혔다.
    expect(ogUrl().startsWith(`${PROD_ORIGIN}/`)).toBe(true);
    expect(ogImage().startsWith(`${PROD_ORIGIN}/`)).toBe(true);
  });

  it('hreflang 대체 링크가 한 줄도 없다 — 단일 로케일이라 되살리면 안 된다', () => {
    /*
     * 이 단언은 **뒤집힌 것이지 지워진 것이 아니다.** 전에는 "hreflang 이 프로덕션 오리진을
     * 가리킨다"였고, 감사(findings/hreflang.md)의 결론은 고치지 말고 지우라는 것이었다.
     *
     * 이유 둘.
     *  (1) 이 사이트는 단일 로케일이다 — i18n 의존성도 `/en/` 라우트도 로케일 전환기도 없다.
     *      hreflang 은 대안 판본 사이를 갈라 주는 태그라, 대안이 없으면 완벽히 써도 신호가 0 이다.
     *  (2) 신호 0 에서 끝나지 않는다. 정적 셸 하나가 15개 주소에 나가므로 href 가 사이트
     *      루트인 한 줄은 나머지 열넷에서 자기참조 위반이 된다. 호스트 일괄 치환이 없던
     *      결함을 새로 만들어 낸 자리다.
     *
     * '없음'은 코드에 흔적을 남기지 않는다. 그래서 잠근다 — 이 시험이 없으면 다음 사람이
     * "hreflang 이 빠졌네" 하고 선의로 되돌려 놓고, 그 순간 (2)가 그대로 돌아온다. 되살릴
     * 때는 여기가 아니라 라우트별 메타 훅에서, 주소마다 자기 자신을 가리키는 완전한 집합으로
     * 붙인다(index.html 의 canonical 아래 주석에 조건을 적어 두었다).
     */
    expect(html).not.toMatch(HREFLANG_LINK);
  });

  it('og:image 는 래스터(PNG/JPEG)다', () => {
    // 페이스북·X·카카오톡 크롤러는 SVG 를 렌더링하지 않는다. index.html 의 주석이 설명하는
    // 규칙을 실행 가능한 형태로 굳혀 둔다 — 로고가 SVG 라고 해서 여기까지 SVG 로 바꾸면
    // 공유 미리보기가 통째로 빈다.
    expect(ogImage()).toMatch(/\.(png|jpe?g)$/i);
  });

  it('JSON-LD 가 유효한 JSON 으로 파싱된다', () => {
    // 손으로 고치는 블록이라 쉼표 하나로 깨진다. 깨지면 구조화 데이터가 통째로 무시된다.
    expect(() => jsonLdGraph()).not.toThrow();
    expect(jsonLdGraph().length).toBeGreaterThan(0);
  });

  it('WebSite·WebApplication 의 식별자와 Organization.logo 가 프로덕션 오리진이다', () => {
    // @id 는 지식 그래프에서 엔티티의 정체 그 자체다. 여기가 남의 도메인이면 구조화 데이터가
    // 설명하는 대상이 이 사이트가 아니게 된다.
    const website = jsonLdNode('WebSite');
    expect(website['@id']).toBe(`${PROD_ORIGIN}/#website`);
    expect(website.url).toBe(`${PROD_ORIGIN}/`);

    const webApplication = jsonLdNode('WebApplication');
    expect(webApplication['@id']).toBe(`${PROD_ORIGIN}/#app`);
    expect(webApplication.url).toBe(`${PROD_ORIGIN}/`);

    // 로고 자산은 이 도메인에만 실재한다.
    expect(jsonLdNode('Organization').logo?.startsWith(`${PROD_ORIGIN}/`)).toBe(true);
  });

  it('Organization 의 @id 는 모회사 도메인 그대로다', () => {
    // 위 규칙의 의도된 예외. '남의 도메인을 전부 바꾼다'는 다음 사람의 일괄 치환에서
    // 이것까지 끌려가면 모회사 사이트와 조직 엔티티가 갈라진다.
    expect(jsonLdNode('Organization')['@id']).toBe(ORGANIZATION_ID);
  });
});
