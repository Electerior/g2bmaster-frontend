/*
 * 개찰 참여업체의 순위 — **빈 문자열 하나가 표를 뒤집는 자리다.**
 *
 * 백엔드는 순위 없음을 null 이 아니라 `''` 로 준다(firstNonBlank 가 후보를 모두 놓쳤을 때의
 * 값이고, 실격 업체는 순위·금액·투찰률이 다 빈 채로 오는 것이 의도된 계약이다). `?? 99` 는
 * `''` 를 통과시키고 `Number('')` 는 0 이라, 막지 않으면 실격 행이 낙찰 1위보다 앞에 선다.
 * 타입도 린트도 통과하고 오류도 나지 않는다 — 화면에서만 틀린다.
 */
import { describe, expect, it } from 'vitest';
import { NO_RANK, rankOf, rankText } from './rows';

describe('rankOf', () => {
  it('빈 문자열은 0 이 아니라 맨 뒤다 — 실격 업체가 1위 위로 올라오던 자리', () => {
    expect(rankOf({ rank: '' })).toBe(NO_RANK);
    expect(rankOf({ rank: '   ' })).toBe(NO_RANK);
    expect(rankOf({ rank: undefined })).toBe(NO_RANK);
    expect(rankOf({})).toBe(NO_RANK);
  });

  it('숫자로 읽히는 순위는 그대로 쓴다', () => {
    expect(rankOf({ rank: '1' })).toBe(1);
    expect(rankOf({ rank: 2 })).toBe(2);
    // 상류가 공백을 섞어 보내는 경우가 있다.
    expect(rankOf({ rank: ' 3 ' })).toBe(3);
  });

  it('0 이하·비숫자도 맨 뒤로 — 백엔드 CollusionAnalysis.rank() 와 같은 규칙이다', () => {
    expect(rankOf({ rank: '0' })).toBe(NO_RANK);
    expect(rankOf({ rank: '-1' })).toBe(NO_RANK);
    expect(rankOf({ rank: '무효' })).toBe(NO_RANK);
  });

  it('정렬하면 낙찰 1위가 맨 위에 온다', () => {
    const rows = [{ rank: '' }, { rank: '2' }, { rank: '1' }, { rank: '' }];
    expect([...rows].sort((a, b) => rankOf(a) - rankOf(b)).map((r) => r.rank)).toEqual([
      '1',
      '2',
      '',
      '',
    ]);
  });
});

describe('rankText', () => {
  it("빈 문자열도 '-' 로 그린다 — `?? '-'` 만으로는 빈 칸이 남는다", () => {
    expect(rankText({ rank: '' })).toBe('-');
    expect(rankText({ rank: undefined })).toBe('-');
    expect(rankText({ rank: '1' })).toBe('1');
  });
});
