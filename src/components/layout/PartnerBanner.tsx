/*
 * 일렉테리어 그룹 배너. 이 앱의 스폰서 표시이자 문의 창구다.
 * 문구·링크·순서는 원본 index.html(75~96행)과 동일하게 유지한다 — 마케팅 카피는
 * 개발자가 임의로 다듬을 대상이 아니다.
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

export function PartnerBanner() {
  return (
    <section className="partner-banner" aria-label="일렉테리어 그룹 문의">
      <div className="partner-banner-inner">
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
