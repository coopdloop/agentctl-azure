import { Badge, Button, Input, makeStyles, tokens } from "@fluentui/react-components";
import { Dismiss12Regular } from "@fluentui/react-icons";
import { useState } from "react";

const useStyles = makeStyles({
  wrap: { display: "flex", flexDirection: "column", gap: "6px" },
  chips: { display: "flex", gap: "4px", flexWrap: "wrap" },
  chip: { display: "inline-flex", alignItems: "center", gap: "2px" },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px 16px" },
  hint: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
});

/** Free-text list input: Enter or comma adds an item. */
export function TagInput({ value, onChange, placeholder, validate }: { value: string[]; onChange(v: string[]): void; placeholder?: string; validate?: (v: string) => string | null }) {
  const s = useStyles();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const add = () => {
    const items = text.split(",").map((x) => x.trim()).filter(Boolean);
    for (const it of items) {
      const e = validate?.(it);
      if (e) return setErr(e);
    }
    setErr(null);
    onChange([...new Set([...value, ...items])]);
    setText("");
  };
  return (
    <div className={s.wrap}>
      <Input
        value={text}
        placeholder={placeholder ?? "Type and press Enter"}
        onChange={(_, d) => setText(d.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={() => text && add()}
      />
      {err && <span style={{ color: tokens.colorPaletteRedForeground1, fontSize: 12 }}>{err}</span>}
      {value.length > 0 && (
        <div className={s.chips}>
          {value.map((v) => (
            <Badge key={v} appearance="tint" className={s.chip}>
              {v}
              <Button
                size="small"
                appearance="transparent"
                icon={<Dismiss12Regular />}
                aria-label={`Remove ${v}`}
                onClick={() => onChange(value.filter((x) => x !== v))}
                style={{ minWidth: 0, padding: 0, height: 16 }}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function Grid2({ children }: { children: React.ReactNode }) {
  return <div className={useStyles().grid2}>{children}</div>;
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <span className={useStyles().hint}>{children}</span>;
}
