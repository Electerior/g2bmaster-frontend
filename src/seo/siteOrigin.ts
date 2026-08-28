/*
 * 프로덕션 오리진 — TypeScript 쪽에서 이 값이 사는 **유일한** 곳.
 *
 * 상수 하나에 파일을 하나 쓰는 이유가 있다. index.html 의 정적 head 는 같은 호스트 문자열을
 * canonical · hreflang · og:url · og:image · JSON-LD 세 노드에 걸쳐 아홉 번 적어 두었고,
 * 배포지가 옮겨간 뒤 그 아홉 개가 통째로 옛 호스트(g2bmasters-open.vercel.app)를 가리킨 채
 * 남았다. 검색엔진이 본 것은 "이 사이트의 대표 주소는 다른 도메인"이라는 선언이었고,
 * 감사(ACTION-PLAN 1.1)가 최우선 항목으로 잡은 것이 바로 그 아홉 줄의 일괄 치환이다.
 *
 * 값이 아홉 군데 흩어져 있으면 다음 이사에서도 같은 일이 난다. 그래서 라우트별 메타가
 * 만들어 내는 절대 URL 은 전부 이 상수에서 나온다 — 다음에 도메인이 바뀌면 고칠 곳은
 * 이 파일 한 줄과 index.html(정적 head, 다른 브랜치 소유)뿐이다.
 *
 * 환경변수로 빼지 않는다. canonical 은 "이 문서의 대표 주소"라는 사실 진술이라 빌드 환경에
 * 따라 달라져서는 안 된다 — 스테이징 빌드가 자기 자신을 canonical 로 선언하면 그 스테이징이
 * 색인된다. 프리뷰 배포에서도 프로덕션 주소를 가리키는 지금 동작이 옳다.
 */
export const SITE_ORIGIN = 'https://g2b-masters.electerior.co.kr';

/**
 * 경로 하나를 이 사이트의 절대 URL 로.
 *
 * **인자가 `pathname` 뿐인 것이 이 함수의 요점이다.** 호출부에서 `location.search` 를
 * 넘길 수 없으므로 쿼리가 canonical 에 섞여 들어가는 사고가 타입 수준에서 막힌다.
 * 왜 쿼리를 버려야 하는지는 useSeoMeta.ts 의 canonical 주석에 길게 적어 두었다.
 *
 * 그래도 누군가 `'/notices?cat=입찰'` 처럼 통째로 넘길 수 있으니 방어적으로 잘라 낸다 —
 * 조용히 잘못된 canonical 을 내보내는 것보다 낫다.
 */
export function canonicalUrlFor(pathname: string): string {
  return absoluteUrl(pathname);
}

/**
 * public/ 자산 하나를 이 사이트의 절대 URL 로.
 *
 * 하는 일은 canonicalUrlFor 와 같지만 이름을 갈라 둔다. 부르는 쪽이 다르기 때문이다 —
 * 이쪽은 문서의 대표 주소가 아니라 **파일의 주소**를 만든다. 한 이름으로 겸하면 언젠가
 * canonical 규칙(쿼리를 버린다·끝 슬래시를 뗀다)이 자산 주소에도 그대로 적용된다는 사실이
 * 잊히고, 그때 쿼리가 필요한 자산이 생기면 조용히 잘려 나간다.
 *
 * og:image 가 이 함수를 쓰는 이유는 하나다. **OG 소비자는 상대 경로를 해석하지 않는다.**
 * 카카오톡·페이스북·X 크롤러에게 `/og/beta.png` 를 주면 이미지가 아예 뜨지 않는다.
 */
export function assetUrlFor(path: string): string {
  return absoluteUrl(path);
}

function absoluteUrl(pathname: string): string {
  const raw = pathname.split('?')[0].split('#')[0];
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  // 끝의 '/' 는 떼되 루트는 남긴다 — '/notices' 와 '/notices/' 가 서로 다른 대표 주소로
  // 갈라지면 canonical 을 두는 의미가 없다.
  const normalized = withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash;
  return `${SITE_ORIGIN}${normalized}`;
}
