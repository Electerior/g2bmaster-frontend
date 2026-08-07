/*
 * 색인 검색 행을 화면 값으로 옮기는 순수 함수들.
 *
 * 계약이 명시적으로 요구하는 표기 규칙이 둘 있고, 둘 다 "안 지키면 사용자가 필터를
 * 고장 난 것으로 오해한다"는 종류다. 그래서 컴포넌트 안에 흩어 두지 않고 여기 모은다 —
 * 표·서랍 두 곳이 같은 규칙을 써야 하기 때문이다.
 */
import type { NoticeIndexItem, NoticeProduct } from '@/api/search';

/**
 * 지역 표기. **빈 문자열은 '전국'** 이다(지역 제한 없음).
 *
 * 지역으로 좁혀도 전국 공고는 함께 온다 — 서울 업체가 참가할 수 있는 전국 공고가 빠지는
 * 편이 훨씬 큰 손해이기 때문이다. 이 규칙은 화면 표기와 짝이다: '전국'이라고 적지 않으면
 * "서울로 검색했는데 왜 지역이 빈 공고가 나오나"로 읽힌다.
 */
export function regionLabel(region: string | null | undefined): string {
  const value = String(region ?? '').trim();
  return value === '' ? '전국' : value;
}

export interface InstitutionPair {
  /** 화면에 크게 쓸 이름. 공고기관이 없으면 수요기관으로 떨어진다. */
  primary: string;
  /**
   * 수요기관이 공고기관과 **다를 때만** 채워진다. 조달청 대행 공고가 그 경우로,
   * 공고기관은 `조달청 강원지방조달청`, 수요기관은 `강원대학교` 다.
   */
  demand: string;
}

/**
 * 기관 표시. 코드가 아니라 **이름**을 기준으로 그린다 — 사전규격은 원본 오퍼레이션이
 * 기관코드를 주지 않아 코드가 비어 있고 이름만 있다(색인의 약 1/4).
 */
export function institutionPair(item: NoticeIndexItem): InstitutionPair {
  const notice = String(item.noticeInstitutionName ?? '').trim();
  const demand = String(item.demandInstitutionName ?? '').trim();
  if (!notice) return { primary: demand, demand: '' };
  return { primary: notice, demand: demand && demand !== notice ? demand : '' };
}

/** 남은 일수 → 표시 문구. 마감이 없는 계획 단계는 값 자체가 오지 않는다. */
export function ddayLabel(dday: number | null | undefined): string | null {
  if (dday == null || !Number.isFinite(dday)) return null;
  if (dday < 0) return '마감';
  if (dday === 0) return 'D-DAY';
  return `D-${dday}`;
}

/**
 * D-DAY 색 램프 — 기존 표(domain/format.ddayColor)와 같은 경계다.
 * 두 계통이 같은 화면 어휘를 쓰므로 경계가 갈라지면 사용자가 색을 못 믿는다.
 */
export function ddayTone(dday: number): string {
  if (dday <= 2) return 'var(--danger)';
  if (dday <= 7) return 'var(--warn)';
  return 'var(--success)';
}

/** 물품목록 요약 — 표에서는 첫 품명 + 나머지 건수만 보여준다. */
export function productSummary(list: NoticeProduct[] | null | undefined): string {
  const items = (list ?? []).filter((p) => p && String(p.name ?? '').trim());
  if (!items.length) return '';
  const first = String(items[0].name).trim();
  return items.length === 1 ? first : `${first} 외 ${items.length - 1}건`;
}

/**
 * 행 키. 색인은 PK 가 공고번호 하나뿐이라 **한 공고에 행은 언제나 하나**다 —
 * 기존 4탭처럼 차수·출처를 섞어 만들 필요가 없다.
 */
export function indexRowKey(item: NoticeIndexItem, index: number): string {
  return item.id ? String(item.id) : `row-${index}`;
}

/** 낙찰하한율. **백분율 그대로** 온다(88.000 = 88%) — 100을 곱하지 말 것. */
export function lowestBidRateText(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return '';
  // 88.000 → '88%', 87.745 → '87.745%'. 소수점이 있을 때만 다듬는다 —
  // 정수에 그냥 걸면 80 이 '8' 이 된다.
  const text = String(rate);
  const trimmed = text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
  return `${trimmed}%`;
}
