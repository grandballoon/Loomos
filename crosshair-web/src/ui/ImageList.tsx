import { EFFECT_KINDS, EFFECT_LABELS } from "../core/effects";
import type { EffectKind } from "../core/effects";
import type { ImageItem } from "../state";

export function ImageList(props: {
  items: ImageItem[];
  onEffectChange: (index: number, effect: EffectKind) => void;
  onMove: (index: number, delta: -1 | 1) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <ol className="image-list">
      {props.items.map((item, index) => (
        <li className="image-row" key={item.source.id}>
          <span className="image-ordinal">{String(index + 1).padStart(2, "0")}</span>
          <img className="image-thumb" src={item.source.url} alt={item.source.name} />
          <span className="image-meta">
            <span className="image-name" title={item.source.name}>
              {item.source.name}
            </span>
            <span className="image-dims">
              {item.source.width}×{item.source.height}px
            </span>
          </span>
          <select
            className="image-effect"
            value={item.effect}
            aria-label={`Effect for ${item.source.name}`}
            onChange={(event) => props.onEffectChange(index, event.target.value as EffectKind)}
          >
            {EFFECT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {EFFECT_LABELS[kind]}
              </option>
            ))}
          </select>
          <span className="image-actions">
            <button
              type="button"
              aria-label={`Move ${item.source.name} up`}
              disabled={index === 0}
              onClick={() => props.onMove(index, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Move ${item.source.name} down`}
              disabled={index === props.items.length - 1}
              onClick={() => props.onMove(index, 1)}
            >
              ↓
            </button>
            <button
              type="button"
              className="remove"
              aria-label={`Remove ${item.source.name}`}
              onClick={() => props.onRemove(index)}
            >
              ×
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}
