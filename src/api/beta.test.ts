/*
 * 베타 접수는 구글 Apps Script 웹앱으로 간다. 여기서 지키는 것은 재시도의 두 조건이다.
 *
 * /exec 는 스크립트를 돌린 뒤 결과가 담긴 googleusercontent 주소로 302 를 주는데, 그
 * 두 번째 요청이 간헐적으로 구글의 "현재 파일을 열 수 없습니다" HTML 을 돌려준다. 다시
 * 부르지 않으면 방문자가 같은 확률로 실패를 본다 — 그리고 그 재시도는 반드시 같은
 * requestId 로 가야 한다. 302 를 받았다는 건 스크립트가 이미 끝났다는 뜻이라 행은 시트에
 * 들어가 있을 수 있고, requestId 가 새로 발급되면 서버가 그것을 남의 접수로 보고
 * "이미 신청된 이메일"로 막는다. 정상 신청자가 실패 화면을 보게 되는 경로다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('VITE_BETA_SHEET_URL', 'https://script.example.test/exec');

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const { fetchBetaStatus, submitBetaSignup } = await import('./beta');
const { ApiError } = await import('@/lib/apiClient');

const json = (body: unknown) => ({ text: async () => JSON.stringify(body) }) as unknown as Response;
/** 302 뒤에 오는 구글 오류 페이지. JSON 이 아니다. */
const errorPage = () =>
  ({
    text: async () => '<html><body>현재 파일을 열 수 없습니다.</body></html>',
  }) as unknown as Response;

const FORM = {
  name: '홍길동',
  organization: '○○주식회사',
  industry: 'IT장비 납품',
  email: 'hong@example.com',
  phone: '010-0000-0000',
  privacyAgreed: true,
};

/** n 번째 호출이 보낸 본문. */
function sentBody(call: number) {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string);
}

describe('구글 시트 접수', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('현황은 시트를 그대로 읽는다', async () => {
    const status = { total: 20, remaining: 12, deadline: '2026-08-31T23:59:59+09:00', open: true };
    fetchMock.mockResolvedValue(json(status));

    await expect(fetchBetaStatus()).resolves.toEqual(status);
    expect(fetchMock.mock.calls[0][0]).toBe('https://script.example.test/exec');
  });

  it('오류 페이지가 오면 다시 부르고, 재시도는 같은 requestId 를 보낸다', async () => {
    fetchMock
      .mockResolvedValueOnce(errorPage())
      .mockResolvedValueOnce(json({ ok: true, receivedAt: '2026-08-28T16:00:00+09:00' }));

    await expect(submitBetaSignup(FORM)).resolves.toEqual({
      ok: true,
      receivedAt: '2026-08-28T16:00:00+09:00',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(0).requestId).toBeTruthy();
    expect(sentBody(1).requestId).toBe(sentBody(0).requestId);
  });

  it('preflight 를 부르지 않도록 text/plain 으로 보낸다', async () => {
    fetchMock.mockResolvedValue(json({ ok: true, receivedAt: '2026-08-28T16:00:00+09:00' }));

    await submitBetaSignup(FORM);

    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      'Content-Type': 'text/plain;charset=utf-8',
    });
  });

  it('세 번 다 오류 페이지면 포기하고 한국어 문구를 남긴다', async () => {
    fetchMock.mockResolvedValue(errorPage());

    await expect(submitBetaSignup(FORM)).rejects.toMatchObject({
      message: '접수 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.',
      status: 502,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('스크립트가 HTTP 200 에 실은 error 를 ApiError 로 올린다', async () => {
    fetchMock.mockResolvedValue(
      json({
        error: '이미 신청된 이메일입니다. 결과 안내를 기다려 주세요.',
        code: 'DUPLICATE_EMAIL',
      }),
    );

    // 중복은 재시도 대상이 아니다 — 다시 불러도 같은 답이 온다.
    await expect(submitBetaSignup(FORM)).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

/*
 * 저장소만 받아 띄운 서버(.env 가 없다)가 그대로 시트로 접수해야 한다.
 *
 * 환경변수가 없을 때 Spring 으로 새면 폼이 통째로 실패한다 — /api/beta/* 는 아직 배포돼
 * 있지 않아 없는 경로와 똑같은 500 을 준다. 실제로 그렇게 접수가 멈춰 있었다.
 *
 * 환경을 되돌리는 검사라 이 파일의 맨 끝에 둔다.
 */
describe('설정 없는 서버', () => {
  it('환경변수가 없으면 코드에 든 기본 주소로 접수한다', async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    const fresh = await import('./beta');

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(json({ ok: true, receivedAt: '2026-08-28T16:00:00+09:00' }));

    await fresh.submitBetaSignup(FORM);

    expect(fetchMock.mock.calls[0][0]).toMatch(
      /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/,
    );
  });
});
