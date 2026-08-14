import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ROUTES } from '@/routes/routePaths';
import { AppTabs } from './AppTabs';

function renderTabs(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AppTabs />
    </MemoryRouter>,
  );
}

describe('트렌드 분석 인덱스', () => {
  it('일반 화면에서는 트렌드 하위 인덱스를 접어 둔다', () => {
    renderTabs(ROUTES.noticeSearch);

    expect(screen.getByRole('button', { name: '트렌드 분석' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('link', { name: '물품 구매 트렌드' })).not.toBeInTheDocument();
  });

  it('트렌드 분석을 누르면 세 하위 인덱스를 펼친다', async () => {
    const user = userEvent.setup();
    renderTabs(ROUTES.noticeSearch);

    await user.click(screen.getByRole('button', { name: '트렌드 분석' }));

    expect(screen.getByRole('button', { name: '트렌드 분석' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('link', { name: '물품 구매 트렌드' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '용역 트렌드' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '공사 트렌드' })).toBeInTheDocument();
  });

  it('트렌드 화면에서는 현재 하위 인덱스가 보이도록 처음부터 펼친다', () => {
    renderTabs(ROUTES.trendService);

    expect(screen.getByRole('button', { name: '트렌드 분석' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('link', { name: '용역 트렌드' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
