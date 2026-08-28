/*
 * 라우트별 <head> 갱신 훅.
 *
 * 라이브러리를 쓰지 않는다. react-helmet-async 는 이 저장소가 지금 하는 일에 비해 크고,
 * 이 앱은 이미 아홉 화면이 `document.title` 을 직접 만지는 패턴으로 굴러가고 있었다.
 * 그 패턴을 head 의 나머지로 넓히는 것이 맞다 — 새 의존성 하나가 들어오면 <head> 를
 * 프로바이더가 소유하게 되어, 아직 셸 밖에 있는 /beta 까지 그 프로바이더 아래로 넣어야 한다.
 *
 * 대신 규칙을 하나 세운다: **document.title 의 소유자는 이 훅 하나다.** 화면이 직접
 * document.title 을 쓰면 소유자가 둘이 되고, 둘이 되면 언젠가 갈라진다(어느 쪽이 이기는지가
 * 렌더 순서에 달리므로 재현도 안 된다).
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  metaForPath,
  NOT_FOUND_META,
  resolveOgImage,
  type OgImage,
  type RouteMeta,
} from './routeMeta';
import { canonicalUrlFor } from './siteOrigin';

/**
 * robots 지시어 어휘.
 *
 * 값을 갖는 형태(`max-snippet:-1`)는 콜론 앞부분만 본다. 이 목록은 "이 meta 태그가 색인
 * 지시인가"를 판별하는 데만 쓰이므로, 빠진 낱말이 있어도 태그 하나를 못 알아볼 뿐
 * 엉뚱한 태그를 건드리지는 않는다.
 */
const ROBOTS_DIRECTIVES: readonly string[] = [
  'all',
  'index',
  'noindex',
  'follow',
  'nofollow',
  'none',
  'noarchive',
  'nosnippet',
  'indexifembedded',
  'notranslate',
  'noimageindex',
  'nositelinkssearchbox',
  'nopagereadaloud',
  'max-snippet',
  'max-image-preview',
  'max-video-preview',
  'unavailable_after',
];

/** content 가 robots 지시어로만 이루어져 있는가. */
function looksLikeRobotsContent(content: string): boolean {
  const tokens = content
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((token) => ROBOTS_DIRECTIVES.includes(token.split(':')[0].trim()));
}

/**
 * 정적 head 에서 색인 지시를 담고 있는 meta[name] 을 전부 찾는다.
 *
 * **이름 목록을 여기 박아 두지 않는 것이 요점이다.** `['robots','googlebot','naverbot']`
 * 이라고 적으면 그것은 index.html 의 복사본이고, 저쪽에 `bingbot` 이나 `yeti` 가 한 줄
 * 늘어나는 날 이 파일만 모르는 채로 남는다 — 이 감사의 근본 원인이 정확히 "같은 사실이 두
 * 곳에 적혀 한쪽만 고쳐진" 것이었다. 그래서 이름이 아니라 **내용의 생김새**로 찾는다.
 *
 * description·keywords·author·viewport·theme-color 는 이 검사를 통과하지 못한다.
 * 이름이 `robots` 인 태그만은 내용과 무관하게 담는다 — 그 이름 자체가 용도의 선언이다.
 */
function readStaticRobotsTags(): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  if (typeof document === 'undefined') return found;
  for (const tag of document.head.querySelectorAll<HTMLMetaElement>('meta[name][content]')) {
    const content = tag.getAttribute('content') ?? '';
    if (tag.name.toLowerCase() === 'robots' || looksLikeRobotsContent(content)) {
      found.set(tag.name, content);
    }
  }
  return found;
}

/**
 * index.html 이 정적으로 달아 둔 색인 지시 — 태그 이름 → 그 이름에 선언된 값.
 *
 * 하드코딩하지 않고 모듈이 처음 평가될 때 문서에서 읽는다. 이 모듈이 평가되는 시점은
 * `<script type="module">` 실행 시점이라 head 는 이미 파싱돼 있고, 앱은 아직 아무것도
 * 건드리지 않았다 — 즉 여기서 읽히는 값은 언제나 "정적 head 가 선언한 기본값"이다.
 *
 * 읽어 두는 이유: 색인 허용 라우트로 돌아갈 때 되돌릴 값을 이 파일이 알고 있으면 안 된다.
 * index.html 의 robots 는 지금 `index,follow,max-snippet:-1,max-image-preview:large,
 * max-video-preview:-1` 인데, 그 문자열을 여기 복사해 두면 한쪽만 고쳐지는 날이 온다
 * (이 감사의 근본 원인이 정확히 그 종류의 사고였다). 읽어 두면 두 곳이 갈라질 수 없다.
 *
 * 표에 이름이 없으면(=정적 head 에 그 태그가 없으면) 되돌릴 때 태그를 **지운다**.
 * robots 태그가 없는 것이 곧 "색인 허용"이라 그것으로 충분하다.
 */
const STATIC_ROBOTS_TAGS: ReadonlyMap<string, string> = readStaticRobotsTags();

/**
 * 이 훅이 값을 책임지는 색인 지시 태그의 이름들.
 *
 * `robots` 는 정적 head 에 없더라도 언제나 포함한다 — 색인 제외 라우트에서 새로 만들어야
 * 하는 태그가 그것이고, 크롤러별 태그는 없으면 만들 이유가 없다(크롤러별 태그가 없으면
 * 그 크롤러도 일반 `robots` 를 읽는다).
 */
const MANAGED_ROBOTS_NAMES: readonly string[] = [
  'robots',
  ...[...STATIC_ROBOTS_TAGS.keys()].filter((name) => name.toLowerCase() !== 'robots'),
];

/** name= 또는 property= 로 식별되는 meta 태그를 찾거나 만든다. */
function setMetaTag(attr: 'name' | 'property', key: string, content: string): void {
  const selector = `meta[${attr}="${key}"]`;
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function removeMetaTag(attr: 'name' | 'property', key: string): void {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

function setLinkTag(rel: string, href: string): void {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
}

function removeLinkTag(rel: string): void {
  document.head.querySelector(`link[rel="${rel}"]`)?.remove();
}

/**
 * 색인 지시를 세운다. `null` 이면 정적 기본값으로 되돌린다.
 *
 * **여기가 이 파일에서 제일 조심할 곳이다.** noindex 는 심는 것보다 지우는 것이 중요하다:
 * /saved 에서 심은 noindex 가 /notices 로 넘어간 뒤에도 남아 있으면, 저장 공고를 한 번
 * 들른 방문자에게 앱 전체가 noindex 로 보인다. 크롤러가 JS 를 실행하며 링크를 따라가면
 * 실제로 그 순서가 나온다(탭 스트립에 /saved 가 있다). 화면에는 아무 증상도 없고 배포도
 * 정상인 채로 사이트가 조용히 색인에서 지워지는 종류의 사고다.
 *
 * 그래서 두 겹으로 막는다.
 *  1) 훅이 도는 **모든** 라우트에서 robots 를 명시적으로 쓴다. 표에 robots 가 없는
 *     라우트는 "값 없음"이 아니라 "정적 기본값으로 되돌리기"로 취급한다.
 *  2) effect 정리에서도 기본값으로 되돌린다. 라우트를 옮기면 React 는 같은 커밋에서
 *     정리를 먼저 돌리고 새 effect 를 뒤에 돌리므로 새 값이 덮어써 준다. 새 화면이 이 훅을
 *     부르는 것을 잊었더라도 남는 값은 '색인 허용'이다 — 두 실패 방향 중 덜 위험한 쪽이다
 *     (/saved 가 잘못 색인되는 것은 되돌릴 수 있지만, 사이트 전체가 색인에서 빠지는 것은
 *     발견하는 데 몇 주가 걸린다).
 *
 * 그리고 **robots 는 태그 하나가 아니다.** index.html 은 같은 말을 세 이름에 적어 두었다:
 *
 *   <meta name="robots"    content="index,follow,max-snippet:-1,…">
 *   <meta name="googlebot" content="index,follow">
 *   <meta name="naverbot"  content="index,follow">
 *
 * 첫 줄만 갈아 끼우면 /saved 의 head 는 "색인하지 마라(robots)"와 "색인하라(googlebot ·
 * naverbot)"를 동시에 말하는 문서가 된다. 구글은 이 충돌의 해석을 문서로 정해 두었다 —
 * 크롤러별 규칙이 여럿이면 **부정 규칙의 합집합**을 쓰므로, index·follow 는 부정 규칙이
 * 아니어서 구글에 한해서는 noindex 가 살아남는다. 문제는 나머지다. 이 서비스의 주 시장인
 * 네이버는 그런 해석 규칙을 밝힌 적이 없고, 자기 이름이 붙은 태그를 더 구체적인 지시로
 * 읽어도 이상하지 않다. 어느 쪽으로 해석되든 한 head 안에 서로 반대되는 말을 남겨 둘 이유가
 * 없으므로, 정적 head 에 존재하는 색인 지시 태그 전부를 함께 움직인다.
 */
function applyRobots(value: string | null): void {
  for (const name of MANAGED_ROBOTS_NAMES) {
    const effective = value ?? STATIC_ROBOTS_TAGS.get(name) ?? null;
    if (effective === null) removeMetaTag('name', name);
    else setMetaTag('name', name, effective);
  }
}

/**
 * 이 훅이 값을 책임지는 공유 카드 태그 — [속성 종류, 이름] 쌍.
 *
 * robots 쪽이 이름 목록을 박아 두지 않은 것과 대비된다. 저쪽에서 이름을 박으면 그것은
 * index.html 이 무엇을 적어 두었는가의 복사본이지만(그 파일에 `bingbot` 이 한 줄 늘면
 * 이쪽만 모르게 된다), 여기 적힌 여섯은 index.html 의 선택이 아니라 **OpenGraph·Twitter
 * 규격이 정한 이름**이다. 규격은 index.html 을 고쳐도 바뀌지 않는다.
 *
 * 복사하면 안 되는 것은 이름이 아니라 **값**이고, 값은 아래 STATIC_IMAGE_TAGS 가 문서에서
 * 읽는다. 기본 카드 주소(/og-image.png)를 이 파일에 적어 두었다면 그것이야말로 이 감사의
 * 근본 원인 — 같은 사실이 두 곳에 적혀 한쪽만 고쳐지는 것 — 을 그대로 재현하는 일이다.
 *
 * twitter:image 는 정적 head 에 없다. 없으면 X 는 og:image 로 물러나므로 기본 상태에서
 * 필요가 없었고, 카드가 있는 라우트에서만 만들었다가 떠날 때 다시 지운다.
 */
const MANAGED_IMAGE_TAGS: ReadonlyArray<readonly ['name' | 'property', string]> = [
  ['property', 'og:image'],
  ['property', 'og:image:width'],
  ['property', 'og:image:height'],
  ['property', 'og:image:alt'],
  ['name', 'twitter:image'],
  ['name', 'twitter:image:alt'],
];

/**
 * index.html 이 정적으로 달아 둔 공유 카드 — 태그 이름 → 값.
 *
 * STATIC_ROBOTS_TAGS 와 같은 시점, 같은 이유로 읽는다. 카드가 없는 라우트로 돌아갈 때
 * 되돌릴 값을 이 파일이 알고 있으면 안 된다. 표에 이름이 없으면(=정적 head 에 그 태그가
 * 없으면) 되돌릴 때 태그를 **지운다**.
 */
const STATIC_IMAGE_TAGS: ReadonlyMap<string, string> = readStaticImageTags();

function readStaticImageTags(): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  if (typeof document === 'undefined') return found;
  for (const [attr, key] of MANAGED_IMAGE_TAGS) {
    const content = document.head
      .querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
      ?.getAttribute('content');
    if (content != null) found.set(key, content);
  }
  return found;
}

/**
 * 공유 카드를 세운다. `null` 이면 정적 기본 카드로 되돌린다.
 *
 * applyRobots 와 같은 구조이고, 같은 사고를 막는다: /beta 에서 심은 모집 카드가 그 다음
 * 라우트까지 따라가면, 랜딩을 한 번 들른 방문자가 공유한 /notices 링크에 '베타 테스터
 * 모집' 카드가 붙는다. 화면에는 아무 증상이 없고, 공유된 뒤 상대방 화면에서만 드러난다.
 *
 * 그래서 여기도 두 겹이다 — 훅이 도는 **모든** 라우트에서 여섯 태그를 명시적으로 쓰고,
 * effect 정리에서도 기본 카드로 되돌린다. 다음 화면이 훅을 부르는 것을 잊었을 때 남는
 * 값이 '범용 제품 카드'인 쪽이 '남의 라우트 카드'보다 낫다.
 */
function applyOgImage(image: OgImage | null): void {
  const resolved = image ? resolveOgImage(image) : null;
  const routeValues: Readonly<Record<string, string>> = resolved
    ? {
        'og:image': resolved.url,
        'og:image:width': resolved.width,
        'og:image:height': resolved.height,
        'og:image:alt': resolved.alt,
        'twitter:image': resolved.url,
        'twitter:image:alt': resolved.alt,
      }
    : {};

  for (const [attr, key] of MANAGED_IMAGE_TAGS) {
    const effective = routeValues[key] ?? STATIC_IMAGE_TAGS.get(key) ?? null;
    if (effective === null) removeMetaTag(attr, key);
    else setMetaTag(attr, key, effective);
  }
}

interface ResolvedMeta {
  title: string;
  description: string;
  robots: string | null;
  /** 절대 URL. `null` 이면 canonical 과 og:url 을 아예 두지 않는다(404). */
  canonical: string | null;
  /** 라우트 전용 카드. `null` 이면 정적 head 의 기본 카드로 되돌린다. */
  image: OgImage | null;
}

/** 실제로 <head> 를 쓰는 부분. React 와 무관하므로 테스트에서 단독으로도 부를 수 있다. */
export function applySeoMeta({
  title,
  description,
  robots,
  canonical,
  image,
}: ResolvedMeta): void {
  document.title = title;
  setMetaTag('name', 'description', description);

  /*
   * og:* 와 twitter:* 는 제목·설명을 그대로 재사용한다. 카카오톡·페이스북·X 미리보기가
   * 라우트와 무관하게 같은 문구를 보이던 것이 문제였지, 채널별로 다른 문구가 필요한 것은
   * 아니었다. og:type · og:site_name · og:locale · twitter:card 는 라우트마다 달라질 이유가
   * 없어 index.html 의 정적 값을 그대로 둔다.
   */
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', description);
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', description);

  applyRobots(robots);
  applyOgImage(image);

  if (canonical) {
    setLinkTag('canonical', canonical);
    // og:url 이 canonical 과 다르면 공유 링크와 대표 주소가 갈라진다. 항상 같은 값을 쓴다.
    setMetaTag('property', 'og:url', canonical);
  } else {
    removeLinkTag('canonical');
    removeMetaTag('property', 'og:url');
  }
}

/**
 * 이 라우트의 메타를 <head> 에 반영한다.
 *
 * 인자를 주지 않으면 현재 pathname 으로 표를 찾는다. 화면 컴포넌트가 아니라 **주소**가
 * 메타를 정한다는 뜻이다 — 한 컴포넌트가 여러 라우트를 담당하는 경우(TrendScreen 셋,
 * ScreenPlaceholder 셋)에도 라우트 하나에 메타 하나가 붙는다.
 *
 * 인자를 주는 경우는 표에 없는 화면 하나뿐이다(404 → NOT_FOUND_META).
 */
export function useSeoMeta(explicit?: RouteMeta): void {
  const { pathname } = useLocation();

  /*
   * 표에 없는 주소는 404 취급한다. 라우터가 `*` 로 받는 주소가 여기 오는데, 그것은 정의상
   * 문서가 아니다. 표는 타입으로 강제되므로 실재하는 라우트가 여기로 떨어질 일은 없다.
   */
  const meta = explicit ?? metaForPath(pathname) ?? NOT_FOUND_META;

  const { title, description } = meta;
  const robots = meta.robots ?? null;

  /*
   * ⚠ canonical 은 pathname 만으로 만든다. 쿼리스트링은 통째로 버린다.
   *
   * 이 감사가 실제로 본 주소는
   *   /notices?from=2026-07-28&to=2026-08-27&mode=item&cat=입찰
   * 였다. from/to 는 자유 형식 날짜이고 cat 도 열려 있어서 조합 가능한 주소가 사실상
   * 무한하고, SPA 라 그 전부가 200 을 낸다. canonical 을 자기 주소로 두면 크롤러에게
   * "서로 다른 문서가 무한히 있다"고 말하는 셈이 되어 크롤 예산이 필터 조합을 훑는 데
   * 쓰이고, 정작 같은 내용인 문서들이 중복으로 서로의 순위를 갉아먹는다.
   *
   * 필터 상태는 문서가 아니라 **앱의 상태**다. 날짜로 잘리고 카테고리로 좁혀진 결과 목록
   * 뒤에는 안정된 검색 질의가 없고 내용도 매일 바뀐다. 필터가 무엇이든 그 전부의 대표
   * 주소는 맨 `/notices` 하나다 — ACTION-PLAN 1.6 이 말하는 "canonical = origin +
   * pathname, no query" 가 정확히 이 규칙이고, 그래서 canonicalUrlFor() 는 애초에
   * pathname 밖에 받지 못하게 만들어 두었다.
   *
   * 결과적으로 useLocation() 에서 search 를 읽지 않는다. 읽을 이유가 없는 것이 아니라
   * 읽으면 안 되는 것이라, 아래 의존성 배열에도 pathname 만 들어간다.
   */
  const canonical =
    meta.canonicalPath === null ? null : canonicalUrlFor(meta.canonicalPath ?? pathname);

  /*
   * 카드만 원시값이 아니다. 나머지 넷은 값이 같으면 effect 가 다시 돌지 않지만, 이것은
   * 참조로 비교된다 — 표에서 오는 카드는 모듈 상수라 라우트가 그대로면 참조도 그대로이고
   * (경유지의 스프레드도 필드를 복사할 뿐 카드 객체 자체는 같은 것을 가리킨다), 인자로
   * 받은 메타가 매 렌더 새 카드를 만드는 경우에만 effect 가 한 번 더 돈다. 그때 하는 일이
   * 같은 값을 다시 쓰는 것이라 화면에도 head 에도 차이가 없다.
   */
  const image = meta.image ?? null;

  useEffect(() => {
    applySeoMeta({ title, description, robots, canonical, image });
    return () => {
      applyRobots(null);
      applyOgImage(null);
    };
  }, [title, description, robots, canonical, image]);
}
