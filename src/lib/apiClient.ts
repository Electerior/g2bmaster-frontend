import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
} from 'axios';

/**
 * 백엔드(Spring) 호출용 단일 axios 인스턴스.
 *
 * 기존 모놀리스는 프론트와 API가 같은 오리진이었으므로 `fetch('/api/...')` 로 충분했다.
 * 저장소를 나눈 뒤에는 배포 환경마다 백엔드 주소가 달라지므로 baseURL 을 주입한다.
 * 값이 비어 있으면 같은 오리진으로 붙는다 — dev 서버는 vite 프록시가 받아준다.
 */
const baseURL = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * 앱 API 키. 쓰기·비용 경로(`@RequireAppAuth`: 저장 공고, 색인 수동 적재, 분석 작업 등)는
 * 백엔드가 `Authorization: Bearer <key>` 또는 `X-API-Key` 를 요구한다
 * (`security/AppAuthInterceptor`). 키가 비어 있으면 백엔드도 인증을 끄므로(개발 모드),
 * 값이 있을 때만 헤더를 붙인다 — 빈 문자열 Bearer 를 보내면 운영에서 401 이 된다.
 *
 * 이 키는 브라우저 번들에 그대로 들어간다. 조직 내부 배포 기준의 저강도 게이트일 뿐이며,
 * 공개 서비스라면 사용자별 토큰으로 대체해야 한다(그때도 주입 지점은 이 인터셉터 하나다).
 */
const appApiKey = import.meta.env.VITE_APP_API_KEY ?? '';

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * 앱 키 주입 — 저장소를 나누기 전(모놀리스)에는 같은 오리진 세션이라 필요 없던 것이,
 * 프론트가 별도 오리진에서 뜨면서 명시적으로 실어 보내야 하는 값이 됐다.
 * 백엔드가 두 헤더를 모두 받으므로(`AppAuthInterceptor.presentedKey`) 표준적인 Bearer 를 쓴다.
 */
if (appApiKey) {
  apiClient.interceptors.request.use((config) => {
    config.headers.set('Authorization', `Bearer ${appApiKey}`);
    return config;
  });
}

/** 백엔드가 4xx/5xx 로 내려준 오류를 화면에서 쓸 수 있는 형태로 좁힌다. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * `missing[]` 은 베타 모듈의 검증 실패(400)가 문제 된 필드명을 실어 보내는 자리다
 * (계약 §1.1-2). 화면은 보통 error 문구만 띄우지만, 필드 하이라이트가 필요해지면
 * details 로 받아 쓴다 — 여기서 버리면 서버가 보낸 정보가 사라진다.
 */
type ErrorBody = {
  message?: string;
  error?: string;
  code?: string;
  details?: unknown;
  missing?: string[];
};

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorBody>) => {
    const status = error.response?.status ?? 0;
    const body = error.response?.data;
    const message =
      body?.message ??
      body?.error ??
      (status === 0 ? '백엔드에 연결하지 못했습니다.' : error.message);
    return Promise.reject(
      new ApiError(message, status, body?.code, body?.details ?? body?.missing),
    );
  },
);

/** GET 헬퍼 — 응답 본문만 돌려준다. */
export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await apiClient.get<T>(url, config);
  return data;
}

/** POST 헬퍼 — 응답 본문만 돌려준다. */
export async function post<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const { data } = await apiClient.post<T>(url, body, config);
  return data;
}

/** DELETE 헬퍼 — 응답 본문만 돌려준다. */
export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await apiClient.delete<T>(url, config);
  return data;
}
