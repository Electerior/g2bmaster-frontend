/** API 계층 단일 진입점 — 화면은 여기서만 가져다 쓴다. */
export * from './types';
export * from './notices';
export * from './search';
export * from './trends';
export * from './analysis';
export * from './saved';
/*
 * './export' 는 일부러 뺐다 — 백엔드에 대응 컨트롤러가 없어 부르면 전부 404 다.
 * 배럴에 두면 `@/api` 자동완성으로 우연히 배선된다. 자세한 사정은 그 파일 머리주석.
 */
export * from './legal';
export * from './specs';
export * from './system';
export * from './config';
export * from './beta';
