/*
 * 상단 헤더 — 56px 짜리 --primary 바.
 *
 * 원본은 제목과 '처음 화면' 이 절대 URL(vercel 주소)이었다. SPA 에서 그대로 두면
 * 누를 때마다 전체 새로고침이 일어나므로 라우터 링크로 바꾼다.
 */
import { Link, useNavigate } from 'react-router-dom';
import { fullReset } from '@/domain/storage';
import { DEFAULT_ROUTE } from '@/routes/routePaths';
import './layout.css';

interface AppHeaderProps {
  /** 우리 회사 프로필 모달 열기. 모달 자체는 다음 웨이브에서 붙는다. */
  onOpenSettings?: () => void;
}

export function AppHeader({ onOpenSettings }: AppHeaderProps) {
  const navigate = useNavigate();

  /**
   * 전체 리셋 — 검색 조건과 즐겨찾기를 지우고 기본 화면으로 돌아간다.
   * 조건이 URL 에 있으므로 "지운다" 는 곧 쿼리 없는 기본 라우트로 이동하는 것과 같다.
   * 우리 회사 프로필은 남긴다(storage.fullReset 참고).
   */
  const handleFullReset = () => {
    fullReset();
    navigate(DEFAULT_ROUTE, { replace: true });
  };

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <h1>
          <Link className="app-title-link" to={DEFAULT_ROUTE} aria-label="G2B Masters 초기 화면으로 이동">
            G2B Masters
          </Link>
        </h1>
        <span className="app-header-sub">나라장터 입찰정보 통합 조회</span>
      </div>
      <div className="app-header-actions">
        <Link className="btn-home" to={DEFAULT_ROUTE} aria-label="G2B Masters 초기 화면으로 이동">
          처음 화면
        </Link>
        <button
          type="button"
          className="btn-full-reset"
          onClick={handleFullReset}
          title="검색 조건, 화면 히스토리, 즐겨찾기를 모두 지웁니다. 우리 회사 프로필은 유지됩니다."
        >
          전체 리셋
        </button>
        <button
          type="button"
          className="btn-settings"
          onClick={onOpenSettings}
          title="우리 회사 프로필 설정"
        >
          ⚙ 우리 회사
        </button>
      </div>
    </header>
  );
}
