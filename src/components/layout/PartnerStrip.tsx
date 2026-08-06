/*
 * 일렉테리어 그룹 띠. 이 앱의 스폰서 표시이자 문의 창구다.
 * 문구·링크·순서는 원본 index.html(75~96행)과 동일하게 유지한다 — 마케팅 카피는
 * 개발자가 임의로 다듬을 대상이 아니다.
 *
 * ⚠ 이름에 'banner' 를 쓰지 않는다(파일명·컴포넌트명·CSS 클래스 모두).
 * Vite 개발 서버는 소스 파일을 URL 하나씩 그대로 내려주는데, 광고 차단 확장의 기본
 * 필터가 경로에 'banner' 가 든 요청을 막는다(net::ERR_BLOCKED_BY_CLIENT).
 * 이 모듈은 App 이 최상위에서 import 하므로, 한 요청이 막히면 모듈 그래프 전체가 끊겨
 * **React 가 아예 마운트되지 않고 화면이 백지가 된다** — 콘솔을 열기 전에는 원인이 안 보인다.
 * (프로덕션 번들은 한 파일로 합쳐져 이 문제가 없다. 개발 중에만 터지므로 더 헷갈린다.)
 * CSS 클래스도 마찬가지다 — cosmetic 필터가 '.partner-strip' 를 숨겨 버린다.
 */
import { ContactCopyPill, ContactLinkPill } from './ContactPill';
import './layout.css';

export const CONTACT = {
  email: 'hello@electerior.com',
  phone: '010-5598-0054',
  kakao: 'https://pf.kakao.com/_MPGYb',
  site: 'https://www.electerior.com/',
  siteShort: 'https://electerior.com',
  profilePdf: '/electerior-company-profile-20260426.pdf',
  appHome: '/',
} as const;

export function PartnerStrip() {
  return (
    <section className="partner-strip" aria-label="일렉테리어 그룹 문의">
      <div className="partner-strip-inner">
        <a
          className="partner-logo"
          href={CONTACT.siteShort}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="일렉테리어 그룹 홈페이지"
        >
          <img src="/electerior-logo.svg" alt="Electerior Group" width={192} height={42} />
        </a>
        <div className="partner-message">
          <strong>5 Companies, One Mission</strong>
          <span>
            공공조달부터 AI 인프라, 입찰분석까지 - B2G·B2B IT End-to-End 통합솔루션 파트너
          </span>
        </div>
        <div className="partner-actions" aria-label="일렉테리어 그룹 연락처">
          <ContactLinkPill
            variant="home"
            href={CONTACT.appHome}
            aria-label="G2B Masters 초기 화면으로 이동"
          >
            G2B 홈
          </ContactLinkPill>
          <ContactCopyPill value={CONTACT.email} copyLabel="이메일">
            {CONTACT.email}
          </ContactCopyPill>
          <ContactCopyPill value={CONTACT.phone} copyLabel="전화번호">
            {CONTACT.phone}
          </ContactCopyPill>
          <ContactLinkPill
            variant="service"
            href={CONTACT.site}
            external
            aria-label="일렉테리어 홈페이지 열기"
          >
            <span>ELECTERIOR.COM</span>
            <small>www.electerior.com</small>
          </ContactLinkPill>
          <ContactLinkPill variant="kakao" href={CONTACT.kakao} external>
            카카오톡 일렉테리어
          </ContactLinkPill>
          <ContactLinkPill variant="download" href={CONTACT.profilePdf} download>
            회사소개서 PDF
          </ContactLinkPill>
        </div>
      </div>
    </section>
  );
}
