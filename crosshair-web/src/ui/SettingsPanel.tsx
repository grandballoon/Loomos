import { EFFECT_KINDS, EFFECT_LABELS, type EffectKind } from "../core/effects";
import { SHEETS_PER_SIGNATURE } from "../core/imposition";
import { UNITS, type Unit } from "../core/lengths";
import { PAGE_PRESETS, type Settings } from "../state";
import { LengthField, SelectField, ToggleField } from "./fields";

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const channel = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

export function SettingsPanel(props: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}) {
  const { settings } = props;
  const set = (patch: Partial<Settings>) => props.onChange({ ...settings, ...patch });
  const setEffect = (patch: Partial<Settings["effectSettings"]>) =>
    set({ effectSettings: { ...settings.effectSettings, ...patch } });

  const activePreset = PAGE_PRESETS.find(
    (preset) =>
      Math.abs(preset.sheetW - settings.sheetW) < 0.5 &&
      Math.abs(preset.sheetH - settings.sheetH) < 0.5,
  );

  return (
    <div className="settings">
      <section className="settings-section">
        <h2 className="section-title">Page</h2>
        <SelectField
          label="Preset"
          value={activePreset?.name ?? "custom"}
          options={[
            ...PAGE_PRESETS.map((preset) => ({ value: preset.name, label: preset.label })),
            { value: "custom", label: "Custom" },
          ]}
          onChange={(name) => {
            const preset = PAGE_PRESETS.find((p) => p.name === name);
            if (preset) set({ sheetW: preset.sheetW, sheetH: preset.sheetH });
          }}
        />
        <SelectField
          label="Unit"
          value={settings.unit}
          options={UNITS.map((unit) => ({ value: unit as Unit, label: unit }))}
          onChange={(unit) => set({ unit })}
        />
        <LengthField
          label="Print width"
          points={settings.sheetW}
          unit={settings.unit}
          min={1}
          onChange={(sheetW) => set({ sheetW })}
        />
        <LengthField
          label="Print height"
          points={settings.sheetH}
          unit={settings.unit}
          min={1}
          onChange={(sheetH) => set({ sheetH })}
        />
        <p className="section-note">
          Each printed page folds once into two book pages
          {activePreset ? ` (${activePreset.leafLabel})` : ""}.
        </p>
      </section>

      <section className="settings-section">
        <h2 className="section-title">Binding</h2>
        <p className="section-note">
          Bound in signatures of {SHEETS_PER_SIGNATURE} sheets, padded with blank pages.
        </p>
        <LengthField
          label="Margin"
          points={settings.margin}
          unit={settings.unit}
          onChange={(margin) => set({ margin })}
        />
        <LengthField
          label="Gutter (spine)"
          points={settings.gutter}
          unit={settings.unit}
          onChange={(gutter) => set({ gutter })}
        />
        <ToggleField
          label="Facing guide pages"
          checked={settings.facingPages}
          onChange={(facingPages) => set({ facingPages })}
        />
        {settings.facingPages && (
          <SelectField
            label="Image side"
            value={settings.imageSide}
            options={[
              { value: "left", label: "Left (draw on right)" },
              { value: "right", label: "Right (draw on left)" },
            ]}
            onChange={(imageSide) => set({ imageSide })}
          />
        )}
        <label className="field">
          <span className="field-label">Title</span>
          <span className="field-input">
            <input
              type="text"
              value={settings.title}
              onChange={(event) => set({ title: event.target.value })}
            />
          </span>
        </label>
      </section>

      <section className="settings-section">
        <h2 className="section-title">Effects</h2>
        <SelectField
          label="Default effect"
          value={settings.defaultEffect}
          options={EFFECT_KINDS.map((kind: EffectKind) => ({
            value: kind,
            label: EFFECT_LABELS[kind],
          }))}
          onChange={(defaultEffect) => set({ defaultEffect })}
        />
        <label className="field">
          <span className="field-label">Color</span>
          <span className="field-input">
            <input
              type="color"
              value={rgbToHex(settings.effectSettings.color)}
              onChange={(event) => setEffect({ color: hexToRgb(event.target.value) })}
            />
          </span>
        </label>
        <LengthField
          label="Line thickness"
          points={settings.effectSettings.thickness}
          unit="pt"
          onChange={(thickness) => setEffect({ thickness })}
        />
        <ToggleField
          label="Border"
          checked={settings.effectSettings.border}
          onChange={(border) => setEffect({ border })}
        />
        <LengthField
          label="Center gap"
          points={settings.effectSettings.crosshairGap}
          unit={settings.unit}
          onChange={(crosshairGap) => setEffect({ crosshairGap })}
        />
        <LengthField
          label="Grid spacing"
          points={settings.effectSettings.gridSpacing}
          unit={settings.unit}
          onChange={(gridSpacing) => setEffect({ gridSpacing })}
        />
        <LengthField
          label="Dot pitch"
          points={settings.effectSettings.dotPitch}
          unit={settings.unit}
          onChange={(dotPitch) => setEffect({ dotPitch })}
        />
        <LengthField
          label="Dot size"
          points={settings.effectSettings.dotDiameter}
          unit="pt"
          onChange={(dotDiameter) => setEffect({ dotDiameter })}
        />
      </section>
    </div>
  );
}
