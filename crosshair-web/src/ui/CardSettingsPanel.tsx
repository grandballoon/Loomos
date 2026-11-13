import { matchPreset, NOTEBOOK_PRESETS, PRINTER_PRESETS, type Size, type SizePreset } from "../core/cards";
import { UNITS, type Unit } from "../core/lengths";
import type { CardFeatures, CardSettings } from "../state";
import { ColorField, LengthField, SelectField, ToggleField } from "./fields";

/** A named size (preset select) with editable width and height. */
function SizeFields(props: {
  presets: SizePreset[];
  size: Size;
  unit: Unit;
  onChange: (size: Size) => void;
}) {
  const active = matchPreset(props.presets, props.size);
  return (
    <>
      <SelectField
        label="Size"
        value={active?.name ?? "custom"}
        options={[
          ...props.presets.map((preset) => ({ value: preset.name, label: preset.label })),
          { value: "custom", label: "Custom" },
        ]}
        onChange={(name) => {
          const preset = props.presets.find((p) => p.name === name);
          if (preset) props.onChange(preset.size);
        }}
      />
      <LengthField
        label="Width"
        points={props.size.w}
        unit={props.unit}
        min={0.01}
        onChange={(w) => props.onChange({ ...props.size, w })}
      />
      <LengthField
        label="Height"
        points={props.size.h}
        unit={props.unit}
        min={0.01}
        onChange={(h) => props.onChange({ ...props.size, h })}
      />
    </>
  );
}

export function CardSettingsPanel(props: {
  settings: CardSettings;
  onChange: (settings: CardSettings) => void;
}) {
  const { settings } = props;
  const set = (patch: Partial<CardSettings>) => props.onChange({ ...settings, ...patch });
  const setFeature = (patch: Partial<CardFeatures>) =>
    set({ features: { ...settings.features, ...patch } });

  return (
    <div className="settings">
      <section className="settings-section">
        <h2 className="section-title">Notebook page</h2>
        <SizeFields
          presets={NOTEBOOK_PRESETS}
          size={settings.notebook}
          unit={settings.unit}
          onChange={(notebook) => set({ notebook })}
        />
        <SelectField
          label="Unit"
          value={settings.unit}
          options={UNITS.map((unit) => ({ value: unit as Unit, label: unit }))}
          onChange={(unit) => set({ unit })}
        />
        <p className="section-note">
          Each card is cut to exactly this size and turned to match its image.
        </p>
      </section>

      <section className="settings-section">
        <h2 className="section-title">Printer paper</h2>
        <SizeFields
          presets={PRINTER_PRESETS}
          size={settings.sheet}
          unit={settings.unit}
          onChange={(sheet) => set({ sheet })}
        />
        <LengthField
          label="Printer margin"
          points={settings.margin}
          unit={settings.unit}
          onChange={(margin) => set({ margin })}
        />
      </section>

      <section className="settings-section">
        <h2 className="section-title">Features</h2>
        <ToggleField
          label="X crosshair (corner to corner)"
          checked={settings.features.cornerX}
          onChange={(cornerX) => setFeature({ cornerX })}
        />
        <ToggleField
          label="T crosshair (top to bottom)"
          checked={settings.features.crosshair}
          onChange={(crosshair) => setFeature({ crosshair })}
        />
        <ToggleField
          label="Grid"
          checked={settings.features.grid}
          onChange={(grid) => setFeature({ grid })}
        />
        {settings.features.grid && (
          <LengthField
            label="Grid spacing"
            points={settings.gridSpacing}
            unit={settings.unit}
            min={0.01}
            onChange={(gridSpacing) => set({ gridSpacing })}
          />
        )}
        <ToggleField
          label="Paper flip tab"
          checked={settings.features.flipTab}
          onChange={(flipTab) => setFeature({ flipTab })}
        />
        {settings.features.flipTab && (
          <LengthField
            label="Tab height"
            points={settings.tabHeight}
            unit={settings.unit}
            min={0.01}
            onChange={(tabHeight) => set({ tabHeight })}
          />
        )}
        <p className="section-note">
          Guides follow the notebook page (its corners and centre) and are drawn where they cross
          the art. The flip tab adds a strip below the art, folded on the inner dotted line.
        </p>
      </section>

      <section className="settings-section">
        <h2 className="section-title">Card</h2>
        <LengthField
          label="Padding"
          points={settings.padding}
          unit={settings.unit}
          onChange={(padding) => set({ padding })}
        />
        <ToggleField
          label="Crop to fill card"
          checked={settings.fill}
          onChange={(fill) => set({ fill })}
        />
        <ColorField
          label="Guide color"
          value={settings.guideColor}
          onChange={(guideColor) => set({ guideColor })}
        />
        <LengthField
          label="Guide thickness"
          points={settings.guideThickness}
          unit="pt"
          onChange={(guideThickness) => set({ guideThickness })}
        />
      </section>
    </div>
  );
}
