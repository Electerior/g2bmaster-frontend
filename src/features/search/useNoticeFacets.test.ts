/*
 * 단계 '전체' 칩의 수.
 *
 * 이 자리는 **오류 없이 조용히 틀리는** 자리다. 칩에 적힌 수와 눌렀을 때 나오는 수가
 * 어긋나도 화면은 멀쩡히 뜬다 — 실제로 '마감 전만' 이 켜진 채 단계를 안 고르면 계획·사전규격
 * 칩이 0건으로 그려졌다(2026-08-14). 그 수정의 뒷면이 여기다: 단계 버킷이 서버 스코프를 뺀
 * 수가 되었으므로, 합을 '전체'로 쓰면 이번엔 '전체'가 부풀어 오른다.
 */
import { describe, expect, it } from 'vitest';
import { stageTotalOf } from './useNoticeFacets';

describe('stageTotalOf', () => {
  it('서버가 준 total 을 쓴다 — 버킷 합이 더 커도 그쪽이 아니다', () => {
    const facets = {
      // 단계 버킷은 '마감 전만' 의 입찰 문서 스코프를 뺀 수다(= 칩을 누르면 나오는 수).
      category: [
        { value: '입찰', count: 11306 },
        { value: '사전규격', count: 1854 },
        { value: '계획', count: 1887 },
      ],
      // '전체' 를 누르면 스코프가 걸린 채로 조회되므로 11,306 건이다.
      total: 11306,
    };

    expect(stageTotalOf(facets, 0)).toBe(11306);
  });

  it('total 이 없으면 버킷 합으로 떨어진다 — 옛 백엔드용 보루', () => {
    const facets = {
      category: [
        { value: '입찰', count: 30 },
        { value: '마감', count: 12 },
      ],
    };

    expect(stageTotalOf(facets, 99)).toBe(42);
  });

  it('집계가 아직 없으면 목록의 건수를 쓴다', () => {
    expect(stageTotalOf({}, 7)).toBe(7);
    expect(stageTotalOf({ category: [] }, 7)).toBe(7);
  });

  /** 0 은 "아직 모름"이 아니라 "정말 0건"이다 — 빠뜨리면 마감 단계에서 총계가 튄다. */
  it('total 이 0 이면 0 을 그대로 쓴다', () => {
    expect(stageTotalOf({ category: [{ value: '입찰', count: 5 }], total: 0 }, 9)).toBe(0);
  });
});
