import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

const mutate = vi.fn();

vi.mock('@/api/beta', () => ({
  useBetaSignup: () => ({ mutate }),
}));

vi.mock('@/features/beta/useLandingMotion', () => ({
  d: () => ({}),
  useCountUp: (_value: number) => ({ ref: vi.fn(), text: '12' }),
  useGrow: () => ({ ref: vi.fn(), grown: true }),
}));

const { default: Apply } = await import('./Apply');

beforeEach(() => mutate.mockReset());

it('서버로 요청을 전달하면 즉시 접수 완료를 표시하고 실패하면 오류로 복귀한다', () => {
  render(
    <Apply
      status={{ total: 20, remaining: 12, deadline: '2026-08-31T23:59:59+09:00', open: true }}
      countdown="3일"
    />,
  );

  fireEvent.change(screen.getByLabelText('이름'), { target: { value: '홍길동' } });
  fireEvent.change(screen.getByLabelText('연락처'), { target: { value: '010-0000-0000' } });
  fireEvent.change(screen.getByLabelText('소속 기관 · 기업'), { target: { value: '테스트회사' } });
  fireEvent.change(screen.getByLabelText('업종'), { target: { value: 'IT장비 납품' } });
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'hello@example.com' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: '베타 신청하기' }));

  expect(screen.getByText('신청이 접수되었습니다')).toBeInTheDocument();

  const options = mutate.mock.calls[0][1] as { onError: (error: Error) => void };
  act(() => options.onError(new Error('접수 서버에 연결하지 못했습니다.')));

  expect(screen.queryByText('신청이 접수되었습니다')).not.toBeInTheDocument();
  expect(screen.getByText('접수에 실패했습니다. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument();
});
