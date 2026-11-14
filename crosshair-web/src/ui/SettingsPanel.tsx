import { EFFECT_KINDS, EFFECT_LABELS, type EffectKind } from "../core/effects";
import { BINDING_INFO, BINDING_METHODS, gutterForBinding } from "../core/binding";
import { UNITS, type Unit } from "../core/lengths";
import { PAGE_PRESETS, type Settings } from "../state";
import { ColorField, LengthField, SelectField, ToggleField } from "./fields";

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
        <SelectField
          label="Method"
          value={settings.binding}
          options={BINDING_METHODS.map((method) => ({
            value: method,
            label: BINDING_INFO[method].label,
          }))}
          onChange={(binding) =>
            set({ binding, gutter: gutterForBinding(binding, settings.gutter) })
          }
        />
        <p className="section-note">
          {BINDING_INFO[settings.binding].summary} Padded with blank pages to fill the last
          signature.
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
        <ColorField
          label="Color"
          value={settings.effectSettings.color}
          onChange={(color) => setEffect({ color })}
        />
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
