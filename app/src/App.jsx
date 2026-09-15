import { useMemo, useState } from "react";
import {
  ArrowSquareOut, CaretDown, CaretRight, CheckCircle, CheckSquare,
  ClockCounterClockwise, Copy, Database, FunnelSimple, Info, MagnifyingGlass,
  Plus, Question, ShieldCheck, SlidersHorizontal, Sparkle, SpinnerGap,
  WarningCircle, X, XCircle,
} from "@phosphor-icons/react";
import { CHANNEL_LABELS, INITIAL_TICKETS, PRODUCT_LABELS } from "./demo-data.js";
import {
  groupedFcaProducts,
  PRODUCT_TICKET_PREFIXES,
} from "../shared/fca-product-registry.js";

const outcome = {
  block: { label: "Block", tone: "danger", Icon: XCircle },
  revise: { label: "Revise", tone: "warning", Icon: WarningCircle },
  recommended: { label: "Recommended for approval", tone: "success", Icon: CheckCircle },
  review_failed: { label: "Review could not be completed", tone: "neutral", Icon: WarningCircle },
};
const workflowTone = { "In review": "danger", Triaged: "warning", Reviewed: "success", Analysing: "info", "Needs attention": "neutral" };

function titleFromPromotion(value) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 48 ? `${clean.slice(0, 48).trim()}…` : clean;
}
function nextTicketId(product) {
  return `${PRODUCT_TICKET_PREFIXES[product] ?? "FCA"}-2026-${Math.floor(4200 + Math.random() * 600)}`;
}
async function streamReview(input, onStage) {
  const response = await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.body) throw new Error("The review service did not return a stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      if (event.type === "stage") onStage(event.stage);
      if (event.type === "result") result = event.result;
      if (event.type === "error") throw new Error(event.message);
    }
  }
  if (!result) throw new Error("The grounded review did not complete.");
  return result;
}

function StatusPill({ children, tone = "neutral" }) { return <span className={`status-pill ${tone}`}>{children}</span>; }

function TopBar({ onInfo }) {
  const showPreview = () => onInfo("These tabs show the wider product model; only the live review queue is included in this demo.");
  return <header className="topbar">
    <div className="brand">Compliance Desk</div>
    <nav aria-label="Primary navigation">
      <button className="nav-tab active">Review queue</button>
      <button className="nav-tab preview-tab" title="Product preview — not included in this demo" onClick={showPreview}>Review history</button>
      <button className="nav-tab preview-tab" title="Product preview — not included in this demo" onClick={showPreview}>Reference library</button>
    </nav>
    <div className="topbar-actions">
      <button className="help-button" onClick={() => onInfo("AI-assisted review of text-only UK financial promotions for selected retail product journeys. Results support, but do not replace, the compliance reviewer’s decision.")}><Question size={19} weight="bold" /> Help</button>
      <div className="user-menu">Sarah Patel <CaretDown size={15} /></div>
    </div>
  </header>;
}

function QueuePanel({ tickets, selectedId, onSelect, onNew, sortNewest, setSortNewest, filter, setFilter }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  return <aside className="queue-panel">
    <div className="queue-heading"><h1>Review queue</h1><button className="primary-button new-promotion-button" onClick={onNew}><Plus size={18} weight="bold" /> New promotion</button></div>
    <div className="queue-tools">
      <button className="tool-button" onClick={() => setSortNewest((value) => !value)}>Sort: {sortNewest ? "Newest first" : "Oldest first"} <CaretDown size={15} /></button>
      <div className="filter-wrap">
        <button className={`tool-button ${filter !== "all" ? "selected" : ""}`} onClick={() => setFiltersOpen((value) => !value)}><FunnelSimple size={18} /> Filters</button>
        {filtersOpen && <div className="filter-popover">{[["all","All recommendations"],["block","Block"],["revise","Revise"],["recommended","Recommended"]].map(([value,label]) =>
          <button key={value} className={filter === value ? "active" : ""} onClick={() => { setFilter(value); setFiltersOpen(false); }}>{label}{filter === value && <CheckSquare size={16} weight="fill" />}</button>
        )}</div>}
      </div>
    </div>
    <div className="ticket-list">{tickets.length === 0 ? <div className="empty-queue"><MagnifyingGlass size={24} /><p>No tickets match this filter.</p></div> : tickets.map((ticket) =>
      <button key={ticket.id} className={`ticket-card ${ticket.id === selectedId ? "active" : ""}`} onClick={() => onSelect(ticket.id)}>
        <div className="ticket-main"><strong>{ticket.title}</strong><span>{ticket.id} · {ticket.owner}</span><span>{PRODUCT_LABELS[ticket.product]} · {CHANNEL_LABELS[ticket.channel]} · UK retail</span></div>
        <div className="ticket-meta"><StatusPill tone={workflowTone[ticket.workflowStatus]}>{ticket.workflowStatus}</StatusPill><span>Submitted<br />{ticket.submitted.split(",")[0]}</span></div>
        <CaretRight className="ticket-caret" size={20} />
      </button>
    )}</div>
  </aside>;
}

function RecommendationCard({ recommendation }) {
  const config = outcome[recommendation] ?? outcome.review_failed;
  return <div className={`recommendation-card ${config.tone}`}><config.Icon size={31} weight="fill" /><div><strong>{config.label}</strong><p>
    {recommendation === "block" && "Material issue identified. Do not progress in its current form."}
    {recommendation === "revise" && "Changes or reviewer verification are needed before progression."}
    {recommendation === "recommended" && "No material issue identified in the supplied copy and context."}
    {recommendation === "review_failed" && "No ungrounded conclusion has been shown."}
  </p></div></div>;
}

function FieldStatus({ label, value }) {
  const labels = { present: "Present", missing: "Missing", not_applicable: "Not applicable", reviewer_to_verify: "Reviewer to verify", not_required: "Not required" };
  return <div className="field-status"><span>{label}</span><StatusPill tone={value === "missing" ? "danger" : value === "reviewer_to_verify" ? "warning" : "success"}>{labels[value] ?? value}</StatusPill></div>;
}

function Finding({ finding, index, onToast }) {
  const severity = finding.result === "block" ? "High risk" : finding.result === "revise" ? "Change needed" : "Requirement met";
  const tone = finding.result === "block" ? "danger" : finding.result === "revise" ? "warning" : "success";
  const citationCount = finding.citations?.length ?? 0;
  return <section className="finding-section">
    <div className="finding-title-row"><h3>{index + 1}. Claim-level finding</h3><StatusPill tone={tone}>{severity}</StatusPill><div className="reviewer-state">Reviewer decision: <StatusPill tone="info">Pending</StatusPill></div></div>
    <div className="finding-content">
      <div className="finding-primary">
        <div className={`assessment-panel ${tone}`}>
          <span className="section-label">Reviewer assessment</span>
          <p>{finding.explanation}</p>
        </div>
        {finding.requiredAction && <div className="required-action">
          <span className="section-label">Required action</span>
          <p>{finding.requiredAction}</p>
        </div>}
        {finding.suggestedRewrite && <div className="rewrite-section">
          <span className="section-label">Rewrite guidance</span>
          <div className="rewrite-grid"><div><span>Before · submitted copy</span><p>{finding.promoQuote}</p></div><div><span>After · suggested wording</span><p>{finding.suggestedRewrite}</p></div></div>
          <button className="copy-button" onClick={() => { navigator.clipboard?.writeText(finding.suggestedRewrite); onToast("Suggested wording copied."); }}><Copy size={15} /> Copy suggestion</button>
        </div>}
      </div>
      <aside className="finding-meta" aria-label="Claim details">
        <span className="section-label">Claim details</span>
        <dl>
          <div><dt>Assessed wording</dt><dd className={tone === "success" ? "positive-copy" : "problem-copy"}>{finding.promoQuote}</dd></div>
          <div><dt>Finding type</dt><dd className="capitalize">{finding.issueType}</dd></div>
        </dl>
        <div className="checks-compact">
          <FieldStatus label="Consumer-facing disclosure" value={finding.disclosureStatus} />
          <FieldStatus label="Substantiation" value={finding.substantiationStatus} />
        </div>
      </aside>
    </div>
    <section className="regulatory-basis" aria-labelledby={`regulatory-basis-${finding.id}`}>
      <div className="regulatory-heading">
        <div><span className="section-label" id={`regulatory-basis-${finding.id}`}>Regulatory basis</span><p>Applicable FCA provisions supporting this assessment.</p></div>
        <StatusPill>{citationCount} {citationCount === 1 ? "source" : "sources"}</StatusPill>
      </div>
      <div className="citations">{finding.citations.map((citation) => <div className="citation" key={citation.id}>
        <a href={citation.url} target="_blank" rel="noreferrer">{citation.id} · {citation.heading} <ArrowSquareOut size={15} /></a>
        <details className="source-excerpt"><summary>View source text</summary><blockquote>“{citation.quote}”</blockquote></details>
      </div>)}</div>
    </section>
  </section>;
}

function AuditTrace({ result }) {
  const [open, setOpen] = useState(false);
  const audit = result.audit;
  return <section className="audit-section">
    <button className="audit-toggle" onClick={() => setOpen((value) => !value)}><span>{open ? <CaretDown size={19} /> : <CaretRight size={19} />} Evidence & audit trace</span><StatusPill>{open ? "Expanded" : "Collapsed"}</StatusPill></button>
    {open && <div className="audit-content">
      <div className="audit-summary"><div><span>Workflow</span><strong>{audit.workflowVersion}</strong></div><div><span>Regulatory snapshot</span><strong>{audit.snapshot.asOf}</strong></div><div><span>Engine</span><strong>{audit.engineMode}</strong></div><div><span>End-to-end</span><strong>{(audit.timings.totalMs / 1000).toFixed(1)}s</strong></div></div>
      <div className="audit-columns">
        <div><h4>Extracted claims</h4>{(audit.extractedClaims ?? []).map((claim) => <p key={claim.id}>{claim.exactText}</p>)}</div>
        <div><h4>Retrieved provisions</h4>{(audit.retrievedEvidence ?? []).map((rule) => <p key={rule.id}>{rule.id} <span>lex {rule.lexicalRank} · sem {rule.semanticRank ?? "n/a"}</span></p>)}</div>
        <div><h4>Validation</h4><p><CheckCircle size={16} weight="fill" /> Promotion quotes verified</p><p><CheckCircle size={16} weight="fill" /> Rule IDs retrieved</p><p><CheckCircle size={16} weight="fill" /> Source quotes application-supplied</p><p><CheckCircle size={16} weight="fill" /> Structured result validated</p></div>
      </div>
      {audit.snapshot.corpusNotice && <div className="corpus-notice"><Database size={18} /> {audit.snapshot.corpusNotice}</div>}
    </div>}
  </section>;
}

function LoadingReview({ stages }) {
  const defaults = [["context","Validating submission context"],["claims","Extracting claims and disclosures"],["retrieval","Searching the FCA regulatory pack"],["evaluation","Evaluating claims against retrieved evidence"],["validation","Validating citations and quoted wording"]];
  const activeIndex = Math.max(0, defaults.findIndex(([id]) => id === stages.at(-1)?.id));
  return <div className="loading-review"><div className="ai-orb"><Sparkle size={30} weight="fill" /></div><h2>Reviewing the promotion</h2><p>The recommendation will appear only after the evidence and citations pass validation.</p><div className="stage-list">{defaults.map(([id,label], index) => <div key={id} className={index < activeIndex ? "done" : index === activeIndex ? "active" : ""}>{index < activeIndex ? <CheckCircle size={18} weight="fill" /> : index === activeIndex ? <SpinnerGap size={18} className="spin" /> : <ClockCounterClockwise size={18} />}<span>{label}</span></div>)}</div></div>;
}

function CaseWorkspace({ ticket, onEdit, onToast }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  if (!ticket) return <main className="workspace empty"><p>Select a ticket to review.</p></main>;
  if (ticket.loading) return <main className="workspace"><LoadingReview stages={ticket.stages ?? []} /></main>;
  if (ticket.error) return <main className="workspace"><div className="error-state"><WarningCircle size={38} weight="fill" /><h2>Grounded review withheld</h2><p>{ticket.error}</p><button className="primary-button" onClick={() => onEdit(ticket)}>Edit and retry</button></div></main>;
  const result = ticket.result;
  return <main className="workspace">
    <div className="case-toolbar"><span className="case-id">{ticket.id}</span><StatusPill tone={workflowTone[ticket.workflowStatus]}>{ticket.workflowStatus}</StatusPill><span>Submitted: {ticket.submitted} · by {ticket.owner}</span><div className="actions-wrap"><button className="secondary-button" onClick={() => setActionsOpen((value) => !value)}>More actions <CaretDown size={16} /></button>{actionsOpen && <div className="actions-menu"><button onClick={() => { setActionsOpen(false); onEdit(ticket); }}><SlidersHorizontal size={16} /> Edit & re-run</button><button onClick={() => { navigator.clipboard?.writeText(ticket.id); setActionsOpen(false); onToast("Case ID copied."); }}><Copy size={16} /> Copy case ID</button></div>}</div></div>
    <div className="workspace-scroll">
      <h2 className="case-title">{ticket.title}</h2>
      <section className="case-overview"><div><span className="eyebrow">Submitted copy</span><p>{ticket.promotion}</p></div><div className="context-panel"><span className="eyebrow">Applicability context</span><dl><dt>Product</dt><dd>{PRODUCT_LABELS[ticket.product]}</dd><dt>Channel</dt><dd>{CHANNEL_LABELS[ticket.channel]}</dd><dt>Audience</dt><dd>UK retail</dd><dt>Jurisdiction</dt><dd>United Kingdom / FCA</dd><dt>Sourcebooks</dt><dd>{result.applicability.principalSourcebooks.join(", ")}</dd></dl></div><div><span className="eyebrow">Advisory recommendation</span><RecommendationCard recommendation={result.recommendation} /></div></section>
      {result.applicability.contextStatus === "possible_mismatch" && <div className="context-warning"><WarningCircle size={19} /> {result.applicability.contextExplanation}</div>}
      {result.findings?.map((finding,index) => <Finding key={finding.id} finding={finding} index={index} onToast={onToast} />)}
      <AuditTrace result={result} />
      <div className="reviewer-banner"><Info size={24} weight="fill" /><div><strong>Reviewer decision required.</strong> The advisory recommendation is not a decision. You must make and record the final decision for this promotion.</div></div>
      <p className="scope-note">AI-assisted text review across FCA-regulated UK retail product families. The demo does not verify visual prominence or external substantiation.</p>
    </div>
  </main>;
}

function SubmissionModal({ ticket, onClose, onSubmit }) {
  const [promotion, setPromotion] = useState(ticket?.promotion ?? "");
  const [product, setProduct] = useState(ticket?.product ?? "investments");
  const [channel, setChannel] = useState(ticket?.channel ?? "website");
  const valid = promotion.trim().length >= 12;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="submission-title">
    <div className="modal-header"><div><span className="modal-kicker"><Sparkle size={16} weight="fill" /> AI-assisted review</span><h2 id="submission-title">{ticket ? "Edit promotion" : "New promotion"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={21} /></button></div>
    <div className="modal-body"><label className="input-group"><span>Promotion copy</span><textarea value={promotion} onChange={(event) => setPromotion(event.target.value)} rows={7} placeholder="Paste or type the promotional copy…" autoFocus /><small>{promotion.length} / 5,000 characters · Text only</small></label><div className="form-row"><label className="input-group"><span>Product</span><select value={product} onChange={(event) => setProduct(event.target.value)}>{groupedFcaProducts().map((group) => <optgroup key={group.id} label={group.label}>{group.products.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</optgroup>)}</select></label><label className="input-group"><span>Channel</span><select value={channel} onChange={(event) => setChannel(event.target.value)}>{Object.entries(CHANNEL_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><div className="fixed-context"><ShieldCheck size={20} weight="fill" /><div><strong>Fixed demo context</strong><span>United Kingdom / FCA · Retail audience · Firm’s own promotion</span></div></div></div>
    <div className="modal-footer"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={!valid} onClick={() => onSubmit({ promotion: promotion.trim(), product, channel })}><Sparkle size={17} weight="fill" /> Run grounded review</button></div>
  </section></div>;
}

export function App() {
  const [tickets, setTickets] = useState(INITIAL_TICKETS);
  const [selectedId, setSelectedId] = useState(INITIAL_TICKETS[0].id);
  const [modalTicket, setModalTicket] = useState(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [sortNewest, setSortNewest] = useState(true);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState("");
  const showToast = (message) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const visibleTickets = useMemo(() => {
    const list = tickets.filter((ticket) => filter === "all" || ticket.result?.recommendation === filter);
    return [...list].sort((a,b) => sortNewest ? b.sortDate - a.sortDate : a.sortDate - b.sortDate);
  }, [tickets, filter, sortNewest]);
  const selected = tickets.find((ticket) => ticket.id === selectedId);
  const openNew = () => { setModalTicket(undefined); setModalOpen(true); };
  const openEdit = (ticket) => { setModalTicket(ticket); setModalOpen(true); };
  const submit = async (input) => {
    const existing = modalTicket;
    const id = existing?.id ?? nextTicketId(input.product);
    const ticket = { ...(existing ?? {}), id, title: titleFromPromotion(input.promotion), owner: existing?.owner ?? "Sarah Patel", submitted: existing?.submitted ?? "30 Aug 2026, just now", sortDate: Date.now(), workflowStatus: "Analysing", ...input, loading: true, stages: [], result: undefined, error: undefined };
    setTickets((current) => existing ? current.map((item) => item.id === id ? ticket : item) : [ticket, ...current]);
    setSelectedId(id); setModalOpen(false);
    try {
      const reviewStarted = Date.now();
      const result = await streamReview({ ...input, audience: "uk_retail", jurisdiction: "UK_FCA" }, (stage) => setTickets((current) => current.map((item) => item.id === id ? { ...item, stages: [...(item.stages ?? []), stage] } : item)));
      const remainingPreviewTime = Math.max(0, 900 - (Date.now() - reviewStarted));
      if (remainingPreviewTime) await new Promise((resolve) => window.setTimeout(resolve, remainingPreviewTime));
      setTickets((current) => current.map((item) => item.id === id ? { ...item, loading: false, workflowStatus: "In review", result } : item));
    } catch (error) {
      setTickets((current) => current.map((item) => item.id === id ? { ...item, loading: false, workflowStatus: "Needs attention", error: error.message } : item));
    }
  };
  return <div className="app-shell"><TopBar onInfo={showToast} /><div className="app-body"><QueuePanel tickets={visibleTickets} selectedId={selectedId} onSelect={setSelectedId} onNew={openNew} sortNewest={sortNewest} setSortNewest={setSortNewest} filter={filter} setFilter={setFilter} /><CaseWorkspace ticket={selected} onEdit={openEdit} onToast={showToast} /></div>{modalOpen && <SubmissionModal ticket={modalTicket} onClose={() => setModalOpen(false)} onSubmit={submit} />}{toast && <div className="toast"><Info size={18} weight="fill" /> {toast}</div>}</div>;
}

