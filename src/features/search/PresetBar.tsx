/*
 * 즐겨찾기 프리셋 바 — 원본 renderPresets/saveCurrentAsPreset/applyPreset/deletePreset
 * (app.js:976~1041). 저장소는 localStorage['g2b_presets'] 그대로 이어받는다.
 *
 * 원본 프리셋에는 `id: Date.now()` 가 있었지만 domain/storage.ts 의 SearchPreset 에는 없다.
 * 이름이 겹칠 수 있으므로 목록 안 위치(index)를 키로 쓴다 — 같은 배열을 그대로 다시 쓰는
 * 화면이라 위치가 곧 신원이다.
 */
import { useCallback, useState } from 'react';
import { loadPresets, savePresets, type SearchPreset } from '@/domain/storage';
import './search.css';

interface PresetBarProps {
  andTerms: readonly string[];
  orTerms: readonly string[];
  notTerms: readonly string[];
  /** 프리셋을 눌렀을 때 — 키워드 세 줄을 갈아 끼우고 검색한다. */
  onApply: (preset: SearchPreset) => void;
}

export function PresetBar({ andTerms, orTerms, notTerms, onApply }: PresetBarProps) {
  // localStorage 는 렌더 중에 읽어도 되지만 값이 바뀌면 다시 그려야 하므로 state 로 든다.
  const [presets, setPresets] = useState<SearchPreset[]>(() => loadPresets());
  const hasTerms = andTerms.length > 0 || orTerms.length > 0 || notTerms.length > 0;

  const persist = useCallback((next: SearchPreset[]) => {
    savePresets(next);
    setPresets(next);
  }, []);

  const handleSave = () => {
    if (!hasTerms) {
      window.alert('저장할 키워드가 없습니다. AND/OR/NOT에 키워드를 먼저 입력하세요.');
      return;
    }
    const name = window.prompt('즐겨찾기 이름을 입력하세요:', andTerms[0] || orTerms[0] || '');
    if (!name) return;
    persist([
      ...presets,
      {
        name: name.trim(),
        andTerms: [...andTerms],
        orTerms: [...orTerms],
        notTerms: [...notTerms],
      },
    ]);
  };

  return (
    <div className="preset-bar-wrap">
      <span className="preset-label">즐겨찾기</span>
      <div className="preset-bar">
        {presets.length === 0 ? (
          <span className="preset-empty">키워드 입력 후 ★ 저장하면 여기에 나타납니다</span>
        ) : (
          presets.map((preset, index) => (
            <span key={`${preset.name}-${index}`} className="preset-chip">
              <button
                type="button"
                className="preset-chip-open"
                title="클릭하면 이 키워드로 검색"
                onClick={() => onApply(preset)}
              >
                <span className="preset-chip-name">{preset.name}</span>
                <span className="preset-chip-tags">
                  {/* AND 는 그대로, OR 은 흐리게 — 원본은 opacity:.6 인라인이었다. */}
                  {[
                    ...(preset.andTerms ?? []).map((t) => ({ text: t, weak: false })),
                    ...(preset.orTerms ?? []).map((t) => ({ text: t, weak: true })),
                  ].map((tag, i, all) => (
                    <span key={`${tag.text}-${i}`} className={tag.weak ? 'weak' : undefined}>
                      {tag.text}
                      {i < all.length - 1 ? ' · ' : ''}
                    </span>
                  ))}
                </span>
              </button>
              <button
                type="button"
                className="preset-del"
                title="삭제"
                aria-label={`${preset.name} 삭제`}
                onClick={() => persist(presets.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      <button
        type="button"
        className="btn-save-preset"
        disabled={!hasTerms}
        title={hasTerms ? '현재 검색 키워드를 즐겨찾기에 저장' : '먼저 키워드를 입력하세요'}
        onClick={handleSave}
      >
        ★ 현재 키워드 저장
      </button>
    </div>
  );
}
