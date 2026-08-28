/*
 * 검색창 키워드 줄의 잠금 장치.
 *
 * '파일 내'(첨부 PDF·HWPX 본문 검색) 행은 2026-08-28 에 지웠다. 준비 중 표시를 단 채로
 * 키워드·품목 검색의 네 번째 줄을 차지해 왔는데, 통합 검색 질의(buildNoticeIndexQuery)는
 * 그 조건을 아예 싣지 않아 눌러도 결과가 달라지지 않는 줄이었다.
 *
 * 조건 계층(criteria.fileKeywords · simFile)은 남겨 두었으므로 화면에 행 하나만 다시
 * 붙이면 되살아난다 — 그래서 여기서 "줄은 셋뿐"임을 고정한다. 지운 것을 지운 채로
 * 두려면 잠금이 있어야 한다. 마지막 케이스는 예전에 공유된 `?file=` 링크로 들어와도
 * 그 줄이 되살아나지 않는지까지 본다.
 */
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SearchHeader } from './SearchHeader';

vi.mock('@/lib/apiClient', () => ({
  get: vi.fn(() => new Promise(() => {})),
  post: vi.fn(),
  del: vi.fn(),
  apiClient: {},
  ApiError: class ApiError extends Error {},
}));

/** 검색창이 그린 조건 줄의 배지 문구 — 줄 하나에 배지 하나다(TagInput · ClearableInput). */
function badgesAt(entry: string): string[] {
  const { container } = render(
    <MemoryRouter initialEntries={[entry]}>
      <SearchHeader />
    </MemoryRouter>,
  );
  return [...container.querySelectorAll('.bool-badge')].map((el) => el.textContent ?? '');
}

describe('SearchHeader 조건 줄', () => {
  it('키워드 검색은 세 줄뿐이다 — 파일 내 행은 없다', () => {
    expect(badgesAt('/notices?mode=keyword')).toEqual(['모두 포함', '하나 이상', '제외']);
  });

  it('품목 검색도 같은 세 줄이다', () => {
    expect(badgesAt('/notices?mode=item')).toEqual(['모두 포함', '하나 이상', '제외']);
  });

  it('발주기관 검색은 기관 줄만 그린다', () => {
    expect(badgesAt('/notices?mode=instt')).toEqual(['발주기관']);
  });

  it('옛 링크의 ?file= 조건이 남아 있어도 그 줄은 그리지 않는다', () => {
    expect(badgesAt('/notices?mode=keyword&file=제조사&simFile=true')).toEqual([
      '모두 포함',
      '하나 이상',
      '제외',
    ]);
  });
});
