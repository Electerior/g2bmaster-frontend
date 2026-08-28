import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  post,
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

const { summarizeNotice } = await import('./analysis');

describe('summarizeNotice', () => {
  beforeEach(() => {
    post.mockReset();
  });

  it('모든 공고 유형을 단일 요약 엔드포인트로 보낸다', async () => {
    post.mockResolvedValue({
      summary: '# 요약',
      promptVersion: 'notice-summary-v1',
      llmModel: 'local-model',
    });

    await summarizeNotice({
      entityType: 'pre_spec',
      bfSpecRgstNo: '12345',
      title: '서버 사전규격',
    });

    expect(post).toHaveBeenCalledWith('/api/notice-summary', {
      entityType: 'pre_spec',
      bfSpecRgstNo: '12345',
      title: '서버 사전규격',
    });
  });

  it('HTTP 200 fallback 응답을 오류로 바꾸지 않는다', async () => {
    const fallback = {
      aiFallback: true as const,
      aiError: 'LM Studio에 연결할 수 없습니다.',
      summary: null,
    };
    post.mockResolvedValue(fallback);

    await expect(summarizeNotice({ bidNtceNo: 'R26BK01' })).resolves.toEqual(fallback);
  });
});
