import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchNoticeDetail, noticeIndexKeys } from './search';

const get = vi.hoisted(() => vi.fn());

vi.mock('@/lib/apiClient', () => ({
  get,
  post: vi.fn(),
  del: vi.fn(),
  apiClient: {},
  ApiError: class ApiError extends Error {},
}));

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ id: 'R26BK01638523' });
});

describe('공고 색인 상세 복합키', () => {
  it('출처가 있으면 상세 URL 의 source 쿼리로 보낸다', async () => {
    await fetchNoticeDetail('R26BK01638523', 'NURI');
    expect(get).toHaveBeenCalledWith('/api/search/notices/R26BK01638523?source=NURI');
  });

  it('출처가 없으면 기존 상세 URL 을 유지한다', async () => {
    await fetchNoticeDetail('R26BK01638523');
    expect(get).toHaveBeenCalledWith('/api/search/notices/R26BK01638523');
  });

  it('같은 공고번호라도 출처별로 상세 캐시를 나눈다', () => {
    expect(noticeIndexKeys.detail('R26BK01638523', 'G2B')).not.toEqual(
      noticeIndexKeys.detail('R26BK01638523', 'NURI'),
    );
  });
});
