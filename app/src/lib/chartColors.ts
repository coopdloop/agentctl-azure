// Categorical slots from the validated reference palette (fixed order, never cycled).
// Light and dark are separately selected steps of the same hues.
const LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

export function categorical(dark: boolean): string[] {
  return dark ? DARK : LIGHT;
}

/** Color follows the entity: the same agent keeps its slot regardless of rank or filter. */
export function colorForEntity(entities: string[], name: string, dark: boolean): string {
  const slots = categorical(dark);
  const i = [...entities].sort().indexOf(name);
  return i >= 0 && i < slots.length ? slots[i] : dark ? "#8a8984" : "#8a8984";
}

export const chartInk = (dark: boolean) => ({
  grid: dark ? "#3a3a38" : "#e6e5e1",
  axis: dark ? "#a7a69e" : "#6b6a65",
  surface: dark ? "#292929" : "#ffffff",
  tooltipBg: dark ? "#1f1f1f" : "#ffffff",
  tooltipBorder: dark ? "#3a3a38" : "#e0dfdb",
  text: dark ? "#f0efec" : "#242424",
});
