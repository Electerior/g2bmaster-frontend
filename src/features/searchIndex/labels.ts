/*
 * 통합 검색의 표기 규칙.
 *
 * 컴포넌트 파일과 나눠 둔 이유는 리액트 fast-refresh 때문이다 — 한 파일이 컴포넌트와
 * 일반 함수를 함께 내보내면 편집할 때마다 모듈이 통째로 다시 평가된다(그리고 eslint 가
 * react-refresh/only-export-components 로 경고한다).
 */

/**
 * 지역 표기.
 *
 * **빈 문자열은 '없음'이 아니라 '전국'이다** — 지역 제한이 걸리지 않은 공고라는 뜻이고,
 * 그런 공고는 어느 지역 업체든 참여할 수 있다. 빈칸으로 두면 사용자는 데이터가 빠진 줄 안다.
 *
 * 이 규칙이 서버의 지역 필터와 짝을 이룬다는 점이 중요하다. 서버는 '경기도'로 좁혀도
 * 지역 제한이 없는 공고를 함께 돌려주는데(참여할 수 있으므로), 그때 화면에 '전국'이라고
 * 적혀 있어야 사용자가 그 결과를 필터 오작동으로 오해하지 않는다.
 */
export function regionLabel(region: string): string {
  return region && region.trim() ? region : '전국';
}

/** 지역 제한이 없는가(= 전국). 표기를 흐리게 할지 판단하는 데 쓴다. */
export function isNationwide(region: string): boolean {
  return !region || !region.trim();
}
