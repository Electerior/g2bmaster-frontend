import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiFallbackNote, SummaryState } from './summaryParts';

describe('공고 요약 fallback', () => {
  it('HTTP 200 fallback은 빈 화면이나 스피너 대신 한국어 사유를 표시한다', () => {
    render(
      <SummaryState
        isPending={false}
        error={null}
        onRetry={vi.fn()}
        pendingText="AI 요약 중..."
      >
        <AiFallbackNote
          flags={{ aiFallback: true, aiError: 'LM Studio에 연결할 수 없습니다.' }}
        />
      </SummaryState>,
    );

    expect(
      screen.getByText(/AI 분석에 실패해 기본정보로만 요약했습니다/),
    ).toBeInTheDocument();
    expect(screen.getByText(/LM Studio에 연결할 수 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText('AI 요약 중...')).not.toBeInTheDocument();
  });
});
