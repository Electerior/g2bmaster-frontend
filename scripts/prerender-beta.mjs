/*
 * /beta 프리렌더 — `npm run build` 의 마지막 단계.
 *
 * 하는 일은 넷이다.
 *   1. src/features/beta/prerender.tsx 만 따로 SSR 로 묶는다(vite 의 build API).
 *   2. 그것을 node 에서 불러 랜딩을 문자열로 그린다(react-dom/server).
 *   3. 방금 나온 dist/index.html 을 셸로 삼아 <head> 메타를 /beta 것으로 갈아 끼우고
 *      <body> 에 그 문자열을 채운다(buildBetaDocument).
 *   4. dist/beta.html 로 쓴다.
 *
 * ── 왜 별도 스크립트인가, vite 플러그인이 아니라 ────────────────────────────
 * 이 단계는 클라이언트 빌드가 **끝난 뒤에** 그 산출물(dist/index.html · manifest)을 읽어야
 * 한다. 플러그인 안(closeBundle)에서 하면 그 안에서 다시 vite build 를 부르게 되고, 그
 * 중첩 빌드가 같은 설정 파일을 읽어 같은 플러그인을 또 달게 된다 — 재귀를 막는 플래그를
 * 손으로 관리해야 한다. 빌드 파이프라인의 한 줄로 보이는 편이 고장 났을 때도 읽기 쉽다.
 *
 * ── 산출 위치가 왜 dist/beta.html 인가 ──────────────────────────────────────
 * dist/beta/index.html 로 내면 nginx 의 `try_files $uri $uri/` 가 디렉터리를 집어 `/beta/`
 * 를 서빙하게 되고, 그러면 canonical 에 적은 `/beta` 와 실제 주소가 어긋난다.
 * dist/beta.html 은 nginx 쪽에 `$uri.html` 한 조각을 요구한다 — **그 변경 없이는 이
 * 파일이 서빙되지 않는다.** 배포 전에 반드시 읽을 것: docs/beta-prerender.md.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = path.join(ROOT, 'dist');

/**
 * SSR 번들이 나가는 곳. dist 밖이어야 한다 — 배포되는 디렉터리에 서버 전용 번들을 떨어뜨리면
 * 그대로 공개된다. node_modules 아래는 이미 .gitignore 안이고 clean 대상이다.
 */
const SSR_OUT = path.join(ROOT, 'node_modules', '.g2b-prerender');

/** main.tsx 가 동적 import 하는 모듈. manifest 에서 이 키로 청크를 찾는다. */
const BETA_ENTRY_ID = 'src/features/beta/standalone.tsx';

/**
 * manifest 를 따라가며 청크 하나가 필요로 하는 것을 전부 모은다.
 *
 * 한 단계만 보면 안 된다. 랜딩 청크는 다시 공용 청크(vendor-react 등)를 import 하고,
 * CSS 도 자기 자신이 아니라 그 아래 청크에 붙어 있을 수 있다 — 어떻게 갈리는지는
 * rollup 이 정하고, manualChunks 설정이 바뀌면 같이 바뀐다. 그래서 재귀로 훑는다.
 */
function collectChunk(manifest, id, seen = new Set(), js = [], css = []) {
  if (seen.has(id)) return { js, css };
  seen.add(id);

  const chunk = manifest[id];
  if (!chunk) throw new Error(`[prerender:/beta] manifest 에 ${id} 가 없습니다.`);

  js.push(chunk.file);
  for (const file of chunk.css ?? []) css.push(file);
  for (const next of chunk.imports ?? []) collectChunk(manifest, next, seen, js, css);

  return { js, css };
}

async function main() {
  /*
   * 1) SSR 번들.
   *
   * configFile 은 그대로 둔다(기본값). 별칭(@/)·JSX 변환·환경변수 치환이 앱 빌드와 한
   * 글자도 다르면 안 되기 때문이다 — 다르면 서버가 그린 마크업과 브라우저가 그린 것이
   * 미묘하게 갈라지고, 그 차이는 이어받기가 실패하는 형태로만 드러난다.
   *
   * 의존성(react-dom/server · @tanstack/react-query · axios)은 vite 가 기본값대로 외부화
   * 하므로 번들에 들어가지 않고 node 가 node_modules 에서 그대로 읽는다.
   */
  await build({
    root: ROOT,
    logLevel: 'warn',
    build: {
      ssr: path.join('src', 'features', 'beta', 'prerender.tsx'),
      outDir: path.relative(ROOT, SSR_OUT),
      emptyOutDir: true,
      minify: false,
      sourcemap: false,
      // 이름을 고정해야 아래에서 import 할 수 있다. 서버 전용이라 해시가 필요 없다.
      rollupOptions: { output: { entryFileNames: 'beta-prerender.mjs', chunkFileNames: '[name].mjs' } },
    },
  });

  const entry = pathToFileURL(path.join(SSR_OUT, 'beta-prerender.mjs')).href;
  const { renderBetaBody, buildBetaDocument, countVisibleWords, BETA_SCHEMA_SCRIPT } =
    await import(entry);

  // 2) 본문.
  const body = renderBetaBody();

  // 3) 셸 + manifest.
  const shellPath = path.join(DIST, 'index.html');
  const manifestPath = path.join(DIST, '.vite', 'manifest.json');
  const shell = await readFile(shellPath, 'utf8');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  const { js, css } = collectChunk(manifest, BETA_ENTRY_ID);
  if (css.length === 0) {
    throw new Error(
      '[prerender:/beta] 랜딩 청크에 CSS 가 하나도 없습니다. landing.css 가 다른 청크로 옮겨 갔다면 ' +
        'BETA_ENTRY_ID 를 그 모듈로 바꾸세요. CSS 없이 내보내면 첫 화면이 스타일 없는 HTML 로 그려집니다.',
    );
  }

  /*
   * <head> 에 덧붙일 것들.
   *
   *  - stylesheet: 랜딩 CSS 는 코드 스플릿 이후 JS 가 청크를 받을 때 함께 오도록 돼 있다.
   *    미리 그린 HTML 은 그때까지 스타일 없이 떠 있게 되므로 여기서 직접 링크한다.
   *    이게 없으면 프리렌더는 LCP 를 고치는 게 아니라 "스타일 없는 첫 그림"을 하나 더
   *    만드는 일이 된다.
   *  - modulepreload: main.tsx 가 이어받기 전에 받아야 하는 청크들. 링크가 없으면
   *    진입 번들이 파싱된 뒤에야 요청이 나가 왕복이 직렬로 붙는다.
   *
   * 셸이 이미 걸어 둔 파일(진입 청크와 그 CSS)은 뺀다. 브라우저가 같은 주소를 두 번
   * 받지는 않지만, 같은 링크가 두 줄 있는 문서는 다음 사람에게 "왜 둘이지"를 묻게 한다.
   */
  const alreadyInShell = (file) => shell.includes(`/${file}`);

  /*
   * 라우트별 JSON-LD(@/seo/routeSchema). 셸의 정적 그래프는 모든 주소에서 참인 것만 담고
   * 있어서 "이 문서가 무엇인지"는 아무 데도 없다 — 그 문장을 말할 수 있는 유일한 자리가
   * 주소를 아는 곳이고, /beta 에서는 브라우저가 아니라 **여기**다. 훅은 JS 가 돌아야
   * 도는데 이 페이지를 읽는 크롤러는 대개 그 전에 head 를 읽고 만다.
   *
   * 없으면 던진다. 조용히 빠지면 dist/beta.html 은 멀쩡해 보이고 노드만 사라지는데,
   * 그 종류의 결함이 감사가 나올 때까지 발견되지 않았던 것이다.
   */
  if (!BETA_SCHEMA_SCRIPT) {
    throw new Error(
      '[prerender:/beta] /beta 의 라우트별 JSON-LD 가 비어 있습니다. src/seo/routeSchema.ts 의 ' +
        'isSchemaRoute 가 /beta 를 제외했거나 ROUTE_META 에서 빠졌는지 확인하세요.',
    );
  }

  const headExtras = [
    ...css.filter((file) => !alreadyInShell(file)).map((file) => `<link rel="stylesheet" href="/${file}" />`),
    ...js
      .filter((file) => !alreadyInShell(file))
      .map((file) => `<link rel="modulepreload" crossorigin href="/${file}" />`),
    BETA_SCHEMA_SCRIPT,
  ];

  const html = buildBetaDocument({ shell, body, headExtras });
  const outPath = path.join(DIST, 'beta.html');
  await writeFile(outPath, html, 'utf8');

  /*
   * 4) 뒷정리. manifest 는 이 단계를 위해 켠 것이고 배포물에 남길 이유가 없다.
   *    SSR 번들도 서버 전용이라 dist 밖에 있지만 남겨 둘 이유가 없다.
   */
  await rm(path.join(DIST, '.vite'), { recursive: true, force: true });
  await rm(SSR_OUT, { recursive: true, force: true });

  /*
   * 마지막 한 줄이 이 단계의 계기판이다. 감사가 잡은 목표치(약 1,500 단어)에 얼마나
   * 닿았는지, 셸(5,851 B / 0 단어)과 견줘 무엇이 달라졌는지를 매 빌드마다 눈으로 본다.
   * 회귀를 실제로 막는 것은 src/test/betaPrerender.test.ts 이고, 세는 규칙은 같은 함수다.
   */
  const bodyOf = (doc) => doc.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? '';
  console.log(
    `[prerender:/beta] dist/beta.html — ${Buffer.byteLength(html, 'utf8').toLocaleString()} B / ` +
      `본문 ${countVisibleWords(bodyOf(html)).toLocaleString()} 단어 ` +
      `(셸 dist/index.html — ${Buffer.byteLength(shell, 'utf8').toLocaleString()} B / ` +
      `본문 ${countVisibleWords(bodyOf(shell))} 단어)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
