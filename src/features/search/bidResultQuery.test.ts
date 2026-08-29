/*
 * 입찰 결과 질의에서 **조용히 틀리는 세 가지**.
 *
 * 셋 다 오류가 나지 않는다. 화면은 '검색 결과가 없습니다' 또는 그럴듯하게 정렬된 표를
 * 보여 주고, 사용자는 데이터가 없다고 읽는다.
 */
import { describe, expect, it } from 'vitest';
import { buildQuery, DEFAULT_CRITERIA, type SearchCriteria } from './useSearchCriteria';

function criteria(patch: Partial<SearchCriteria> = {}): SearchCriteria {
  return { ...DEFAULT_CRITERIA, ...patch };
}

describe('품목 검색은 입찰 결과에 실리지 않는다', () => {
  /*
   * searchField=item 자체는 백엔드에 정상 바인딩된다. 문제는 낙찰정보 행에 품목 필드가
   * 아예 없다는 것이다 — bidItemHaystack 이 늘 비어 AND/OR 항이 하나라도 있으면 0건이다.
   */
  it('입찰 결과에서는 searchField 를 붙이지 않는다', () => {
    const query = buildQuery(criteria({ mode: 'item', andTerms: ['정수기'] }), 'bid-result');
    expect(query.searchField).toBeUndefined();
    // 조회 자체는 키워드 검색으로 정상 동작해야 한다 — 낱말을 버리면 그것대로 0건이다.
    expect(query.andTerms).toBe('정수기');
  });

  it('공고 계열에서는 그대로 붙는다', () => {
    for (const kind of ['bid-announce', 'pre-spec', 'bid-plan'] as const) {
      expect(buildQuery(criteria({ mode: 'item', andTerms: ['정수기'] }), kind).searchField).toBe(
        'item',
      );
    }
  });
});

describe('유사도 파라미터는 보내지 않는다', () => {
  /*
   * 백엔드 SearchCriteria 레코드에 simOr·simFile 이 없어 지금 붙이면 조용히 버려진다.
   * 계약서에는 올라가 있어 "받는다"고 읽히는 자리라 코드로 못박아 둔다.
   */
  it('simOr 가 켜져 있어도 붙지 않는다', () => {
    const query = buildQuery(
      criteria({ simOr: true, orTerms: ['정수기', '냉온수기'] }),
      'bid-result',
    );
    expect(query.simOr).toBeUndefined();
  });

  it('simFile 도 마찬가지다', () => {
    const query = buildQuery(
      criteria({ simFile: true, fileKeywords: ['규격서'] }),
      'bid-result',
    );
    expect(query.simFile).toBeUndefined();
  });
});

describe('크로스탭 공고번호', () => {
  /*
   * '낙찰결과 →' 가 심는 번호다. kind 와 무관하게 bidNtceNo 로 올라가고 키워드는 비워진다 —
   * 그래야 백엔드 BidResultLookup 이 번호로 낙찰건을 직접 찾는다.
   */
  it('번호가 있으면 키워드를 비우고 bidNtceNo 로 올린다', () => {
    const query = buildQuery(
      criteria({ crossBidNtceNo: 'R26BK01638523', andTerms: ['노트북'] }),
      'bid-result',
    );
    expect(query.bidNtceNo).toBe('R26BK01638523');
    expect(query.andTerms).toBe('');
  });
});
