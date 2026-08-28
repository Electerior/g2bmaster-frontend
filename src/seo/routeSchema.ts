/*
 * 라우트별 구조화 데이터(JSON-LD).
 *
 * 감사(findings/schema.md)의 "High: no per-page schema" — 같은 노드 넷이 모든 주소에 나가고
 * 개별 페이지가 무엇인지는 아무 데도 적혀 있지 않다. index.html 이 그것을 일부러 미뤄 두었고
 * (그 파일 JSON-LD 위 주석), 미룬 이유가 이 파일의 존재 이유다:
 *
 *   정적 셸은 **자기가 지금 어느 주소인지 모른다.** 한 주소에서만 참인 문장을 거기 넣으면
 *   나머지 주소에서 거짓 구조화 데이터가 된다. 그래서 "이 문서는 무엇인가"는 주소를 아는
 *   자리 — 라우트별 메타 훅(useSeoMeta) — 에서만 말할 수 있다.
 *
 * ── 이 파일이 하지 않는 일 ────────────────────────────────────────────────
 * 셸의 노드 넷(Organization · WebSite · WebApplication · Dataset)을 **다시 선언하지 않는다.**
 * 같은 엔티티를 두 번 선언하면 소비자가 둘을 같은 것으로 합쳐 준다는 보장이 없고, 갈라지면
 * 이 사이트에는 이름이 같은 두 웹사이트가 존재하게 된다. 필요한 것은 참조뿐이라
 * `{ "@id": … }` 한 줄로 가리킨다.
 *
 * `@id` 문자열도 여기 적지 않는다. SITE_ORIGIN 에서 조립한다 — 같은 사실이 두 곳에 적혀
 * 한쪽만 고쳐지는 것이 이 감사의 근본 원인이었다. 조립한 값이 셸의 그것과 **글자 그대로**
 * 같은지는 routeSchema.test.ts 가 index.html 을 실제로 파싱해 확인한다. 오타 하나면
 * isPartOf 가 존재하지 않는 노드를 가리켜 그래프가 조용히 끊긴다.
 *
 * ── 값을 적는 기준 ────────────────────────────────────────────────────────
 * `feat/seo-schema-expansion`(PR #21)이 세워 둔 것을 그대로 따른다 — **근거를 확인한 값만
 * 스키마에 적는다.** 권장 필드를 비워 두는 것은 감점이 아니지만 근거 없이 채운 값은 위험이다.
 * 그래서 이 파일에는 "넣지 않기로 한 것"의 근거가 넣은 것의 근거보다 길다.
 */
import { SCREENS } from '@/domain/columns';
import { ROUTES, TAB_ITEMS, type RoutePath } from '@/routes/routePaths';
import { ROUTE_META } from './routeMeta';
import { canonicalUrlFor, SITE_ORIGIN } from './siteOrigin';

/**
 * 셸(index.html)이 선언해 둔 노드의 식별자.
 *
 * 여기 있는 둘만 참조한다. 셸에는 Organization(`https://www.electerior.com/#organization`)과
 * WebApplication(`…/#app`)도 있지만 라우트별 노드가 그 둘을 가리킬 자리가 없다 —
 * 발행 주체는 isPartOf 로 이어지는 WebSite 가 이미 publisher 로 물고 있고, WebApplication 은
 * url 이 사이트 루트라 어느 특정 문서의 주제가 아니다. 쓰지 않을 상수를 미리 만들어 두면
 * 다음 사람이 "이건 왜 안 쓰지"를 묻게 된다.
 */
export const WEBSITE_ID = `${SITE_ORIGIN}/#website`;
export const DATASET_ID = `${SITE_ORIGIN}/#dataset`;

/** 이 모듈이 만든 script 태그를 식별하는 속성. 셸의 정적 JSON-LD 에는 없다. */
export const ROUTE_SCHEMA_ATTR = 'data-route-schema';

/** JSON-LD 노드 하나. 값의 모양은 schema.org 가 정하므로 여기서 더 좁히지 않는다. */
export type JsonLdNode = Record<string, unknown>;

export interface JsonLdGraph {
  '@context': 'https://schema.org';
  '@graph': JsonLdNode[];
}

/**
 * **일부러 넣지 않은 타입.** 아래 주석이 하나씩 이유를 적고, 테스트가 이 목록이 어느
 * 라우트의 그래프에도 나타나지 않도록 잠근다.
 *
 * '없음'은 코드에 흔적을 남기지 않는다 — 적어 두지 않으면 다음 사람이 "FAQPage 가 빠졌네"
 * 하고 선의로 넣는다. 이 저장소는 hreflang 을 지우면서 같은 장치를 이미 썼다
 * (index.html 의 hreflang 주석과 src/test/indexHtmlSeo.test.ts).
 *
 * ── FAQPage (/beta) — 감사 findings/schema.md · ACTION-PLAN 3.3 ────────────────
 * 감사는 "랜딩이 이미 산문으로 반복 질문에 답한다"를 전제로 이 타입을 권했다. **그 전제를
 * 직접 확인했고, 사실이 아니다.** src/features/beta 전체(landing.config.ts 와 컴포넌트 열하나)를
 * 읽었다. 화면에 있는 것은 이렇다:
 *
 *   Hero(카피 세 줄 + CTA) · Nav · ProductMock(제품 목업) · Features(자동 순환 탭 넷,
 *   각 탭은 제목·본문·불릿 셋) · Decision(카드 한 장 + Go/Stop) · Results(막대 그래프 둘
 *   + 조사 방식 문단) · Benefits(혜택 카드 셋) · Feedback(후기 마퀴) · Apply(신청 폼) · Footer.
 *
 * 질문 형태의 제목이 **하나도 없다.** 물음표가 들어간 문장이 없고 `<details>`·아코디언·
 * FAQ 섹션도 없다. 섹션 제목은 전부 서술문이다("네 가지 일을 대신합니다", "베타 참여 혜택",
 * "20개사만 받습니다"). 즉 이 페이지에는 Q&A 라 부를 UI 가 존재하지 않는다.
 *
 * 그러면 남는 선택지는 마케팅 문구를 질문 모양으로 **내가 고쳐 쓰는 것**인데, 그것은
 * 구글의 FAQPage 규격을 정면으로 어긴다 — 규격은 "페이지에 그대로 보이는 질문과 답"을
 * 요구한다. 화면에 없는 콘텐츠를 크롤러에게만 보여 주는 것은 수동 조치(구조화 데이터 스팸)
 * 대상이다. 이 저장소가 offers.price 를 지우고 temporalCoverage 를 비워 둔 것과 같은
 * 기준이며, 여기서는 위반의 종류가 더 무겁다.
 *
 * 이득 쪽도 보고 결정했다. 구글은 2023-08-08 부로 FAQ 리치 결과를 정부·보건 사이트에만
 * 남기고 사실상 내렸다. 이 사이트는 어느 쪽도 아니므로 규격을 완벽히 지켜도 리치 결과가
 * 나오지 않는다. **이득은 거의 0, 위험은 수동 조치.**
 *
 * 넣을 조건: /beta 에 진짜 Q&A UI(질문과 답이 화면에 보이는 섹션)가 생겼을 때. 그것을 지금
 * 새로 만드는 것은 랜딩 카피를 늘리는 제품 결정이라 이 브랜치의 몫이 아니다. 그때도 문구는
 * 화면 컴포넌트에서 가져와야 한다 — 여기 다시 적으면 화면과 스키마가 갈라지고, 갈라진 쪽이
 * 곧 "화면에 없는 Q&A" 가 된다.
 *
 * ── Review · AggregateRating (/beta) ─────────────────────────────────────────
 * 같은 기준에서 뺐다. Feedback 섹션의 후기 여섯은 **이 서비스가 자기 자신에 대해 싣는**
 * 후기다. 구글은 자체 게재 후기(self-serving review)를 2019-09 부터 리치 결과 대상에서
 * 제외했으므로 이득이 없고, 작성자가 '김**' 처럼 익명화돼 있어 Review.author 를 정직하게
 * 채울 방법도 없다. 별 다섯(★★★★★)도 마크업이 아니라 장식이라 rating 값의 근거가 없다.
 */
export const EXCLUDED_TYPES: readonly string[] = ['FAQPage', 'Review', 'AggregateRating'];

/**
 * 구조화 데이터를 내보내는 라우트.
 *
 * ── noindex 라우트(/saved · /system)에 WebPage 를 내지 않는 이유 ─────────────
 * 스스로 따져 본 결과 **내지 않는 쪽이 맞다.**
 *
 * robots 의 `noindex` 는 "이 주소를 색인에 넣지 마라"이고 WebPage 는 "이 주소는 이런
 * 문서다"라는 색인용 서술이다. 한 head 안에서 둘을 동시에 말하면 서로 반대되는 지시를
 * 남기는 셈이고, 이 저장소는 같은 종류의 모순(robots 는 noindex 인데 googlebot 태그는
 * index)을 이미 결함으로 취급해 고쳤다(useSeoMeta.ts 의 applyRobots 주석). 같은 기준을
 * 스키마에도 적용한다.
 *
 * 이득도 없다. 색인되지 않는 URL 은 어떤 리치 결과에도 오르지 못하므로 WebPage 노드가
 * 만들어 내는 값이 정확히 0 이다. 반면 비용은 0 이 아니다 — isPartOf 로 WebSite 에 매달면
 * 색인하지 말라고 한 문서가 사이트 그래프의 일부로 선언되고, 정리(cleanup)가 한 번이라도
 * 새면 그 노드가 색인 대상 라우트 위에 남는다. 이득 0 · 위험 0 초과면 답은 하나다.
 *
 * ── 경유지(`/` · 옛 주소 넷)와 404 에도 내지 않는다 ──────────────────────────
 * 경유지는 머무르지 않고 곧바로 넘어가는 주소이고 canonical 이 이미 `/notices` 를 가리킨다.
 * 여기서 `/search` 를 url 로 하는 WebPage 를 내면 canonical 과 정면으로 어긋나고, 반대로
 * `/notices` 를 url 로 하는 WebPage 를 내면 `/notices` 라고 주장하는 문서가 다섯 주소에서
 * 나간다. 어느 쪽도 참이 아니므로 아무 말도 하지 않는다. 404 도 같다 — 정의상 문서가 아니다.
 *
 * 남는 것은 셋이다: `/notices` · `/notices/bid-result` · `/beta`.
 * ACTION-PLAN 1.3 이 sitemap 에 올린 목록에서 (그 뒤 main 이 화면을 통합하며 사라진 다섯을
 * 빼면) 정확히 같은 집합이다. 색인 대상과 구조화 데이터 대상이 같은 것이 옳다.
 */
function isSchemaRoute(path: string): path is RoutePath {
  const meta = (ROUTE_META as Record<string, { robots?: string } | undefined>)[path];
  if (!meta) return false;
  return !meta.robots?.includes('noindex');
}

/**
 * 빵부스러기 경로 — **실재하는 계층만.**
 *
 * 지어낸 중간 단계를 넣지 않는 것이 이 표의 전부다. 없는 주소를 부모로 세우면 크롤러가 그
 * 링크를 따라가 (SPA 라 200 을 내는) 소프트 404 를 받고, 사용자에게는 애초에 갈 수 없는
 * 계단이 검색 결과에 그려진다.
 *
 * 지금 라우트 표(routePaths.ts ROUTES)에서 부모가 실재하는 주소는 **하나뿐이다** —
 * `/notices/bid-result` 의 부모 `/notices` 는 실제 라우트이고 통합 검색 화면을 200 으로 낸다.
 * 감사(findings/schema.md)가 함께 예로 든 `/trends/*` 는 main 이 화면을 통합하며(PR #23)
 * 주소째 사라졌고, 그 부모로 쓸 `/trends` 는 그때도 라우트 표에 없었다 — 지어냈어야 할
 * 주소였으므로 사라진 것과 무관하게 넣을 수 없었다.
 *
 * ── 한 쌍뿐인데 넣을 가치가 있나 ────────────────────────────────────────────
 * 있다. 다만 근거가 두 갈래라 나눠 적는다.
 *
 * 넣지 말자는 쪽의 가장 센 논거는 **화면에 빵부스러기가 없다**는 것이다. 이 앱의 내비게이션은
 * 탭 스트립이고, 거기서 '공고 검색'과 '입찰 결과'는 부모·자식이 아니라 나란한 형제로 그려진다
 * (routePaths.ts 의 TAB_ITEMS). 위로 올라가는 링크도 없다.
 *
 * 그런데 그 논거를 FAQPage 에 적용한 것과 같은 무게로 여기에 적용할 수는 없다. 두 규격이
 * 요구하는 것이 다르기 때문이다. FAQPage 는 "페이지에 **보이는** 질문과 답"을 명시적인
 * 자격 요건으로 걸고 어기면 스팸으로 분류하지만, BreadcrumbList 가 나타내라는 것은 위젯이
 * 아니라 **사이트 계층에서의 위치**다. 그 위치는 여기서 검증 가능한 사실이다 —
 * `/notices` 는 존재하고, 200 을 내고, 이 앱의 DEFAULT_ROUTE 이자 셸의 Dataset 노드가 url 로
 * 지목한 주소다. 즉 마크업하는 문장이 참이다.
 *
 * 이득도 실재한다. 구글이 지금도 널리 그리는 몇 안 되는 리치 결과가 빵부스러기이고,
 * 검색 결과의 URL 줄이 `…/notices/bid-result` 대신 `… › 공고 검색`으로 바뀐다. 자기 자신에
 * 대한 주장(FAQ·Review)이 아니라 사이트 구조에 대한 진술이라 수동 조치 범주도 아니다.
 *
 * 한 쌍이라 작지만, 작은 것과 근거 없는 것은 다르다. 근거 있는 한 쌍만 넣는다.
 */
const BREADCRUMB_TRAILS: Partial<Record<RoutePath, readonly RoutePath[]>> = {
  /*
   * 첫 계단이 사이트 루트 `/` 가 아니라 `/notices` 인 것이 의도다. `/` 는 머무르는 문서가
   * 아니라 `/notices` 로 넘기는 경유지이고(DEFAULT_ROUTE · isTransitRoute) canonical 도
   * `/notices` 다. 첫 항목으로 넣으면 같은 문서가 두 계단으로 세어진다. 이 앱의 실제
   * 최상단은 홈이 아니라 공고 검색이다.
   */
  [ROUTES.bidResult]: [ROUTES.noticeSearch, ROUTES.bidResult],
};

/**
 * 빵부스러기에 적을 이름.
 *
 * 탭 스트립의 라벨을 그대로 쓴다(TAB_ITEMS → SCREENS.label). 화면에 '공고 검색'이라 적혀
 * 있는데 스키마가 다른 이름을 말하면 옮긴 것이 아니라 새로 지어낸 것이 된다.
 *
 * ROUTE_META 의 title 을 쓰지 않는 이유도 같다. 그쪽은 검색 결과에서 아직 오지 않은 사람이
 * 읽는 한 줄이라 브랜드 꼬리표까지 달려 있어(`… — G2B Masters`) 계단 이름으로는 길다.
 */
const CRUMB_NAMES: ReadonlyMap<string, string> = new Map(
  TAB_ITEMS.map((tab) => [tab.path as string, SCREENS[tab.kind].label]),
);

function breadcrumbNode(path: RoutePath): JsonLdNode | null {
  const trail = BREADCRUMB_TRAILS[path];
  if (!trail) return null;

  const items = trail.map((step, index) => {
    const name = CRUMB_NAMES.get(step);
    return name == null
      ? null
      : {
          '@type': 'ListItem',
          position: index + 1,
          name,
          item: canonicalUrlFor(step),
        };
  });

  /*
   * 이름을 못 찾은 계단이 하나라도 있으면 **부분적으로 만들지 않고 통째로 뺀다.**
   * 계단이 빠진 BreadcrumbList 는 없는 것보다 나쁘다 — 실제와 다른 경로를 주장한다.
   * 화면이 탭에서 빠지면 여기가 아니라 테스트에서 먼저 깨진다.
   */
  if (items.some((item) => item === null)) return null;

  return {
    '@type': 'BreadcrumbList',
    '@id': `${canonicalUrlFor(path)}#breadcrumb`,
    itemListElement: items,
  };
}

/**
 * 이 문서의 주제(mainEntity).
 *
 * `/notices` 하나에만 붙는다. 근거는 셸에 이미 적혀 있다 — Dataset 노드의 `url` 이
 * `https://g2b-masters.electerior.co.kr/notices` 다. 즉 셸은 "그 데이터셋은 저 주소에 있다"고
 * 이미 말하고 있고, 여기서 하는 것은 같은 사실을 문서 쪽에서 되돌려 말하는 것뿐이다.
 * 새 주장이 아니라 이미 있는 주장의 반대 방향이라 따로 근거가 필요 없다.
 *
 * `/notices/bid-result` 에는 붙이지 않는다. 낙찰정보는 셸의 Dataset 설명이 "별도 색인"이라
 * 부르는 것이고 Dataset.url 도 그 주소가 아니다. 같은 엔티티를 두 문서의 주제로 선언하면
 * 어느 쪽이 그 데이터셋의 페이지인지가 흐려진다.
 *
 * `/beta` 에도 붙이지 않는다. 후보였을 WebApplication 은 url 이 사이트 루트라 랜딩 한 장의
 * 주제가 아니다.
 */
const MAIN_ENTITY_IDS: Partial<Record<RoutePath, string>> = {
  [ROUTES.noticeSearch]: DATASET_ID,
};

/**
 * 라우트 하나의 JSON-LD 그래프. 스키마를 내보내지 않는 주소면 `null`.
 *
 * ── 채우지 않은 WebPage 필드와 그 이유 ────────────────────────────────────
 *  - datePublished · dateModified : 이 화면들에 발행일이라 부를 것이 없다. 목록 내용은
 *    적재 주기마다 바뀌고 화면 자체는 배포 때 바뀐다. 어느 쪽도 "이 문서의 날짜"가 아니고,
 *    빌드 시각을 박으면 배포된 순간부터 틀린 값이 된다.
 *  - primaryImageOfPage : 라우트 전용 이미지가 생기더라도 그것은 공유 카드(og:image)이지
 *    페이지 안에 그려지는 이미지가 아니다. 둘은 다른 것이다.
 *  - speakable · lastReviewed · significantLink : 근거가 없다.
 *  - potentialAction : 셸의 WebSite 노드가 이미 SearchAction 을 들고 있다. 여기 또 두면
 *    같은 진입점이 두 번 선언된다.
 */
export function routeSchemaFor(pathname: string): JsonLdGraph | null {
  const path = normalize(pathname);
  if (!isSchemaRoute(path)) return null;

  const meta = ROUTE_META[path];
  const url = canonicalUrlFor(path);
  const breadcrumb = breadcrumbNode(path);
  const mainEntityId = MAIN_ENTITY_IDS[path];

  const webPage: JsonLdNode = {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    /*
     * name · description 은 **반드시 ROUTE_META 에서 가져온다.** 여기 새로 쓰면 같은 문장의
     * 두 번째 복사본이 생기고 한쪽만 고쳐지는 날이 온다 — 이 감사의 근본 원인이 정확히
     * 그것이었다(호스트 문자열이 아홉 곳에 있었고 이사 뒤 전부 옛 도메인으로 남았다).
     * 이렇게 두면 <title> 과 WebPage.name 이 갈라질 수가 없다.
     */
    name: meta.title,
    description: meta.description,
    // 셸의 <html lang="ko"> · og:locale · WebSite.inLanguage 와 같은 사실이다.
    inLanguage: 'ko-KR',
    // 셸의 WebSite 노드를 **참조만** 한다. 다시 선언하면 그래프가 갈라진다.
    isPartOf: { '@id': WEBSITE_ID },
  };

  if (mainEntityId) webPage.mainEntity = { '@id': mainEntityId };
  // 같은 그래프 안의 노드를 @id 로 잇는다 — 소비자가 둘을 따로 읽지 않게 한다.
  if (breadcrumb) webPage.breadcrumb = { '@id': breadcrumb['@id'] };

  return {
    '@context': 'https://schema.org',
    '@graph': breadcrumb ? [webPage, breadcrumb] : [webPage],
  };
}

/**
 * script 태그 안에 그대로 들어갈 문자열. 스키마가 없는 주소면 `null`.
 *
 * 문자열까지 여기서 만드는 이유는 훅 쪽 사정이다 — useEffect 의 의존성 배열은 Object.is 로
 * 비교하므로 객체를 넣으면 렌더마다 새 참조가 되어 effect 가 매번 다시 돈다. 문자열은
 * 값으로 비교되므로 내용이 같으면 돌지 않는다.
 *
 * 들여쓰기를 주지 않는다(JSON.stringify 의 두 번째 인자 없음). 셸의 정적 블록과 달리 이것은
 * 라우트를 옮길 때마다 문서에 쓰였다 지워지는 값이라 사람이 읽을 일이 없다.
 */
export function routeSchemaJsonFor(pathname: string): string | null {
  const graph = routeSchemaFor(pathname);
  if (!graph) return null;
  /*
   * `<` 를 이스케이프한다. JSON.stringify 는 건드리지 않지만, 값 안에 `</script>` 가 들어오면
   * 그 자리에서 script 요소가 닫히고 뒤가 통째로 마크업으로 읽힌다. `<` 는 여전히
   * 올바른 JSON 이고 파싱하면 같은 문자열이 나오므로 소비자에게는 아무 차이가 없다.
   * (지금 값에는 `<` 가 없다. 없을 때 막아 두는 것이 이런 종류의 방어다.)
   */
  return JSON.stringify(graph).replace(/</g, '\\u003c');
}

/**
 * 프리렌더용 — `<head>` 에 그대로 끼워 넣을 script 태그 한 줄. 스키마가 없는 주소면 `null`.
 *
 * **`/beta` 는 프리렌더된다.** 크롤러가 실제로 읽는 것은 dist/beta.html 의 정적 head 이고
 * 위 훅은 브라우저에서만 돈다. 즉 이 함수를 통해 산출물에 들어가지 않으면 이 브랜치는
 * 정작 스키마가 가장 필요한 단 하나의 주소 — 이 사이트의 유일한 랜딩 페이지 — 에서
 * 아무 효과가 없다.
 *
 * 훅과 **같은** `data-route-schema` 표식을 단다. 프리렌더 문서를 브라우저가 이어받으면
 * useSeoMeta 가 이 태그를 자기 것으로 알아보고 걷어낸 뒤 같은 내용으로 다시 만든다 —
 * 표식이 다르면 둘이 나란히 남아 같은 노드가 두 번 선언된다.
 */
export function routeSchemaScriptTag(pathname: string): string | null {
  const json = routeSchemaJsonFor(pathname);
  return json === null
    ? null
    : `<script type="application/ld+json" ${ROUTE_SCHEMA_ATTR}>${json}</script>`;
}

/** '/notices/' 처럼 끝에 '/' 가 붙어 들어와도 같은 라우트로 본다(routeMeta 의 normalize 와 같다). */
function normalize(pathname: string): string {
  const raw = pathname.split('?')[0].split('#')[0];
  return raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
}
