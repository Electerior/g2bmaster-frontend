/*
 * 컬럼 키가 곧 **폭 클래스**라는 사실에서 나오는 잠금.
 *
 * `columnClass(key)` 가 `col-<key>` 를 만들고 table.css 가 그 클래스로 폭을 잡는다. 그래서
 * 한 표 안에서 key 가 겹치면 **그 폭 규칙이 두 번 적용된다.** 실제로 그랬다: 공고 검색의
 * '낙찰결과' 칸이 key 를 'noticeName' 으로 쓰는 바람에 공고명과 같은
 * `.col-noticeName { width: 32% }` 를 받아 둘이 합쳐 64% 를 가져갔고, 남은 여섯 칸이 36% 를
 * 나눠 갖느라 지역 칸이 눌렸다.
 *
 * 타입도 린트도 통과하고 오류도 나지 않는다 — 화면 폭으로만 드러나므로 여기서 잠근다.
 *
 * 범위를 라우팅되는 두 표로 한정한다. pre-spec·bid-announce 에도 중복 키가 있지만
 * (마감일시 + D-DAY 를 같은 키로 두 칸에 그리는 짝) 그 표들은 통합 검색으로 합쳐져
 * 자기 주소가 없다. 되살릴 일이 생기면 그때 같은 기준으로 본다.
 */
import { describe, expect, it } from 'vitest';
import { columnClass } from '@/components/table/columnClass';
import { columnsFor, type ScreenKind } from './columns';

const ROUTED: readonly ScreenKind[] = ['notice-search', 'bid-result'];

describe('폭 클래스 충돌', () => {
  for (const kind of ROUTED) {
    it(`${kind}: 컬럼 키가 겹치지 않는다 — 겹치면 폭을 두 번 요구한다`, () => {
      const keys = columnsFor(kind).map((c) => c.key);
      const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
      expect(dup).toEqual([]);
    });
  }

  it("공고 검색의 '낙찰결과' 는 공고명과 다른 폭 클래스를 받는다", () => {
    const cols = columnsFor('notice-search');
    const name = cols.find((c) => c.label === '공고명 · 공고번호');
    const cross = cols.find((c) => c.label === '낙찰결과');
    expect(name).toBeDefined();
    expect(cross).toBeDefined();
    expect(columnClass(cross!.key)).not.toBe(columnClass(name!.key));
  });
});
