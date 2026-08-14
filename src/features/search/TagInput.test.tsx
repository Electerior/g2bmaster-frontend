import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TagInput } from './TagInput';

function renderTagInput(onSubmit = vi.fn()) {
  render(
    <TagInput
      kind="and"
      badgeLabel="모두 포함"
      placeholder="키워드 입력"
      values={[]}
      onChange={vi.fn()}
      onSubmit={onSubmit}
    />,
  );
  return { input: screen.getByRole('textbox', { name: '모두 포함 키워드' }), onSubmit };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('TagInput 한글 IME', () => {
  it('조합 중 Enter는 최종 한글 단어를 한 번만 확정한다', () => {
    vi.useFakeTimers();
    const { input, onSubmit } = renderTagInput();

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '컴퓨' } });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input, { data: '컴퓨터' });
    fireEvent.change(input, { target: { value: '컴퓨터' } });
    act(() => vi.runAllTimers());

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(['컴퓨터']);
  });

  it('Safari 순서처럼 compositionend 뒤에 온 Enter도 중복 없이 한 번만 확정한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const { input, onSubmit } = renderTagInput();

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '기자재' } });
    fireEvent.compositionEnd(input, { data: '기자재' });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13, isComposing: false });
    act(() => vi.runAllTimers());

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(['기자재']);
  });

  it('조합 제출 직후 blur가 와도 마지막 음절을 별도 태그로 확정하지 않는다', () => {
    vi.useFakeTimers();
    const { input, onSubmit } = renderTagInput();

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '컴퓨터' } });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, isComposing: true });
    fireEvent.compositionEnd(input, { data: '컴퓨터' });
    fireEvent.blur(input);
    act(() => vi.runAllTimers());

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(['컴퓨터']);
  });
});
