import { useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  FileUp,
  FileText,
  Factory,
  Gauge,
  Menu,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";

type DatasetMode = "demo" | "imported";
type Shift = "All shifts" | "Morning" | "Afternoon" | "Night";
type ImportedRow = Record<string, string>;

type Metrics = {
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  downtime: number;
  records: number;
};

const demoMetrics: Metrics = { oee: 40.4, availability: 64.0, performance: 64.0, quality: 98.5, downtime: 418, records: 184 };
const demoTrend = [
  { day: "Aug 29", oee: 37.8, availability: 61.2, performance: 61.8 },
  { day: "Aug 30", oee: 39.4, availability: 63.4, performance: 62.9 },
  { day: "Aug 31", oee: 42.8, availability: 66.9, performance: 65.0 },
  { day: "Sep 01", oee: 39.2, availability: 62.2, performance: 64.0 },
  { day: "Sep 02", oee: 41.6, availability: 65.8, performance: 63.5 },
  { day: "Sep 03", oee: 40.4, availability: 64.0, performance: 64.0 },
];
const demoPareto = [
  { cause: "Supply delay", minutes: 148, share: 35 },
  { cause: "Micro stops", minutes: 106, share: 60 },
  { cause: "Changeover", minutes: 76, share: 78 },
  { cause: "Breakdown", minutes: 54, share: 91 },
  { cause: "Quality hold", minutes: 34, share: 100 },
];
const demoShifts = [
  { shift: "Morning", oee: 46.2, availability: 71.8, performance: 72.3, note: "Best line stability" },
  { shift: "Afternoon", oee: 39.7, availability: 63.1, performance: 67.0, note: "Speed loss" },
  { shift: "Night", oee: 34.4, availability: 57.0, performance: 66.5, note: "Downtime exposure" },
];

const fallbackCauses = ["Equipment loss", "Process loss", "Material loss", "Quality loss", "Other loss"];

function number(value: number, digits = 1) {
  return value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
function pct(value: number) { return `${number(value)}%`; }
function csvParse(text: string): ImportedRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const parseLine = (line: string) => {
    const cells: string[] = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { cell += '"'; i += 1; } else quoted = !quoted;
      } else if (char === "," && !quoted) { cells.push(cell.trim()); cell = ""; } else cell += char;
    }
    cells.push(cell.trim());
    return cells;
  };
  const headers = parseLine(lines[0]).map((header) => header.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return lines.slice(1).map((line) => parseLine(line)).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}
function avg(rows: ImportedRow[], key: string) {
  const values = rows.map((row) => Number(row[key])).filter(Number.isFinite);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
function metricFromRows(rows: ImportedRow[]): Metrics {
  const has = (key: string) => rows.some((row) => Number.isFinite(Number(row[key])));
  const availability = has("availability") ? avg(rows, "availability") : 100 - avg(rows, "downtime_percentage");
  const performance = has("performance") ? avg(rows, "performance") : avg(rows, "worker_productivity");
  const quality = has("quality") ? avg(rows, "quality") : rows.some((row) => row.quality_score) ? avg(rows, "quality_score") : Math.max(0, 100 - avg(rows, "defect_rate"));
  const downtime = rows.reduce((total, row) => total + (Number(row.downtime_minutes ?? row.downtime ?? 0) || 0), 0);
  return { availability: Math.max(0, Math.min(100, availability)), performance: Math.max(0, Math.min(100, performance)), quality: Math.max(0, Math.min(100, quality)), oee: Math.max(0, Math.min(100, (availability * performance * quality) / 10000)), downtime, records: rows.length };
}
function titleCase(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function MiniBadge({ children, tone = "lime" }: { children: React.ReactNode; tone?: "lime" | "orange" | "red" | "dark" }) {
  const styles = { lime: "bg-[#e6f3bc] text-[#607225]", orange: "bg-[#ffe5cd] text-[#ad6531]", red: "bg-[#ffe0dc] text-[#b34d40]", dark: "bg-[#d9eadc] text-[#23463a]" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${styles[tone]}`}>{children}</span>;
}

function MetricCard({ label, value, sub, icon: Icon, tone, trend }: { label: string; value: string; sub: string; icon: React.ElementType; tone: "lime" | "orange" | "red" | "dark"; trend?: string }) {
  const iconStyle = { lime: "bg-[#dff08a] text-[#5b6d20]", orange: "bg-[#ffd1a9] text-[#9b5d31]", red: "bg-[#ffc1b6] text-[#a84438]", dark: "bg-[#305447] text-[#d9ef81]" }[tone];
  return <article className="metric-card relative overflow-hidden rounded-[26px] bg-white p-5 shadow-[0_14px_38px_rgba(18,34,29,0.07)] ring-1 ring-black/[0.035]">
    <div className="flex items-start justify-between gap-4"><div><p className="mb-3 text-[10px] font-black uppercase tracking-[0.19em] text-[#859087]">{label}</p><div className="flex items-end gap-2"><strong className="font-display text-[36px] font-extrabold leading-none tracking-[-0.07em] text-[#16251f]">{value}</strong>{trend && <span className="mb-1 flex items-center text-[11px] font-black text-[#76902e]"><ArrowUpRight className="h-3.5 w-3.5" />{trend}</span>}</div><p className="mt-2 text-[11px] font-medium text-[#8b948d]">{sub}</p></div><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconStyle}`}><Icon className="h-[18px] w-[18px]" strokeWidth={2.3} /></div></div>
    <div className={`absolute -bottom-10 -right-5 h-24 w-24 rounded-full opacity-35 blur-2xl ${tone === "lime" ? "bg-[#c7dd54]" : tone === "orange" ? "bg-[#f4a56b]" : tone === "red" ? "bg-[#ef705f]" : "bg-[#5b987f]"}`} />
  </article>;
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-2xl bg-[#10231d] px-3 py-2.5 text-white shadow-xl"><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#b9ca9d]">{label}</p>{payload.map((item: any) => <p key={item.dataKey} className="text-xs font-bold">{titleCase(item.dataKey)} <span className="text-[#d9ef81]">{number(item.value)}%</span></p>)}</div>;
}

function LossTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-2xl bg-[#10231d] px-3 py-2.5 text-white shadow-xl"><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#b9ca9d]">{label}</p>{payload.map((item: any) => <p key={item.dataKey} className="text-xs font-bold">{item.dataKey === "share" ? "Cumulative" : "Minutes"} <span className="text-[#f4c18f]">{item.dataKey === "share" ? `${number(item.value)}%` : `${number(item.value)} min`}</span></p>)}</div>;
}

export default function Home() {
  const [mode, setMode] = useState<DatasetMode>("demo");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportedRow[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [shift, setShift] = useState<Shift>("All shifts");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("overview");
  const [helpTopic, setHelpTopic] = useState("");
  const [toast, setToast] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const metrics = useMemo(() => mode === "imported" ? metricFromRows(rows) : demoMetrics, [mode, rows]);
  const componentData = useMemo(() => [
    { component: "Availability", actual: metrics.availability, target: 90 },
    { component: "Performance", actual: metrics.performance, target: 95 },
    { component: "Quality", actual: metrics.quality, target: 99 },
  ], [metrics]);
  const importedQualityDataset = mode === "imported" && rows.some((row) => row.quality_score || row.defect_rate || row.defect_status);
  const trend = useMemo(() => {
    if (mode === "demo") return demoTrend;
    const base = metrics;
    return [
      { day: "Imported avg", oee: base.oee, availability: base.availability, performance: base.performance },
      { day: "Availability", oee: base.oee, availability: base.availability, performance: base.performance },
      { day: "Performance", oee: base.oee, availability: base.availability, performance: base.performance },
      { day: "Quality", oee: base.oee, availability: base.availability, performance: base.performance },
    ];
  }, [metrics, mode]);
  const pareto = useMemo(() => {
    if (mode === "demo") return demoPareto;
    const causeKey = ["defect_status", "downtime_cause", "downtime_type", "cause", "reason"].find((key) => rows.some((row) => row[key]));
    const grouped = new Map<string, number>();
    rows.forEach((row) => { const cause = causeKey ? row[causeKey] || "Unclassified" : (Number(row.defect_rate) > 2 ? "High defect rate" : "Within control"); const loss = Number(row.downtime_minutes ?? row.downtime ?? row.downtime_percentage ?? row.defect_rate ?? 1) || 1; grouped.set(cause, (grouped.get(cause) ?? 0) + loss); });
    const sorted = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const total = sorted.reduce((sum, [, value]) => sum + value, 0) || 1;
    let cumulative = 0;
    return sorted.map(([cause, value]) => { cumulative += value; return { cause: cause.length > 16 ? `${cause.slice(0, 15)}…` : cause, minutes: value, share: (cumulative / total) * 100 }; });
  }, [mode, rows]);
  const shifts = useMemo(() => mode === "demo" ? demoShifts : [
    { shift: "Imported avg", oee: metrics.oee, availability: metrics.availability, performance: metrics.performance, note: importedQualityDataset ? "Quality dataset mapped" : "Imported records" },
    { shift: "Quality view", oee: metrics.oee, availability: metrics.availability, performance: metrics.quality, note: "Quality score signal" },
    { shift: "Loss view", oee: metrics.oee, availability: 100 - metrics.downtime / Math.max(metrics.records, 1), performance: metrics.performance, note: "Downtime signal" },
  ], [importedQualityDataset, metrics, mode]);

  const visibleShifts = shift === "All shifts" ? shifts : shifts.filter((item) => item.shift === shift);
  const onFile = (file?: File) => {
    if (!file) return;
    setUploadError(""); setToast(""); setUploading(true); setFileName(file.name);
    window.setTimeout(() => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setUploading(false); setUploadError("This build accepts CSV files. Export the Excel sheet as CSV, then try again."); setMode("demo"); return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const parsed = csvParse(String(reader.result ?? ""));
        if (!parsed.length) { setUploading(false); setUploadError("No usable records found. Include a header row and at least one data row."); setMode("demo"); return; }
        setRows(parsed); setMode("imported"); setUploading(false); setToast(`${parsed.length.toLocaleString()} records mapped successfully`); setActiveNav("overview");
        window.setTimeout(() => setToast(""), 4500);
      };
      reader.onerror = () => { setUploading(false); setUploadError("The file could not be read. Please try a fresh CSV export."); setMode("demo"); };
      reader.readAsText(file);
    }, 240);
  };
  const explain = (topic: string) => setHelpTopic(topic);
  const exportReport = () => {
    const report = `OEE CONTROL ROOM\nDataset: ${mode === "demo" ? "Demo mode" : fileName}\nRecords: ${metrics.records}\nOEE: ${pct(metrics.oee)}\nAvailability: ${pct(metrics.availability)}\nPerformance: ${pct(metrics.performance)}\nQuality: ${pct(metrics.quality)}\nDowntime signal: ${number(metrics.downtime)}\n`;
    const blob = new Blob([report], { type: "text/plain" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "oee-control-room-report.txt"; link.click(); URL.revokeObjectURL(url); setToast("Snapshot exported"); window.setTimeout(() => setToast(""), 3000);
  };
  const exportMarkdownReport = () => {
    if (mode !== "imported") { setToast("Upload a CSV to create its report"); window.setTimeout(() => setToast(""), 3000); return; }
    const safeName = (fileName || "production-data").replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    const componentChart = [
      "```mermaid",
      "xychart-beta",
      "    title OEE component actuals vs targets",
      "    x-axis [Availability, Performance, Quality]",
      "    y-axis Percent 0 --> 100",
      `    bar [${metrics.availability.toFixed(1)}, ${metrics.performance.toFixed(1)}, ${metrics.quality.toFixed(1)}]`,
      "    line [90, 95, 99]",
      "```",
    ].join("\n");
    const causeLabels = pareto.map((item) => item.cause.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 12) || "Other").join(", ");
    const causeValues = pareto.map((item) => Math.round(item.minutes)).join(", ") || "0";
    const causeMax = Math.max(10, Math.ceil(Math.max(...pareto.map((item) => item.minutes), 10) / 10) * 10);
    const lossChart = [
      "```mermaid",
      "xychart-beta",
      "    title Top loss causes by minutes",
      `    x-axis [${causeLabels}]`,
      `    y-axis Minutes 0 --> ${causeMax}`,
      `    bar [${causeValues}]`,
      "```",
    ].join("\n");
    const causeRows = pareto.map((item) => `| ${item.cause} | ${number(item.minutes)} | ${number(item.share)}% |`).join("\n") || "| No mapped causes | 0.0 | 0.0% |";
    const priority = componentData.reduce((largest, item) => item.target - item.actual > largest.target - largest.actual ? item : largest, componentData[0]);
    const report = [
      `# ${fileName || "Production CSV"} — OEE report`,
      "",
      "Generated from the selected CSV in the OEE Dashboard. This report summarizes the calculated signals and includes Mermaid visuals that render in GitHub and compatible Markdown viewers.",
      "",
      "## Executive summary",
      "",
      "| Metric | Value |",
      "| --- | ---: |",
      `| Records analyzed | ${metrics.records.toLocaleString()} |`,
      `| OEE | ${pct(metrics.oee)} |`,
      `| Availability | ${pct(metrics.availability)} |`,
      `| Performance | ${pct(metrics.performance)} |`,
      `| Quality | ${pct(metrics.quality)} |`,
      `| Downtime signal | ${number(metrics.downtime)} |`,
      "| OEE target | 60.0% |",
      "",
      "## OEE component comparison",
      "",
      componentChart,
      "",
      "The bar series shows actual values. The line series shows the reference targets for availability, performance, and quality.",
      "",
      "## Downtime concentration",
      "",
      lossChart,
      "",
      "| Cause | Minutes | Cumulative share |",
      "| --- | ---: | ---: |",
      causeRows,
      "",
      "## Recommended focus",
      "",
      `The widest current component gap is **${priority.component}**. The leading visible loss cause is **${pareto[0]?.cause ?? "not mapped"}**.`,
      "",
      "## Source and method",
      "",
      `The report was generated in-browser from **${fileName || "the selected CSV"}**. OEE is calculated as availability × performance × quality. Loss causes are grouped from the first available cause field and ranked by the mapped downtime or loss signal.`,
    ].join("\n");
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${safeName || "production-data"}-oee-report.md`; link.click(); URL.revokeObjectURL(url); setToast("Markdown report created"); window.setTimeout(() => setToast(""), 3500);
  };

  const navItems = [{ id: "overview", label: "Overview", icon: Gauge }, { id: "losses", label: "Loss analysis", icon: BarChart3 }, { id: "components", label: "Component scorecard", icon: Activity }, { id: "crew", label: "Crew & shifts", icon: Users }];
  const sidebar = <aside className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-[#10231d] px-5 py-6 text-white shadow-2xl transition-transform duration-300 lg:relative lg:translate-x-0 lg:shadow-none ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
    <div className="mb-10 flex items-center justify-between"><div className="flex items-center gap-3"><div className="brand-mark flex h-10 w-10 items-center justify-center rounded-2xl bg-[#c7dd54] text-[#172b24]"><Factory className="h-5 w-5" /></div><div><p className="font-display text-[16px] font-extrabold tracking-[-0.04em]">Linewise</p><p className="text-[9px] font-bold uppercase tracking-[0.19em] text-[#9ead9f]">Operations intelligence</p></div></div><button onClick={() => setMobileOpen(false)} className="rounded-lg p-1 text-[#9ead9f] lg:hidden" aria-label="Close navigation"><X className="h-5 w-5" /></button></div>
    <div className="mb-4 px-3 text-[9px] font-black uppercase tracking-[0.21em] text-[#71857a]">Control room</div>
    <nav className="space-y-1">{navItems.map((item) => <button key={item.id} onClick={() => { setActiveNav(item.id); setMobileOpen(false); document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" }); }} className={`nav-item flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[12px] font-bold transition ${activeNav === item.id ? "bg-[#29483c] text-[#e4f38d]" : "text-[#a4b2a7] hover:bg-[#1c3930] hover:text-white"}`}><item.icon className="h-4 w-4" />{item.label}{activeNav === item.id && <ChevronRight className="ml-auto h-3.5 w-3.5" />}</button>)}</nav>
    <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.045] p-4"><div className="mb-3 flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-[#c7dd54]" /><span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#d9e5d1]">Shift lead view</span></div><p className="text-[11px] leading-relaxed text-[#8fa096]">Turn losses into a focused plan before the next review.</p><div className="mt-4 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-[#aabf62]"><ShieldCheck className="h-3.5 w-3.5" /> Review-ready</div></div>
  </aside>;

  return <div className="min-h-screen bg-[#f5f4ee] text-[#17251f]">
    <div className="flex min-h-screen">{sidebar}<div className={`fixed inset-0 z-40 bg-[#10231d]/45 backdrop-blur-sm lg:hidden ${mobileOpen ? "block" : "hidden"}`} onClick={() => setMobileOpen(false)} />
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-[#dfe5dc]/80 bg-[#f5f4ee]/88 px-5 py-4 backdrop-blur-xl sm:px-8 lg:px-10"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><button onClick={() => setMobileOpen(true)} className="rounded-xl bg-white p-2.5 text-[#263b32] shadow-sm lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#78847c]">Manufacturing / OEE control room</p><h1 className="mt-1 font-display text-[18px] font-extrabold tracking-[-0.045em] sm:text-[22px]">Performance cockpit</h1></div></div><div className="flex items-center gap-2"><div className="hidden items-center gap-2 rounded-full bg-white px-3 py-2 text-[10px] font-bold text-[#6b796f] shadow-sm md:flex"><span className="h-2 w-2 rounded-full bg-[#a9c947] shadow-[0_0_0_4px_rgba(169,201,71,0.14)]" />{mode === "demo" ? "Demo mode" : "Imported analysis"}<span className="text-[#b0b8b1]">/</span>{mode === "demo" ? "Aug 29–Sep 03" : fileName}</div><button onClick={exportReport} className="hidden items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.11em] text-[#647425] shadow-sm transition active:scale-[0.97] sm:flex"><Download className="h-3.5 w-3.5" /> Export snapshot</button><button onClick={exportMarkdownReport} disabled={mode !== "imported"} title={mode === "imported" ? "Download a Markdown report for this CSV" : "Upload a CSV to enable the report"} className="hidden items-center gap-2 rounded-xl bg-[#e6edcf] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.11em] text-[#5d7020] shadow-sm transition hover:bg-[#dce8bd] disabled:cursor-not-allowed disabled:opacity-45 sm:flex"><FileText className="h-3.5 w-3.5" /> CSV report</button><button onClick={() => inputRef.current?.click()} className="flex items-center gap-2 rounded-xl bg-[#12221d] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#dded84] shadow-[0_8px_20px_rgba(18,34,29,0.14)] transition active:scale-[0.97]"><UploadCloud className="h-3.5 w-3.5" /><span className="hidden sm:inline">Upload dataset</span></button><input ref={inputRef} className="hidden" aria-label="Upload CSV dataset" type="file" accept=".csv,text/csv" onChange={(event) => { onFile(event.target.files?.[0]); event.currentTarget.value = ""; }} /></div></div></header>
        <div className="mx-auto max-w-[1440px] px-5 pb-12 pt-8 sm:px-8 lg:px-10">
          <section id="overview" className="hero-grid mb-7 grid gap-5 xl:grid-cols-[1.48fr_0.82fr]"><div className="relative grid items-center gap-6 overflow-hidden rounded-[30px] bg-[#18382e] p-7 text-white shadow-[0_20px_55px_rgba(18,34,29,0.14)] sm:p-9 xl:grid-cols-[minmax(0,1fr)_286px]"><div className="hero-orb absolute -right-20 -top-28 h-80 w-80 rounded-full border-[36px] border-[#c7dd54]/15" /><div className="absolute -bottom-32 right-28 h-72 w-72 rounded-full bg-[#4b8b71]/20 blur-3xl" /><div className="relative z-10 max-w-xl xl:max-w-none"><div className="mb-7 flex flex-wrap items-center gap-2"><MiniBadge tone="lime">{mode === "demo" ? "Ready · demo data" : "Live · file loaded"}</MiniBadge><span className="text-[10px] font-bold text-[#b5c7bc]">{mode === "demo" ? "Use upload to make this your analysis" : `${metrics.records.toLocaleString()} records mapped`}</span></div><h2 className="font-display text-[36px] font-extrabold leading-[0.98] tracking-[-0.07em] sm:text-[50px]">Make every lost<br /><span className="text-[#d9ef81]">minute visible.</span></h2><p className="mt-5 max-w-md text-[13px] leading-relaxed text-[#b4c8bc]">A decision-first view of equipment effectiveness, downtime drivers, and the next improvement move.</p><div className="mt-8 flex flex-wrap items-center gap-3"><label className="group relative flex cursor-pointer items-center gap-2.5 overflow-hidden rounded-xl bg-[#c7dd54] px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#21362b] shadow-lg transition hover:-translate-y-0.5 active:scale-[0.97]">{uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}{uploading ? "Reading file…" : mode === "demo" ? "Load your production CSV" : "Replace dataset"}<input className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Load your production CSV" type="file" accept=".csv,text/csv" onChange={(event) => { onFile(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label><button onClick={() => document.getElementById("losses")?.scrollIntoView({ behavior: "smooth" })} className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#dce7dd] transition hover:bg-white/10 active:scale-[0.97]">Explore losses <ArrowDownRight className="h-3.5 w-3.5" /></button></div>{uploadError && <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#f4a56b]/30 bg-[#f4a56b]/10 p-3 text-[11px] leading-relaxed text-[#ffd3af]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{uploadError}</div>}</div><div className="relative z-10 grid w-full grid-cols-3 gap-2 xl:self-center"><div className="rounded-2xl bg-white/[0.07] p-3.5 backdrop-blur"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#9eb3a7]">OEE target</p><p className="mt-1 font-display text-2xl font-extrabold text-[#e5f291]">≥ 60%</p><p className="mt-1 text-[10px] text-[#9eb3a7]">World-class line</p></div><div className="rounded-2xl bg-white/[0.07] p-3.5 backdrop-blur"><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#9eb3a7]">Current</p><p className="mt-1 font-display text-2xl font-extrabold text-white">{number(metrics.oee)}%</p><p className="mt-1 text-[10px] text-[#9eb3a7]">Selected view</p></div><div className="rounded-2xl bg-[#f4a56b] p-3.5 text-[#4d3324]"><p className="text-[9px] font-bold uppercase tracking-[0.14em]">Opportunity</p><p className="mt-1 font-display text-2xl font-extrabold">{number(Math.max(0, 60 - metrics.oee))} pts</p><p className="mt-1 text-[10px] text-[#815738]">to target</p></div></div></div><div className="flex flex-col justify-between rounded-[30px] bg-[#e6edcf] p-6 shadow-[0_14px_38px_rgba(18,34,29,0.06)] sm:p-7"><div><div className="mb-5 flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#c8db76] text-[#35502f]"><Sparkles className="h-5 w-5" /></div><MiniBadge tone="dark">{mode === "demo" ? "Demo view" : "Validated"}</MiniBadge></div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#78864d]">Shift lead readout</p><h3 className="mt-2 font-display text-[25px] font-extrabold leading-tight tracking-[-0.055em] text-[#1c3528]">{mode === "demo" ? "Performance is the constraint." : importedQualityDataset ? "Quality is the constraint." : "Start with the loss tree."}</h3><p className="mt-3 text-[12px] leading-relaxed text-[#60705b]">{mode === "demo" ? "Availability and performance are both pulling OEE down. Use the Pareto to focus the next huddle." : importedQualityDataset ? "The imported quality signal is now visible. Use the loss view to prioritize defect reduction and downtime containment." : "Your file is mapped. The dashboard is ready to turn the dominant signal into a focused action."}</p></div><button onClick={() => explain("oee")} className="mt-8 flex items-center justify-between border-t border-[#c7d4aa] pt-4 text-left text-[10px] font-black uppercase tracking-[0.13em] text-[#5a6e30]">Why this matters <CircleHelp className="h-4 w-4" /></button></div></section>
          {toast && <div className="toast-in fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-[#12221d] px-4 py-3 text-[11px] font-bold text-[#e4f38d] shadow-2xl"><CheckCircle2 className="h-4 w-4" />{toast}</div>}
          <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Overall equipment effectiveness" value={pct(metrics.oee)} sub={mode === "demo" ? "Availability × performance × quality" : "Calculated from imported records"} icon={Gauge} tone="lime" trend={mode === "demo" ? "+2.4 pts" : "live"} /><MetricCard label="Availability" value={pct(metrics.availability)} sub={mode === "demo" ? "Lost to downtime & stops" : importedQualityDataset ? "100% − downtime percentage" : "Mapped from source"} icon={Activity} tone="orange" /><MetricCard label="Performance" value={pct(metrics.performance)} sub={mode === "demo" ? "Ideal cycle vs actual run" : importedQualityDataset ? "Worker productivity signal" : "Mapped from source"} icon={Zap} tone="red" /><MetricCard label="Quality" value={pct(metrics.quality)} sub={mode === "demo" ? "Good units / total units" : importedQualityDataset ? "Quality score / defect signal" : "Mapped from source"} icon={ShieldCheck} tone="dark" /></section>
          <section className="mb-7 grid gap-5 xl:grid-cols-[1.35fr_0.9fr]"><div className="panel rounded-[26px] bg-white p-5 shadow-[0_14px_38px_rgba(18,34,29,0.06)] sm:p-6"><div className="mb-6 flex items-start justify-between gap-3"><div><p className="section-kicker">Signal / 01</p><h3 className="font-display text-[21px] font-extrabold tracking-[-0.05em]">OEE trend & constraint signals</h3></div><button onClick={() => explain("oee")} className="rounded-xl bg-[#f0f3e8] p-2 text-[#81913e] transition hover:bg-[#e7edcf]" aria-label="Explain OEE trend"><CircleHelp className="h-4 w-4" /></button></div><div className="h-[250px] w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="#edf0e8" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#95a097", fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#a2aba3", fontSize: 10 }} domain={[0, 100]} tickFormatter={(value) => `${value}%`} /><Tooltip content={<ChartTip />} /><ReferenceLine y={60} stroke="#ef705f" strokeDasharray="4 4" label={{ value: "Target", position: "insideTopRight", fill: "#c85c51", fontSize: 10 }} /><Line type="monotone" dataKey="oee" stroke="#18382e" strokeWidth={3} dot={{ r: 3, fill: "#c7dd54", stroke: "#18382e", strokeWidth: 2 }} /><Line type="monotone" dataKey="availability" stroke="#f4a56b" strokeWidth={2} dot={false} strokeDasharray="5 5" /><Line type="monotone" dataKey="performance" stroke="#a9c947" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer></div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#eef1ea] pt-4 text-[10px] font-bold text-[#79857d]"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#18382e]" />OEE</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#f4a56b]" />Availability</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#a9c947]" />Performance</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#ef705f]" />60% target</span><span className="ml-auto text-[#a3ada5]">{mode === "demo" ? "Last 6 production days" : "Imported signal view"}</span></div></div><div id="losses" className="panel rounded-[26px] bg-[#fffaf4] p-5 shadow-[0_14px_38px_rgba(18,34,29,0.06)] sm:p-6"><div className="mb-6 flex items-start justify-between gap-3"><div><p className="section-kicker orange">Signal / 02</p><h3 className="font-display text-[21px] font-extrabold tracking-[-0.05em]">Downtime Pareto</h3></div><button onClick={() => explain("pareto")} className="rounded-xl bg-[#fff0df] p-2 text-[#c27642] transition hover:bg-[#ffe6ce]" aria-label="Explain downtime Pareto"><CircleHelp className="h-4 w-4" /></button></div><div className="h-[250px] w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={pareto} margin={{ top: 8, right: 8, left: -15, bottom: 5 }}><CartesianGrid vertical={false} stroke="#f1e8de" /><XAxis dataKey="cause" axisLine={false} tickLine={false} tick={{ fill: "#9a938b", fontSize: 9 }} interval={0} angle={-12} textAnchor="end" height={45} /><YAxis yAxisId="minutes" axisLine={false} tickLine={false} tick={{ fill: "#a59d95", fontSize: 10 }} /><YAxis yAxisId="share" orientation="right" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#bf5144", fontSize: 10 }} tickFormatter={(value) => `${value}%`} /><Tooltip cursor={{ fill: "#f9eee2" }} content={<LossTip />} /><Bar yAxisId="minutes" dataKey="minutes" fill="#f4a56b" radius={[7, 7, 2, 2]} /><Line yAxisId="share" type="monotone" dataKey="share" stroke="#bf5144" strokeWidth={2.5} dot={{ r: 3, fill: "#bf5144" }} /></ComposedChart></ResponsiveContainer></div><div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[#f1e8de] pt-4 text-[10px] font-bold text-[#8b7765]"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#f4a56b]" />Minutes</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#bf5144]" />Cumulative share</span><span className="ml-auto text-[#b39b86]">{pareto[0]?.cause ?? "No loss cause mapped"} leads</span></div></div></section>
          <section id="components" className="mb-7 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]"><div className="panel rounded-[26px] bg-white p-5 shadow-[0_14px_38px_rgba(18,34,29,0.06)] sm:p-6"><div className="mb-6 flex items-start justify-between gap-3"><div><p className="section-kicker">Signal / 03</p><h3 className="font-display text-[21px] font-extrabold tracking-[-0.05em]">Component scorecard</h3><p className="mt-2 text-[11px] text-[#87938b]">See which OEE factor is furthest from its target.</p></div><MiniBadge tone="lime">Target view</MiniBadge></div><div className="h-[235px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={componentData} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 4 }}><CartesianGrid horizontal={false} stroke="#edf0e8" /><XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#a2aba3", fontSize: 10 }} tickFormatter={(value) => `${value}%`} /><YAxis type="category" dataKey="component" axisLine={false} tickLine={false} tick={{ fill: "#516158", fontSize: 11, fontWeight: 700 }} width={84} /><Tooltip formatter={(value: number, name: string) => [`${number(value)}%`, name === "actual" ? "Actual" : "Target"]} /><Bar dataKey="actual" name="Actual" fill="#a9c947" radius={[0, 8, 8, 0]} barSize={18} /><Bar dataKey="target" name="Target" fill="#e4e9da" radius={[0, 8, 8, 0]} barSize={18} /></BarChart></ResponsiveContainer></div><div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#eef1ea] pt-4 text-[10px] font-bold text-[#7b887f]"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#a9c947]" />Actual performance</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#e4e9da]" />Reference target</span></div></div><div className="panel rounded-[26px] bg-[#eef3df] p-5 shadow-[0_14px_38px_rgba(18,34,29,0.06)] sm:p-6"><div className="mb-5 flex items-start justify-between"><div><p className="section-kicker">Decision lens</p><h3 className="font-display text-[21px] font-extrabold tracking-[-0.05em] text-[#254130]">Where to focus next</h3></div><Target className="h-5 w-5 text-[#779034]" /></div><div className="space-y-3">{componentData.map((item) => { const gap = Math.max(0, item.target - item.actual); return <div key={item.component} className="rounded-2xl bg-white/65 p-3.5"><div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-black text-[#3b5240]">{item.component}</span><span className={`font-display text-[16px] font-extrabold ${gap > 20 ? "text-[#c45d4d]" : gap > 8 ? "text-[#b26e39]" : "text-[#6b852d]"}`}>{gap.toFixed(1)} pts gap</span></div><div className="h-2 overflow-hidden rounded-full bg-[#dfe8cc]"><div className="h-full rounded-full bg-[#a9c947] transition-all" style={{ width: `${Math.min(100, (item.actual / item.target) * 100)}%` }} /></div><p className="mt-2 text-[10px] text-[#7b8a6d]">{number(item.actual)}% actual against {number(item.target)}% target</p></div>; })}</div><p className="mt-5 border-t border-[#d1ddb6] pt-4 text-[11px] leading-relaxed text-[#617254]">Prioritize <strong className="text-[#3d5b37]">{componentData.reduce((largest, item) => item.target - item.actual > largest.target - largest.actual ? item : largest, componentData[0]).component.toLowerCase()}</strong> first; it has the widest recoverable gap in this view.</p></div></section>
          <section id="crew" className="mb-7 grid gap-5 xl:grid-cols-[0.92fr_1.38fr]"><div className="panel rounded-[26px] bg-white p-5 shadow-[0_14px_38px_rgba(18,34,29,0.06)] sm:p-6"><div className="mb-5 flex items-start justify-between"><div><p className="section-kicker">Signal / 04</p><h3 className="font-display text-[21px] font-extrabold tracking-[-0.05em]">Shift benchmark</h3></div><select value={shift} onChange={(event) => setShift(event.target.value as Shift)} className="rounded-xl border-0 bg-[#f0f3e8] px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-[#66742d] outline-none"><option>All shifts</option><option>Morning</option><option>Afternoon</option><option>Night</option></select></div><div className="space-y-3">{visibleShifts.map((item, index) => <div key={item.shift} className="rounded-2xl bg-[#f7f8f3] p-4 transition hover:bg-[#eef3df]"><div className="mb-3 flex items-center justify-between"><div><p className="text-[12px] font-black text-[#31433a]">{item.shift}</p><p className="mt-1 text-[10px] font-medium text-[#98a29a]">{item.note}</p></div><strong className="font-display text-[23px] font-extrabold tracking-[-0.06em] text-[#2e493a]">{number(item.oee)}%</strong></div><div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e2e9d7]"><div className="h-full rounded-full bg-[#a9c947]" style={{ width: `${Math.min(100, item.oee * 1.6)}%` }} /></div><span className="text-[10px] font-black text-[#84916c]">{item.oee >= 45 ? "On track" : "Watch"}</span></div></div>)}</div><button onClick={() => explain("shift")} className="mt-5 flex w-full items-center justify-between rounded-xl bg-[#eef3df] px-3 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-[#687837]">Read the shift signal <ChevronRight className="h-4 w-4" /></button></div></section>

        </div>
      </main>
    </div>
    {helpTopic && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#10231d]/45 p-4 backdrop-blur-sm sm:items-center"><div className="w-full max-w-md rounded-[26px] bg-[#fffdf8] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><MiniBadge tone="dark">Signal guide</MiniBadge><h3 className="mt-3 font-display text-2xl font-extrabold tracking-[-0.05em]">Why this matters</h3></div><button onClick={() => setHelpTopic("")} className="rounded-xl bg-[#f0f3e8] p-2 text-[#66742d]" aria-label="Close help"><X className="h-4 w-4" /></button></div><p className="mt-4 text-[13px] leading-7 text-[#637069]">{helpTopic === "pareto" ? "The Pareto ranks loss categories by impact. Starting with the first bar helps the team recover the most capacity with the fewest simultaneous experiments." : helpTopic === "shift" ? "Shift benchmarking separates a line problem from a crew or handoff pattern. Pair the weakest signal with an owner and a short countermeasure cycle." : "OEE is the product of availability, performance, and quality. A low component compounds the loss, so improving the constraint creates the fastest lift."}</p><button onClick={() => setHelpTopic("")} className="mt-6 w-full rounded-xl bg-[#12221d] py-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#ddec85]">Back to dashboard</button></div></div>}
  </div>;
}
