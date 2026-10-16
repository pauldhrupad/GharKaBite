import { Check } from "lucide-react";

export default function ThaliChoiceGroup({ group, selected, onSelect, onClear, error }) {
  const min = group.minSelections ?? (group.required ? 1 : 0);
  const max = group.maxSelections ?? 1;
  const single = max === 1;
  const hintId = `choice-hint-${group.id}`;
  const errorId = `choice-error-${group.id}`;
  return <fieldset id={`choice-group-${group.id}`} tabIndex={-1} aria-invalid={Boolean(error)} aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`} className="thali-group">
    <legend>{group.name}</legend>
    <div id={hintId} className="thali-group-hint"><span className={min ? "thali-required" : ""}>{min ? "Required" : "Optional"}</span><span>{single ? min ? "Choose one" : "Choose up to one" : min === max ? `Choose ${min}` : `Choose ${min}–${max}`}</span><span>{selected.length} selected</span></div>
    {group.description && <p className="thali-group-description">{group.description}</p>}
    {error && <p id={errorId} className="thali-inline-error" role="alert">{error}</p>}
    <div className="thali-option-grid">{group.options.map((option) => {
      const checked = selected.includes(option.id);
      const unavailable = option.active === false;
      const atLimit = !single && selected.length >= max && !checked;
      return <label key={option.id} className={`thali-option ${checked ? "is-selected" : ""} ${unavailable || atLimit ? "is-disabled" : ""}`}>
        <input type={single ? "radio" : "checkbox"} name={`choice-${group.id}`} checked={checked} disabled={unavailable || atLimit} onChange={() => onSelect(group, option.id)} />
        <span className="thali-option-copy"><strong>{option.name}</strong>{option.description && <small>{option.description}</small>}<small>{unavailable ? "Unavailable" : atLimit ? "Selection limit reached" : option.priceAdjustment ? `+₹${option.priceAdjustment} per meal` : "Included"}</small></span>
        <span className="thali-option-check" aria-hidden="true">{checked && <Check />}</span>
      </label>;
    })}</div>
    {single && min === 0 && selected.length > 0 && <button type="button" onClick={() => onClear(group.id)} className="thali-text-action">Clear this choice</button>}
  </fieldset>;
}
