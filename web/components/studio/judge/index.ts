// Barrel file for the Judge Panel (Step-2 tribunal) components.
// Re-exports every public symbol so StepJudge can import from
// "@/components/studio/judge".

export { OutcomesChart } from './OutcomesChart';

export { EditableOptionCard } from './EditableOptionCard';

export { RoundHeader } from './RoundHeader';
export type { TribunalStatus } from './RoundHeader';

export { VerdictBar } from './VerdictBar';

export { ContestedStrip, extractContested } from './ContestedStrip';

export { TribunalPanelShell } from './TribunalPanelShell';
export type { PanelState, PanelAccent } from './TribunalPanelShell';

export { StreamCaret } from './StreamCaret';
export { useTypewriter } from './useTypewriter';
export type { TypewriterOptions } from './useTypewriter';

export { buildSeries } from './series';
export type { SeriesPoint, OptionSeries } from './series';
