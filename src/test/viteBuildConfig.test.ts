/*
 * 빌드 설정 잠금 — 눈에 안 보이는 회귀를 잡는 자리.
 *
 * ── 왜 이 파일이 생겼나 ────────────────────────────────────────────────────
 * PR #16(chore/vite-build-hardening)이 프로덕션 소스맵을 끄고 벤더 청크를 갈랐다.
 * 그 뒤 PR #24(feat/beta-prerender)를 머지하면서 vite.config.ts 가 충돌했고, 충돌이
 * 브랜치 쪽으로 풀리며 **두 결정이 함께 사라졌다** — `sourcemap` 은 true 로 돌아갔고
 * `rollupOptions.output.manualChunks` 배선은 통째로 빠졌다.
 *
 * 어느 쪽도 화면에 증상이 없다. 앱은 똑같이 돌고 테스트도 전부 통과했다. 드러나는 곳은
 * dist 뿐이라, 배포한 뒤 `/assets/index-*.js.map` 이 200 으로 2.9MB 내려받히는 것을
 * 누군가 확인하기 전까지 아무도 모른다. 실제로 감사가 그걸 발견해서 1.5 항목이 됐고,
 * 고친 지 하루 만에 같은 방식으로 되돌아왔다.
 *
 * ── 왜 import 하지 않고 원문을 읽나 ────────────────────────────────────────
 * vite.config.ts 는 `__dirname` 을 쓰기 때문에 vitest 의 ESM 로더에서 import 되지 않는다.
 * index.html 을 원문으로 읽어 검사하는 src/test/indexHtmlSeo.test.ts 와 같은 수법을 쓴다 —
 * 이 저장소에서 "설정 파일의 사실"을 잠그는 방식은 이미 그것이다.
 *
 * ── 이 테스트가 못 보는 것 ─────────────────────────────────────────────────
 * 값이 옳게 적혀 있는지만 본다. vite 가 그 값을 실제로 어떻게 쓰는지는 빌드해야 안다.
 * 그 확인은 `npm run build` 뒤 dist 에 `.map` 이 없는지 보는 것이고, deploy.sh 의
 * 배포 전 점검이 맡는다.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// jsdom 환경이라 전역 URL 이 node 의 것이 아니다 — indexHtmlSeo.test.ts 와 같은 방식으로 푼다.
const CONFIG_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../vite.config.ts');
const source = readFileSync(CONFIG_PATH, 'utf-8');

/** `build: { … }` 블록만 잘라 낸다 — server 나 test 블록의 같은 이름에 걸리지 않도록. */
function buildBlock(): string {
  const start = source.indexOf('\n  build: {');
  expect(start, 'vite.config.ts 에 build 블록이 없다').toBeGreaterThan(-1);
  const end = source.indexOf('\n  test: {', start);
  expect(end, 'vite.config.ts 에 test 블록이 없다 — 잘라 낼 끝을 못 찾았다').toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('vite 빌드 설정', () => {
  it('프로덕션 소스맵을 만들지 않는다 (ACTION-PLAN 1.5)', () => {
    const block = buildBlock();
    /*
     * `false` 와 `'hidden'` 둘 다 받는다. 감사가 막으려던 것은 **번들에 남는
     * //# sourceMappingURL 참조와 그것을 따라 공개되는 원문**이고, 'hidden' 은 맵을
     * 만들되 그 참조를 남기지 않으므로 목적을 만족한다(에러 리포터를 붙이면 그쪽으로 간다).
     * true 만이 금지다.
     */
    const match = block.match(/^\s*sourcemap:\s*(.+?),\s*$/m);
    expect(match, 'build.sourcemap 이 아예 없다 — vite 기본값은 false 지만 명시해야 한다').not.toBeNull();
    expect(['false', "'hidden'"]).toContain(match![1]);
  });

  it('벤더 청크 분리가 실제로 배선돼 있다', () => {
    const block = buildBlock();
    /*
     * vendorChunk 함수가 파일에 있는 것만으로는 아무 일도 일어나지 않는다. 회귀했을 때가
     * 정확히 그 상태였다 — 함수와 그 긴 주석은 그대로 남아 있고 연결만 빠져서, 파일을 읽은
     * 사람은 벤더가 갈리고 있다고 믿게 된다. 죽은 코드보다 나쁜 거짓말하는 코드다.
     */
    expect(source).toContain('function vendorChunk');
    expect(block).toMatch(/rollupOptions:\s*\{[\s\S]*?output:\s*\{[\s\S]*?manualChunks:\s*vendorChunk/);
  });

  it('청크 이름표(manifest)를 낸다 — /beta 프리렌더가 이것을 읽는다', () => {
    /*
     * 프리렌더는 랜딩 청크의 CSS·modulepreload 를 정적 HTML 에 써 넣어야 하는데 파일 이름에
     * 콘텐츠 해시가 박혀 있다. manifest 가 없으면 dist/assets 를 이름으로 짐작하게 되고,
     * 위 manualChunks 가 어떻게 가르느냐에 따라 조용히 틀린 파일을 링크한다.
     */
    expect(buildBlock()).toMatch(/^\s*manifest:\s*true,\s*$/m);
  });
});
