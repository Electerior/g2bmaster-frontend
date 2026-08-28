/*
 * 404. 주소가 곧 화면 상태이므로 오타 난 링크나 옛 북마크가 들어올 수 있다.
 * 빈 화면 대신 돌아갈 길을 준다.
 */
import { Link } from 'react-router-dom';
import { PanelTitle } from '@/components/layout/PanelTitle';
import { NOT_FOUND_META } from '@/seo/routeMeta';
import { useSeoMeta } from '@/seo/useSeoMeta';
import { DEFAULT_ROUTE } from './routePaths';

export function NotFoundScreen() {
  /*
   * 여기 오는 주소는 라우트 표에 없다 — 그래서 이 화면만 메타를 인자로 받는다.
   *
   * noindex 가 이 화면의 요점이다(ACTION-PLAN 1.2). 지금 서버는 알 수 없는 경로에도 셸을
   * 200 으로 내주므로, 오타 난 링크나 옛 북마크가 만든 주소가 전부 "정상 문서"로 크롤된다.
   * 서버가 진짜 404 를 내주기 전까지 그 주소들이 색인에 쌓이는 것을 막는 곳은 여기뿐이고,
   * 서버 쪽이 고쳐진 뒤에도 React 까지 도달하는 경로에는 여전히 이것이 필요하다.
   */
  useSeoMeta(NOT_FOUND_META);

  return (
    <section className="panel" aria-label="페이지를 찾을 수 없음">
      <PanelTitle>페이지를 찾을 수 없습니다</PanelTitle>
      <div className="empty-msg">
        요청하신 주소에 해당하는 화면이 없습니다.
        <div style={{ marginTop: 16 }}>
          <Link className="btn-home" to={DEFAULT_ROUTE}>
            처음 화면으로
          </Link>
        </div>
      </div>
    </section>
  );
}
