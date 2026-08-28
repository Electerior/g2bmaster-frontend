import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();

vi.mock('@/lib/apiClient', () => ({ get, post }));

const { fetchBetaStatus, submitBetaSignup } = await import('./beta');

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('베타 신청 API', () => {
  it('상태와 접수를 공개 Spring 경로 한 곳으로 보낸다', async () => {
    get.mockResolvedValue({ total: 20, remaining: 12, deadline: '2026-08-31T23:59:59+09:00', open: true });
    post.mockResolvedValue({ ok: true, receivedAt: '2026-08-28T11:30:00+09:00' });

    await fetchBetaStatus();
    await submitBetaSignup({
      name: '홍길동',
      organization: '테스트회사',
      industry: 'IT장비 납품',
      email: 'hello@example.com',
      phone: '010-0000-0000',
      privacyAgreed: true,
    });

    expect(get).toHaveBeenCalledWith('/api/beta/status');
    expect(post).toHaveBeenCalledWith(
      '/api/beta/signups',
      expect.objectContaining({
        email: 'hello@example.com',
        industry: 'IT장비 납품',
        requestId: expect.any(String),
      }),
    );
  });
});
