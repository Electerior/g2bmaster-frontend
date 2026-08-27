/*
 * 하드웨어 스펙 검색.
 *
 * 원본에서 이 화면은 렌더러(renderSpecSearchPanel, app.js:1384)가 완전히 구현돼 있었는데도
 * TABS 에 항목이 없어 탭을 누르면 TypeError 로 죽었다. 이식하면서 정식 라우트로 살린다.
 *
 * TODO(다음 웨이브): 제목 의미 검색(Module A) + LLM 스펙 추출(Module B).
 */
import { useSeoMeta } from '@/seo/useSeoMeta';
import { ScreenPlaceholder } from './ScreenPlaceholder';

export function SpecSearchScreen() {
  /*
   * 자리표시자를 그리는 화면에도 메타는 붙인다. 주소는 이미 탭 스트립에 걸려 있어 색인될 수
   * 있고, 그때 index.html 의 범용 제목이 아니라 이 화면의 제목이 나가야 한다. 껍데기인
   * ScreenPlaceholder 가 아니라 여기서 부르는 이유는 ScreenPlaceholder 주석에 적어 두었다.
   */
  useSeoMeta();

  return (
    <ScreenPlaceholder
      title="하드웨어 스펙 검색"
      description="CPU·GPU 제목 의미 검색과 규격서 본문 스펙 추출."
    />
  );
}
