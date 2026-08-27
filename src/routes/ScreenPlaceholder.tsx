/*
 * 화면 자리표시자.
 *
 * 이 웨이브의 목표는 셸과 라우팅이 맞는지 확인하는 것이다. 각 화면의 내부는 다음 웨이브에서
 * 채운다. 자리표시자를 두는 이유는 라우트를 나중에 붙이면 "라우트는 있는데 컴포넌트가
 * 없어서 흰 화면" 상태를 거치게 되고, 그 상태에서는 셸이 맞는지 확인할 수 없기 때문이다.
 */
interface ScreenPlaceholderProps {
  title: string;
  /** 다음 웨이브에서 이 화면이 무엇을 하게 되는지 — 한 줄. */
  description?: string;
}

/*
 * 문서 제목은 여기서 만지지 않는다.
 *
 * 이 컴포넌트는 세 라우트(/spec-search · /analysis-lab · /system)가 함께 쓰는 껍데기다.
 * 여기서 head 를 쓰면 컴포넌트 하나가 세 주소의 메타를 대신 정하게 되고, 그 셋이 자리표시자를
 * 벗고 제 내용을 갖는 날 — TODO 는 각 화면에 이미 적혀 있다 — 메타가 조용히 함께 떨어져 나간다.
 * 그래서 head 는 각 라우트 화면이 useSeoMeta() 로 직접 세우고(라우트 하나 = 메타 하나),
 * title prop 은 눈에 보이는 제목(h2)과 aria-label 의 몫으로 남는다.
 */
export function ScreenPlaceholder({ title, description }: ScreenPlaceholderProps) {
  return (
    <section className="panel" aria-label={title}>
      <h2 className="panel-title">{title}</h2>
      <div className="empty-msg">
        준비 중
        {description ? (
          <div className="meta" style={{ marginTop: 8 }}>
            {description}
          </div>
        ) : null}
      </div>
    </section>
  );
}
