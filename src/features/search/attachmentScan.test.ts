/*
 * 첨부 POST 는 있지만 전역 file-only 필터 계약은 아직 없다 — 그 사실이 조건 판정에
 * 반영돼 있는지 본다.
 *
 * 회귀 내용: `shouldScanAttachments` 가 체크박스와 무관하게 참이 되도록 쓰여 있어서
 * (`isBlockingRelevant` 만으로도 참) GET 후보와 별도 의미의 첨부 POST 를 이어 붙였다.
 * file-only 조건이 GET 후보 전체에 적용된다는 보장이 없어서 결과가 일부 페이지만의 필터처럼
 * 보일 수 있다 — 검색은 성공했는데 관련 공고를 조용히 놓치는, 오류처럼 안 보이는 고장이다.
 *
 * 검색창의 입력은 이미 '준비 중'으로 막혀 있지만 **막힌 것은 입력이지 조건이 아니다.**
 * 조건의 단일 출처는 URL 이라 예전에 공유된 `?file=...` 링크가 그대로 살아 있다.
 */
import { describe, expect, it } from 'vitest';
import {
  ATTACHMENT_SCAN_READY,
  buildQuery,
  DEFAULT_CRITERIA,
  isBlockingRelevant,
  shouldScanAttachments,
  type SearchCriteria,
} from './useSearchCriteria';

function criteria(patch: Partial<SearchCriteria> = {}): SearchCriteria {
  return { ...DEFAULT_CRITERIA, ...patch };
}

describe('shouldScanAttachments', () => {
  it('전역 file-only 필터 계약이 없는 동안은 URL 에 파일 키워드가 있어도 켜지지 않는다', () => {
    // POST 의 존재가 아니라 GET 후보와 같은 전역 결과 집합을 보장하는 계약이 준비 기준이다.
    expect(ATTACHMENT_SCAN_READY).toBe(false);
    expect(shouldScanAttachments(criteria({ fileKeywords: ['제조사'] }), 'bid-announce')).toBe(false);
  });

  it('블로킹 판정이 의미있는 화면에서도 켜지지 않는다 — 예전엔 여기서 늘 참이었다', () => {
    // 원본 판정 자체는 살아 있다. 되살릴 때 무엇이 참이어야 하는지를 함께 박아 둔다.
    expect(isBlockingRelevant('bid-announce')).toBe(true);
    expect(shouldScanAttachments(criteria(), 'bid-announce')).toBe(false);
    expect(shouldScanAttachments(criteria(), 'bid-plan')).toBe(false);
    expect(shouldScanAttachments(criteria(), 'pre-spec')).toBe(false);
  });
});

describe('buildQuery', () => {
  it('스캔하지 않으므로 fileScan(캐시 우회)도 보내지 않는다', () => {
    // fileScan=true 는 백엔드에서 검색 캐시를 우회한다. 스캔하지도 않으면서 매 조회마다
    // 우회하면 나라장터 팬아웃만 그대로 더 태운다.
    expect(buildQuery(criteria({ fileKeywords: ['제조사'] }), 'bid-announce').fileScan).toBeUndefined();
    expect(buildQuery(criteria(), 'bid-announce').fileScan).toBeUndefined();
  });

  it('후보 전체(pageNo=0)로 넓히지 않는다 — 스캔용 확장이었다', () => {
    expect(buildQuery(criteria(), 'bid-announce').pageNo).not.toBe(0);
  });
});
