/*
 * 정적 robots 태그가 **없는** 문서에서의 useSeoMeta.
 *
 * 파일을 따로 두는 이유: useSeoMeta 는 모듈이 처음 평가될 때 문서의 robots 값을 한 번만
 * 읽어 둔다(그래야 index.html 의 값을 이 파일에 복사해 두지 않아도 된다). 그 값은 모듈
 * 인스턴스마다 하나뿐이라, "정적 태그가 있을 때"와 "없을 때"를 한 파일에서 함께 볼 수 없다.
 * vitest 는 테스트 파일마다 모듈 레지스트리와 문서를 새로 주므로 파일을 나누는 것이 가장
 * 정직한 방법이다 — useSeoMeta.test.tsx 가 있을 때를, 이 파일이 없을 때를 본다.
 *
 * 없을 때의 규칙: 되돌릴 값이 없으므로 **태그를 지운다.** robots 태그가 없는 것이 곧 색인
 * 허용이라 그것으로 충분하고, 남겨 두면 그 값이 어디서 온 것인지 아무도 모르게 된다.
 */
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ROUTES } from '@/routes/routePaths';

const { useSeoMeta } = await import('./useSeoMeta');

function Screen() {
  useSeoMeta();
  return null;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<Screen />} />
      </Routes>
    </MemoryRouter>,
  );
}

const robotsTag = () => document.head.querySelector('meta[name="robots"]');

describe('정적 robots 가 없는 문서', () => {
  it('색인 허용 라우트에서는 robots 태그를 두지 않는다', () => {
    renderAt(ROUTES.noticeSearch);
    expect(robotsTag()).toBeNull();
  });

  it('색인 제외 라우트를 떠나면 심었던 태그를 지운다', () => {
    const view = renderAt(ROUTES.saved);
    expect(robotsTag()?.getAttribute('content')).toBe('noindex,follow');

    view.unmount();
    expect(robotsTag()).toBeNull();
  });
});
