/*
 * 베타 테스터 모집 — 랜딩(/beta)이 쓰는 공개 Spring 엔드포인트.
 * 로그인 전 방문자가 쓰므로 /api/beta/* 에는 앱 키를 붙이지 않는다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '@/lib/apiClient';

export interface BetaStatus {
  /** 화면에 쓰는 전체 모집 규모. 실제 이번 회차 정원과 다를 수 있다. */
  total: number;
  remaining: number;
  /** ISO-8601, offset 포함 */
  deadline: string;
  /** false 면 프론트가 폼을 잠근다. */
  open: boolean;
}

export interface BetaSignupRequest {
  name: string;
  organization: string;
  /** 자유 입력. 폼의 datalist는 예시만 제공한다. */
  industry: string;
  email: string;
  phone: string;
  privacyAgreed: boolean;
  /** 스팸 봇 유인용 히든 필드. 값이 차 있으면 서버가 조용히 버린다. */
  website?: string;
}

interface BetaSignupPayload extends BetaSignupRequest {
  /** 응답 유실 뒤 같은 요청을 다시 받아도 한 건으로 처리하기 위한 식별자. */
  requestId: string;
}

export interface BetaSignupResponse {
  ok: true;
  receivedAt: string;
}

export type SignupState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string };

export const betaKeys = {
  all: ['beta'] as const,
  status: () => ['beta', 'status'] as const,
};

export function fetchBetaStatus(): Promise<BetaStatus> {
  return get<BetaStatus>('/api/beta/status');
}

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function submitBetaSignup(body: BetaSignupRequest): Promise<BetaSignupResponse> {
  const payload: BetaSignupPayload = { ...body, requestId: newRequestId() };
  return post<BetaSignupResponse>('/api/beta/signups', payload);
}

/** 상태 조회가 실패해도 호출 화면은 FALLBACK_STATUS로 계속 렌더한다. */
export function useBetaStatus() {
  return useQuery({
    queryKey: betaKeys.status(),
    queryFn: fetchBetaStatus,
    retry: false,
    staleTime: 30_000,
  });
}

/** 전송 즉시 잔여 수를 반영하고, 실패하면 이전 상태로 되돌린다. */
export function useBetaSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitBetaSignup,
    onMutate: () => {
      const previous = queryClient.getQueryData<BetaStatus>(betaKeys.status());
      queryClient.setQueryData<BetaStatus>(betaKeys.status(), (prev) => {
        if (!prev) return prev;
        const remaining = Math.max(0, prev.remaining - 1);
        return { ...prev, remaining, open: prev.open && remaining > 0 };
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(betaKeys.status(), context.previous);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: betaKeys.status() });
    },
  });
}
