import { SAMPLE_NOTICES } from '@/features/beta/landing.config';

const FILTERS = [
  { name: 'IT장비 · 네트워크', count: 34, on: true },
  { name: '사무기기 유통', count: 18, on: false },
  { name: 'SI · 소프트웨어', count: 27, on: false },
  { name: '전산장비 렌탈', count: 9, on: false },
];
const ORGS = [
  { name: '지방자치단체', count: 52 },
  { name: '교육청', count: 21 },
];

/** 히어로 하단에 절반만 걸치는 제품 목업. 이미지가 아니라 전부 마크업입니다. */
export default function ProductMock() {
  return (
    <div className="app">
      <div className="app-bar">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
        <span className="app-title">G2B MASTERS — 오늘의 매칭</span>
      </div>

      <div className="app-body">
        <aside className="app-side">
          <div className="side-lbl">FILTER</div>
          {FILTERS.map((f) => (
            <div key={f.name} className={`side-item${f.on ? ' on' : ''}`}>
              {f.name}
              <s>{f.count}</s>
            </div>
          ))}
          <div className="side-lbl" style={{ marginTop: 12 }}>
            기관
          </div>
          {ORGS.map((o) => (
            <div key={o.name} className="side-item">
              {o.name}
              <s>{o.count}</s>
            </div>
          ))}
        </aside>

        <div className="app-main">
          <div className="app-head">
            {/*
              제목 요소가 아니라 굵은 글자다. 이 블록은 제품 화면을 흉내 낸 장식이고,
              Hero 의 h1 바로 뒤에 h4 가 오면 문서의 제목 사다리가 h1 → h4 로 뛴다.
              굵기·크기는 landing.css 의 `.app-head strong` 이 그대로 나른다.
            */}
            <strong>
              오늘 수집된 공고 <span style={{ color: 'var(--gold)' }}>312</span>건 중 매칭 3건
            </strong>
            <span>2026-08-06 07:00</span>
          </div>

          {SAMPLE_NOTICES.map((n) => (
            <div key={n.no} className={`row${n.hot ? ' hot' : ''}`}>
              <div>
                <div className="row-meta">
                  <span>{n.no}</span>
                  <span>{n.org}</span>
                  <span className="dday">{n.dday}</span>
                </div>
                <div className="row-t">{n.title}</div>
                <div className="row-price">{n.price}</div>
              </div>
              <div className="score">
                <b>{n.score}</b>
                <s>매칭</s>
                <div className="bar-mini">
                  <i style={{ width: `${n.score}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
