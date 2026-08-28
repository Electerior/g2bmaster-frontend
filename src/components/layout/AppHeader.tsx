/*
 * 통합 상단 헤더 — 예전의 흰색 파트너 배너 + 파란 앱 헤더 두 줄을 한 줄로 합쳤다.
 *
 * 왼쪽은 정체성(ELECTERIOR · G2B Masters), 오른쪽은 연락처와 앱 액션이 한 줄에 온다.
 * 연락처 pill·복사 동작은 예전 배너 그대로다(ContactPill) — 마케팅 문구·링크는 임의로 바꾸지 않는다.
 *
 * 이 헤더에는 제목 요소(h1~h6)가 하나도 없다. 이유는 브랜드 표기 위 주석에 적어 두었다.
 */
import { Link, useNavigate } from 'react-router-dom';
import { fullReset } from '@/domain/storage';
import { DEFAULT_ROUTE } from '@/routes/routePaths';
import { ContactCopyPill, ContactLinkPill } from './ContactPill';
import './layout.css';

/** 일렉테리어 그룹 연락처 — 문구·링크·순서는 원본 index.html 과 동일하게 유지한다. */
export const CONTACT = {
  email: 'hello@electerior.com',
  phone: '010-5598-0054',
  kakao: 'https://pf.kakao.com/_MPGYb',
  site: 'https://www.electerior.com/',
  siteShort: 'https://electerior.com',
  profilePdf: '/electerior-company-profile-20260426.pdf',
  appHome: '/',
} as const;

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
    <header className="app-header" aria-label="상단 헤더">
      {/* ── 정체성: ELECTERIOR · G2B Masters ─────────────────────────────── */}
      <div className="app-header-brand">
        <a
          className="brand-partner"
          href={CONTACT.siteShort}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="일렉테리어 그룹 홈페이지"
        >
          <span className="brand-partner-name">ELECTERIOR</span>
          <span className="brand-partner-sub">GROUP</span>
        </a>
        <span className="brand-divider" aria-hidden="true" />
        <div className="app-header-inner">
          {/*
            브랜드 표기는 제목(h1)이 아니라 그냥 글자다 — 일부러 그렇게 두었다.
            셸은 14개 라우트에서 전부 렌더되므로 여기에 h1 을 두면 모든 주소의 가장 강한
            제목 신호가 "G2B Masters" 하나로 같아진다. 그 자리는 화면마다 다른 제목이
            차지해야 한다(PanelTitle 참고). 되돌려 h1 로 만들면 한 페이지에 h1 이 둘이 되고
            src/routes/routeHeadings.test.tsx 가 깨진다.
            보이는 모습은 .app-title 클래스가 그대로 나른다(global.css · layout.css).
          */}
          <div className="app-title">
            <Link
              className="app-title-link"
              to={DEFAULT_ROUTE}
              aria-label="G2B Masters 초기 화면으로 이동"
            >
              G2B Masters
            </Link>
          </div>
          <span className="app-header-sub">나라장터 입찰정보 통합 조회</span>
        </div>
      </div>

      {/* ── 연락처 + 앱 액션 ─────────────────────────────────────────────── */}
      <div className="app-header-actions" aria-label="연락처 및 앱 메뉴">
        <ContactCopyPill variant="header" value={CONTACT.email} copyLabel="이메일">
          {CONTACT.email}
        </ContactCopyPill>
        <ContactCopyPill variant="header" value={CONTACT.phone} copyLabel="전화번호">
          {CONTACT.phone}
        </ContactCopyPill>
        <ContactLinkPill
          variant="header"
          href={CONTACT.kakao}
          external
          aria-label="카카오톡 일렉테리어 채널 열기"
        >
          카카오톡
        </ContactLinkPill>
        <ContactLinkPill
          variant="header"
          href={CONTACT.profilePdf}
          download
          aria-label="회사소개서 PDF 내려받기"
        >
          회사소개 PDF
        </ContactLinkPill>

        <span className="brand-divider" aria-hidden="true" />

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
