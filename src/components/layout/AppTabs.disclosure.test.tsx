import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ROUTES, TAB_ITEMS } from '@/routes/routePaths';
import { AppTabs } from './AppTabs';

function renderTabs(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <AppTabs />
    </MemoryRouter>,
  );
}

describe('운영 탭만 노출', () => {
  it('공고 조회와 저장 공고만 한 번씩 렌더한다', () => {
    renderTabs(ROUTES.noticeSearch);

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      '공고 검색',
      '입찰 결과',
      '저장 공고',
    ]);
  });

  it.each([
    '수주 데스크',
    'AI 수주 데스크',
    '단가 DB',
    '가격 DB',
    '하드웨어 스펙 검색',
    '트렌드 분석',
    '가격 분석',
  ])('%s UI를 렌더하지 않는다', (label) => {
    renderTabs(ROUTES.noticeSearch);
    expect(screen.queryByText(label)).not.toBeInTheDocument();
  });

  it('삭제한 화면 경로를 탭 계약에서 제거한다', () => {
    const paths = TAB_ITEMS.map((tab) => tab.path);
    expect(paths).not.toContain('/deal-radar');
    expect(paths).not.toContain('/spec-search');
    expect(paths.some((path) => path.startsWith('/trends/'))).toBe(false);
  });
});

describe('탭 경로 고유성', () => {
  it('같은 경로를 두 번 렌더하지 않고 저장 공고는 정확히 한 번만 둔다', () => {
    const paths = TAB_ITEMS.map((tab) => tab.path);

    expect(new Set(paths).size).toBe(paths.length);
    expect(TAB_ITEMS.filter((tab) => tab.path === ROUTES.saved)).toHaveLength(1);
  });
});
