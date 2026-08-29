/*
 * 공고번호로 낙찰 결과를 물었는데 없을 때.
 *
 * 여기까지 왔다는 것은 서버가 색인을 보고, 없어서 나라장터에도 한 번 물었는데 비었다는
 * 뜻이다. 그러면 남은 가능성은 하나다 — **아직 낙찰이 확정되지 않았다.** 개찰은 끝났는데
 * 낙찰자 확정 전인 구간이 며칠씩 있고, 그 사이 화면이 빈 표만 보여 주면 사용자는 기능이
 * 고장 난 것으로 읽는다(실제로 그 신고로 시작된 화면이다).
 *
 * 그래서 낙찰 대신 **개찰 결과**를 바로 보여 준다. 참여업체와 투찰금액은 이미 공개돼 있어,
 * 낙찰자만 아직 없을 뿐 알고 싶은 것의 대부분은 거기 있다.
 */
import { OpeningPanel } from './drawer/OpeningPanel';

interface NoResultYetProps {
  bidNtceNo: string;
  bidType: string;
}

export function NoResultYet({ bidNtceNo, bidType }: NoResultYetProps) {
  return (
    <div className="no-result-yet">
      <p className="meta">
        <strong>{bidNtceNo}</strong> 의 낙찰 결과가 아직 없습니다 — 개찰은 끝났어도 낙찰자
        확정까지는 며칠 걸립니다. 그동안의 개찰 결과를 대신 보여 드립니다.
      </p>
      <OpeningPanel item={{ bidNtceNo, _type: bidType }} autoLoad />
    </div>
  );
}
