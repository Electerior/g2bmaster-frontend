/*
 * 오류 문구 고르기.
 *
 * 이 자리가 틀리면 **화면에 원인이 남지 않는다.** 실제로 백엔드가 MySQL 인증에 막혀
 * 죽어 있었는데, vite dev 프록시가 ECONNREFUSED 를 본문 없는 500 으로 바꿔 내려주는 바람에
 * 화면에는 "오류: Request failed with status code 500" 만 떴다. 그 문구에는 백엔드가
 * 안 떠 있다는 사실이 어디에도 없어서, 원인을 찾으려면 개발 서버 로그를 열어야 했다.
 */
import { describe, expect, it } from 'vitest';
import { errorMessageFrom } from './apiClient';

const AXIOS = 'Request failed with status code 500';

describe('errorMessageFrom', () => {
  it('백엔드가 준 한국어 문구를 그대로 쓴다 — 사용자 대상 계약이다', () => {
    expect(errorMessageFrom(503, { error: '나라장터 API 인증에 실패했습니다.' }, AXIOS)).toBe(
      '나라장터 API 인증에 실패했습니다.',
    );
  });

  it('message 가 error 보다 우선한다', () => {
    expect(errorMessageFrom(400, { message: '이쪽', error: '저쪽' }, AXIOS)).toBe('이쪽');
  });

  it('응답 자체가 없으면 연결 실패로 말한다', () => {
    expect(errorMessageFrom(0, undefined, 'Network Error')).toBe('백엔드에 연결하지 못했습니다.');
  });

  it('본문 없는 5xx 는 프록시가 만든 것이다 — axios 문구를 내보내지 않는다', () => {
    // 백엔드의 5xx 는 GlobalExceptionHandler 를 거쳐 언제나 {error} 를 싣는다.
    // 그것이 없다는 것은 우리 백엔드까지 요청이 닿지 않았다는 뜻이다.
    expect(errorMessageFrom(500, undefined, AXIOS)).toBe('백엔드에 연결하지 못했습니다 (HTTP 500).');
    expect(errorMessageFrom(502, {}, AXIOS)).toBe('백엔드에 연결하지 못했습니다 (HTTP 502).');
    expect(errorMessageFrom(504, undefined, AXIOS)).toBe('백엔드에 연결하지 못했습니다 (HTTP 504).');
  });

  it('본문이 있는 5xx 는 프록시 문구로 덮지 않는다 — 백엔드가 말한 이유가 더 정확하다', () => {
    expect(errorMessageFrom(500, { error: '분석 중 오류가 발생했습니다.' }, AXIOS)).toBe(
      '분석 중 오류가 발생했습니다.',
    );
  });

  it('타임아웃은 연결 실패가 아니다 — 그 시각 백엔드는 살아서 상류를 때리고 있다', () => {
    /*
     * 우리가 먼저 끊은 요청도 응답이 없어 status 는 0 이다. 그것을 '백엔드에 연결하지
     * 못했습니다' 로 부르면 원인 귀속이 틀리고, 사용자도 로그도 엉뚱한 곳을 본다.
     * 엣지(nginx 300초)보다 axios 상한이 짧아 느린 요청의 정상 경로다.
     */
    for (const code of ['ECONNABORTED', 'ETIMEDOUT']) {
      expect(errorMessageFrom(0, undefined, 'timeout of 60000ms exceeded', code)).toBe(
        '요청이 제한 시간 안에 끝나지 않았습니다. 조건을 좁혀 다시 시도해 주세요.',
      );
    }
  });

  it('백엔드가 문구를 줬으면 타임아웃 코드보다 그쪽이 우선한다', () => {
    // 코드가 붙어 있어도 본문이 있다는 것은 응답이 왔다는 뜻이다.
    expect(errorMessageFrom(503, { error: '나라장터 점검 중입니다.' }, 'x', 'ECONNABORTED')).toBe(
      '나라장터 점검 중입니다.',
    );
  });

  it('본문 없는 4xx 는 그대로 둔다 — 앞단이 아니라 요청 쪽 문제다', () => {
    // 404·401 을 "연결하지 못했습니다"로 바꾸면 없는 경로를 부른 것이 서버 장애로 보인다.
    expect(errorMessageFrom(404, undefined, 'Request failed with status code 404')).toBe(
      'Request failed with status code 404',
    );
  });
});
