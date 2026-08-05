/*
 * AI · 검색 설정. LLM(가격 추출·AI 분석)은 LM Studio 또는 OpenAI 호환 외부 API,
 * 검색(웹 단가)은 studyweb 또는 Tavily 를 쓴다. 수정은 로컬 실행에서만 가능하다.
 *
 * 키는 서버가 '••••XXXX' 로 마스킹해서 준다. `llmApiKeySet` 이 "값이 있는가"의 진실이고,
 * `llmApiKey` 는 표시용 문자열일 뿐이다 — 빈 문자열을 저장하면 서버가 기존 값을 유지한다.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '@/lib/apiClient';

export interface MaskedAiConfig {
  llmBase: string;
  llmModel: string;
  searchProvider: string;
  searchUrl: string;
  searchPlatforms: string;
  pricePrompt: string;
  llmApiKey: string;
  searchKey: string;
  llmApiKeySet: boolean;
  searchKeySet: boolean;
}

export interface AiConfigResponse {
  config: MaskedAiConfig;
  editable: boolean;
  status: {
    llm: { base: string; model: string; ok: boolean };
    search: { provider: string; url: string; ok: boolean };
  };
}

export function fetchAiConfig(): Promise<AiConfigResponse> {
  return get<AiConfigResponse>('/api/ai-config');
}

/** 서버가 받는 필드 전체(lib/ai-config.js FIELDS). 빈 키 값은 무시된다. */
export interface AiConfigUpdate {
  llmBase?: string;
  llmApiKey?: string;
  llmModel?: string;
  llmTemperature?: string | number;
  llmTopP?: string | number;
  llmMaxTokens?: string | number;
  llmContextWindow?: string | number;
  searchProvider?: string;
  searchUrl?: string;
  searchKey?: string;
  searchPlatforms?: string;
  pricePrompt?: string;
}

export function updateAiConfig(
  body: AiConfigUpdate,
): Promise<{ ok: true; config: MaskedAiConfig }> {
  return post<{ ok: true; config: MaskedAiConfig }>('/api/ai-config', body);
}

/**
 * 설치된 LLM 모델 목록. 원본은 이 엔드포인트를 부르지 않아 모델 선택 datalist 가
 * 항상 비어 있었다(spec §6). 이식하면서 배선한다.
 */
export interface LlmModelsResponse {
  reachable: boolean;
  base: string;
  loaded: string | null;
  workers: unknown[];
  models: Array<{ id: string; state: string | null }>;
}

export function fetchLlmModels(): Promise<LlmModelsResponse> {
  return get<LlmModelsResponse>('/api/llm/models');
}

export const configKeys = {
  all: ['config'] as const,
  aiConfig: () => ['config', 'ai-config'] as const,
  llmModels: () => ['config', 'llm-models'] as const,
};

export function useAiConfig() {
  return useQuery({ queryKey: configKeys.aiConfig(), queryFn: fetchAiConfig });
}

export function useLlmModels(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: configKeys.llmModels(),
    queryFn: fetchLlmModels,
    enabled: options.enabled ?? true,
  });
}

export function useUpdateAiConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAiConfig,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: configKeys.all }),
  });
}
