/**
 * 가격 분석 탭의 화면 검증용 fixture.
 *
 * API 응답이나 열린 공고의 가격 필드와 섞지 않는다. 실제 분석처럼 보이는 숫자가 조달 판단에
 * 쓰이지 않도록 데이터 출처와 기준일을 UI 안에 반복해서 표시한다. 백엔드 계약이 준비되면 이
 * 컴포넌트의 props 경계에서 실제 모델로 교체하고, 지금 fixture 는 스토리/테스트로 내리면 된다.
 */
import { fmtMoney } from '@/domain/format';
import './mockPriceAnalysis.css';

interface MockPriceItem {
  category: string;
  product: string;
  unitPrice: number;
  basis: '시장 예시' | '협의가 예시';
}

const MOCK_QUANTITY = 7;
const MOCK_QUOTE_TOTAL = 12_950_000;
const MOCK_VAT_RATE = 1.1;

const MOCK_ITEMS: readonly MockPriceItem[] = [
  {
    category: 'CPU',
    product: 'Intel Core Ultra 5 225 정품',
    unitPrice: 305_990,
    basis: '시장 예시',
  },
  {
    category: '메인보드',
    product: 'B860M · LGA1851 · DDR5',
    unitPrice: 144_270,
    basis: '시장 예시',
  },
  {
    category: '메모리',
    product: 'DDR5-5600 32GB (16GB × 2)',
    unitPrice: 619_980,
    basis: '시장 예시',
  },
  {
    category: '저장장치',
    product: 'NVMe M.2 SSD 1TB',
    unitPrice: 200_000,
    basis: '협의가 예시',
  },
  {
    category: '케이스·파워',
    product: '슬림 M-ATX · 정격 400W',
    unitPrice: 84_100,
    basis: '시장 예시',
  },
];

const unitCost = MOCK_ITEMS.reduce((sum, item) => sum + item.unitPrice, 0);
const totalCost = unitCost * MOCK_QUANTITY;
const quoteSupply = Math.round(MOCK_QUOTE_TOTAL / MOCK_VAT_RATE);
const costSupply = Math.round(totalCost / MOCK_VAT_RATE);
const grossProfit = quoteSupply - costSupply;
const marginRate = (grossProfit / quoteSupply) * 100;
const costShare = (totalCost / MOCK_QUOTE_TOTAL) * 100;

export function MockPriceAnalysisPanel() {
  return (
    <div
      className="mock-price-analysis drawer-body"
      role="tabpanel"
      id="notice-price-panel"
      aria-labelledby="notice-price-tab"
      tabIndex={0}
    >
      <div className="mock-price-intro">
        <div>
          <div className="mock-price-kicker">
            <span className="mock-price-badge">MOCK</span>
            가격 분석 화면 예시
          </div>
          <p>
            사무용 PC 7대 구성을 가정한 고정 데이터입니다. 실제 공고 가격이나 실시간 시세와
            연결되지 않습니다.
          </p>
        </div>
        <span className="mock-price-offline">API 연동 없음</span>
      </div>

      <dl className="mock-price-summary" aria-label="Mock 가격 분석 요약">
        <div>
          <dt>기준 수량</dt>
          <dd>{MOCK_QUANTITY}대</dd>
          <span>사무용 PC 예시</span>
        </div>
        <div>
          <dt>대당 매입원가</dt>
          <dd>{fmtMoney(unitCost)}</dd>
          <span>VAT 포함</span>
        </div>
        <div>
          <dt>총 매입원가</dt>
          <dd>{fmtMoney(totalCost)}</dd>
          <span>VAT 포함</span>
        </div>
        <div>
          <dt>견적 합계</dt>
          <dd>{fmtMoney(MOCK_QUOTE_TOTAL)}</dd>
          <span>VAT 포함</span>
        </div>
        <div className="mock-price-summary-emphasis">
          <dt>예상 매출총이익</dt>
          <dd>{fmtMoney(grossProfit)}</dd>
          <span>공급가 기준 · {marginRate.toFixed(1)}%</span>
        </div>
      </dl>

      <section className="mock-price-section" aria-labelledby="mock-price-structure-title">
        <div className="mock-price-section-heading">
          <div>
            <h3 id="mock-price-structure-title">가격 구조</h3>
            <p>견적 합계에서 매입원가와 예상 이익이 차지하는 비중</p>
          </div>
          <strong>{marginRate.toFixed(1)}% 마진</strong>
        </div>
        <div
          className="mock-price-composition"
          role="img"
          aria-label={`매입원가 ${costShare.toFixed(1)}%, 예상 이익 ${(100 - costShare).toFixed(1)}%`}
        >
          <span className="mock-price-cost-part">원가 {costShare.toFixed(1)}%</span>
          <span className="mock-price-profit-part">이익 {(100 - costShare).toFixed(1)}%</span>
        </div>
      </section>

      <section className="mock-price-section" aria-labelledby="mock-price-items-title">
        <div className="mock-price-section-heading">
          <div>
            <h3 id="mock-price-items-title">품목별 원가</h3>
            <p>가격 기준 2026-08-11 · 선택 구성 1대 기준</p>
          </div>
          <span>{MOCK_ITEMS.length}개 품목</span>
        </div>
        <div className="mock-price-table-wrap">
          <table className="mock-price-table">
            <caption className="sr-only">Mock 품목별 원가 명세</caption>
            <thead>
              <tr>
                <th scope="col">품목</th>
                <th scope="col">예시 구성</th>
                <th scope="col">수량</th>
                <th scope="col">예시 단가</th>
                <th scope="col">합계</th>
                <th scope="col">가격 기준</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_ITEMS.map((item) => (
                <tr key={item.category}>
                  <th scope="row">{item.category}</th>
                  <td>{item.product}</td>
                  <td className="mock-price-number">{MOCK_QUANTITY}</td>
                  <td className="mock-price-number">{fmtMoney(item.unitPrice)}</td>
                  <td className="mock-price-number">
                    {fmtMoney(item.unitPrice * MOCK_QUANTITY)}
                  </td>
                  <td>
                    <span
                      className={
                        item.basis === '협의가 예시'
                          ? 'mock-price-source negotiated'
                          : 'mock-price-source'
                      }
                    >
                      {item.basis}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={3}>
                  합계
                </th>
                <td className="mock-price-number">{fmtMoney(unitCost)}</td>
                <td className="mock-price-number">{fmtMoney(totalCost)}</td>
                <td>VAT 포함</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <aside className="mock-price-caution" aria-label="Mock 분석 사용 안내">
        <strong>산정 전 확인</strong>
        <p>
          배송비, 설치비, A/S 충당금과 가격 변동은 반영하지 않았습니다. 이 값은 UI 검토용이며
          견적·투찰 판단에는 사용할 수 없습니다.
        </p>
      </aside>
    </div>
  );
}
