/*
 * 화면 제목 — 한 라우트에 딱 하나 있는 <h1>.
 *
 * 왜 h1 인가.
 * 예전에는 셸의 AppHeader 가 앱 전체에서 유일한 h1 이었고 그 내용은 어느 주소에서나
 * "G2B Masters" 였다. 화면들은 자기 제목을 h2(.panel-title)로 달았다. 그래서 14개 라우트가
 * 전부 같은 브랜드명을 가장 강한 제목으로 내걸고, 페이지별 의미는 어디에도 실리지 않았다.
 * SPA 라 <head> 도 하나뿐이므로 — 라우트별 title·canonical 은 별도 브랜치 소관이다 —
 * 크롤러가 이 주소와 저 주소를 구분할 근거가 사실상 없었다.
 *
 * 지금은 반대다. 브랜드는 제목이 아닌 글자(div.app-title)이고, h1 은 화면이 가진다.
 * 그래서 이 컴포넌트가 렌더하는 h1 은 라우트마다 달라야 하고, 한 화면에 둘이 있으면 안 된다.
 *
 * **화면에 보이는 모습은 예전 h2 와 완전히 같다.** 스타일을 요소가 아니라 클래스
 * (.panel-title)가 나르기 때문이다. 즉 이 변경은 눈으로는 아무 증상이 없다 — 그래서
 * "왜 화면 제목이 h1 이지?" 하고 h2 로 되돌리기 쉽다. 되돌리면 위의 문제가 그대로 돌아온다.
 * src/routes/routeHeadings.test.tsx 가 그 되돌림을 잡는다.
 *
 * 제목 계층도 이 h1 을 기준으로 다시 센다: 화면 안의 소제목은 h2 여야 한다(h1 다음에 바로
 * h3 가 오면 단계를 건너뛰는 것이라 스크린리더의 제목 이동이 어긋난다).
 */
import type { ReactNode } from 'react';

interface PanelTitleProps {
  children: ReactNode;
  /**
   * 제목 줄을 눈에 보이게 두지 않는 화면 — 글자는 남기고 픽셀만 지운다(.sr-only).
   *
   * 표 화면들(공고 검색·입찰 결과·저장 공고·트렌드·낙찰자·담당자)은 원래부터 패널 안에
   * 제목 줄이 없다. 지금 화면이 무엇인지는 왼쪽 탭 레일의 활성 탭이 말해 준다. 그 화면들에
   * 제목 줄을 새로 그리면 그건 SEO 수정이 아니라 UI 변경이므로, 문서 구조에만 제목을 넣는다.
   * 여기 들어가는 문구는 탭 라벨(SCREENS[...].label)과 같아야 한다 — 화면에 없는 말을
   * 크롤러에게만 보여 주는 꼴이 되면 안 된다.
   */
  visuallyHidden?: boolean;
}

export function PanelTitle({ children, visuallyHidden }: PanelTitleProps) {
  return <h1 className={visuallyHidden ? 'sr-only' : 'panel-title'}>{children}</h1>;
}
