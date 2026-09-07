"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QuotationView } from "@/components/quotation/QuotationView";
import { ImageDropZone, ImageUrlField } from "@/components/editor/ImagePicker";
import { ListEditor } from "@/components/editor/ListEditor";
import { Card, LinesField, NumberField, RangeField, Row, TextAreaField, TextField, Toggle } from "@/components/ui/fields";
import { resolveMilestones, resolveTotal } from "@/lib/compute";
import { newId } from "@/lib/id";
import { formatINR, numberToIndianWords } from "@/lib/money";
import type { Quotation, QuotationStatus } from "@/lib/types";

/** Only the object-valued sections can be shallow-patched. */
type SectionKey = {
  [K in keyof Quotation]: Quotation[K] extends object ? K : never;
}[keyof Quotation];

type SaveState = "saved" | "dirty" | "saving" | "error";

const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent to client",
  accepted: "Accepted",
};

export function Editor({
  initial,
  uploadsEnabled = true,
}: {
  initial: Quotation;
  /** False when the deployment has no file storage — the URL field still works. */
  uploadsEnabled?: boolean;
}) {
  const [q, setQ] = useState<Quotation>(initial);
  const [slugDraft, setSlugDraft] = useState(initial.slug);
  const [slugEdited, setSlugEdited] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState("");
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [copied, setCopied] = useState(false);

  const firstRender = useRef(true);
  const latest = useRef({ q, slugDraft, slugEdited });
  latest.current = { q, slugDraft, slugEdited };

  const patch = useCallback(<K extends SectionKey>(key: K, changes: Partial<Quotation[K]>) => {
    setQ((prev) => ({ ...prev, [key]: { ...prev[key], ...changes } }));
  }, []);

  const save = useCallback(async () => {
    const { q: current, slugDraft: slug, slugEdited: edited } = latest.current;
    setSaveState("saving");
    setSaveError("");
    try {
      const response = await fetch(`/api/quotations/${current.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edited ? { ...current, slug } : current),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        quotation?: Quotation;
        error?: string;
      };
      if (!response.ok || !payload.quotation) throw new Error(payload.error || "Could not save.");

      setSlugDraft(payload.quotation.slug);
      setSlugEdited(false);
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "Could not save.");
    }
  }, []);

  // Autosave: the studio should never lose an edit to a stray tab close.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState("dirty");
    const timer = setTimeout(() => void save(), 1200);
    return () => clearTimeout(timer);
  }, [q, slugDraft, save]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  useEffect(() => {
    if (saveState === "saved") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  // Read the origin only after mounting. Branching on `typeof window` during
  // render makes the server and the first client render disagree, which React
  // reports as a hydration error and recovers from by throwing the server HTML
  // away.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const shareUrl = useMemo(
    () => `${origin}/q/${slugDraft}`,
    [origin, slugDraft],
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* Clipboard blocked — the input below still shows the full URL. */
    }
  }

  const total = resolveTotal(q);
  const milestones = resolveMilestones(q);
  const percentSum = q.payments.milestones.reduce((sum, m) => sum + m.percent, 0);

  return (
    <div className="min-h-screen bg-cream">
      {/* ------------------------------------------------------------ bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Link
            href="/admin"
            className="text-sm text-muted transition hover:text-forest"
            title="All quotations"
          >
            &larr; <span className="hidden sm:inline">All quotations</span>
          </Link>

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg text-forest">
              {q.client.name || "Untitled quotation"}
            </p>
            <p className="truncate text-[0.7rem] text-muted">{formatINR(total)} · {q.event.title}</p>
          </div>

          <SaveBadge state={saveState} error={saveError} />

          <select
            value={q.status}
            onChange={(e) => setQ((prev) => ({ ...prev, status: e.target.value as QuotationStatus }))}
            className="rounded-md border border-line bg-white px-2.5 py-1.5 text-xs text-body outline-none focus:border-gold"
          >
            {(Object.keys(STATUS_LABELS) as QuotationStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={copyLink}
            className="rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-forest transition hover:border-gold"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>

          <a
            href={`/q/${slugDraft}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-forest px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-forest-soft"
          >
            Open
          </a>
        </div>

        {/* Mobile: the preview replaces the form rather than sitting beside it. */}
        <div className="flex border-t border-line lg:hidden">
          {(["edit", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium tracking-wide uppercase transition ${
                tab === t ? "border-b-2 border-gold text-forest" : "text-muted"
              }`}
            >
              {t === "edit" ? "Edit" : "Client preview"}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ----------------------------------------------------------- form */}
        <div className={`space-y-5 ${tab === "edit" ? "" : "hidden lg:block"}`}>
          <Card title="Client & event" description="This is what the client sees at the very top of the page.">
            <Row cols={3}>
              <TextField label="Salutation" value={q.client.salutation} onChange={(v) => patch("client", { salutation: v })} placeholder="Mr." />
              <TextField label="Client name" value={q.client.name} onChange={(v) => patch("client", { name: v })} placeholder="Shravan Yadav" className="sm:col-span-2" />
            </Row>
            <Row>
              <TextField label="Partner name" hint="Shown as “Shravan & Priya”. Leave blank to show one name." value={q.client.partnerName} onChange={(v) => patch("client", { partnerName: v })} />
              <TextField label="Client phone" value={q.client.phone} onChange={(v) => patch("client", { phone: v })} />
            </Row>
            <TextField label="Client email" type="email" value={q.client.email} onChange={(v) => patch("client", { email: v })} />
            <TextField label="Event title" value={q.event.title} onChange={(v) => patch("event", { title: v })} placeholder="Wedding Photography & Videography" />
            <Row>
              <TextField label="Event dates" value={q.event.dates} onChange={(v) => patch("event", { dates: v })} placeholder="12–14 February 2027" />
              <TextField label="Venue / city" value={q.event.venue} onChange={(v) => patch("event", { venue: v })} placeholder="Raipur" />
            </Row>
            <Row cols={3}>
              <TextField label="Quotation no." value={q.meta.quoteNumber} onChange={(v) => patch("meta", { quoteNumber: v })} placeholder="TWS-2027-014" />
              <TextField label="Date" value={q.meta.quoteDate} onChange={(v) => patch("meta", { quoteDate: v })} />
              <TextField label="Valid until" value={q.meta.validUntil} onChange={(v) => patch("meta", { validUntil: v })} placeholder="30 days" />
            </Row>
          </Card>

          <Card title="Studio & cover" description="Your name at the top, and the photo behind it.">
            <Row>
              <TextField label="Studio name" value={q.studio.name} onChange={(v) => patch("studio", { name: v })} />
              <TextField label="Tagline" value={q.studio.tagline} onChange={(v) => patch("studio", { tagline: v })} />
            </Row>
            <ImageDropZone
              label="Cover photo (optional)"
              hint="Sits behind the client's name. Without one, a deep-green background is used."
              multiple={false}
              enabled={uploadsEnabled}
              onUploaded={(urls) => patch("studio", { coverUrl: urls[0] ?? "" })}
            />
            <ImageUrlField
              label="Cover image URL"
              hint="Paste the address of a photo you host elsewhere. Google Drive and Dropbox share links are converted automatically."
              value={q.studio.coverUrl}
              onChange={(v) => patch("studio", { coverUrl: v })}
            />
            {q.studio.coverUrl && (
              <RangeField
                label="Darken the cover"
                hint="Enough to keep the names readable, no more. Watch the preview."
                min={0}
                max={90}
                step={5}
                value={q.studio.coverOverlay}
                onChange={(coverOverlay) => patch("studio", { coverOverlay })}
                format={(v) => `${v}%`}
              />
            )}
          </Card>

          <Card title="Opening note" description="A short, warm paragraph. Blank lines start a new paragraph.">
            <TextField label="Greeting" value={q.letter.greeting} onChange={(v) => patch("letter", { greeting: v })} placeholder="Dear Shravan," />
            <TextAreaField label="Message" rows={5} value={q.letter.body} onChange={(v) => patch("letter", { body: v })} />
          </Card>

          <Card title="Your work" description="Photographs sell the quotation. Three to nine images works best.">
            <Row>
              <TextField label="Section heading" value={q.gallery.title} onChange={(v) => patch("gallery", { title: v })} />
              <TextField label="Sub-heading" value={q.gallery.subtitle} onChange={(v) => patch("gallery", { subtitle: v })} />
            </Row>
            <ImageDropZone
              label="Drag photos here, or choose files"
              hint="JPG, PNG or WebP up to 8 MB each."
              enabled={uploadsEnabled}
              onUploaded={(urls) =>
                patch("gallery", {
                  photos: [...q.gallery.photos, ...urls.map((url) => ({ id: newId(), url, caption: "" }))],
                })
              }
            />
            <ListEditor
              items={q.gallery.photos}
              onChange={(photos) => patch("gallery", { photos })}
              create={() => ({ id: newId(), url: "", caption: "" })}
              addLabel="Add photo by URL"
              emptyLabel="No photos yet. The gallery section is hidden until you add one."
              renderItem={(photo, patchPhoto) => (
                <div className="flex gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <ImageUrlField label="Image URL" value={photo.url} onChange={(url) => patchPhoto({ url })} />
                    <TextField label="Caption (optional)" value={photo.caption} onChange={(caption) => patchPhoto({ caption })} />
                  </div>
                </div>
              )}
            />
          </Card>

          <Card title="What's included" description="Group the services the way you talk about them.">
            <Row>
              <TextField label="Section heading" value={q.services.title} onChange={(v) => patch("services", { title: v })} />
              <TextField label="Sub-heading" value={q.services.subtitle} onChange={(v) => patch("services", { subtitle: v })} />
            </Row>
            <ListEditor
              items={q.services.groups}
              onChange={(groups) => patch("services", { groups })}
              create={() => ({ id: newId(), title: "", items: [] })}
              addLabel="Add a service group"
              renderItem={(group, patchGroup) => (
                <div className="space-y-3">
                  <TextField label="Group title" value={group.title} onChange={(title) => patchGroup({ title })} placeholder="Videography" />
                  <LinesField label="Items" items={group.items} onChange={(items) => patchGroup({ items })} placeholder={"Traditional full wedding video\nCinematic highlight film"} />
                </div>
              )}
            />
          </Card>

          <Card title="Your team" description="Who turns up, and for how long.">
            <Row>
              <TextField label="Section heading" value={q.team.title} onChange={(v) => patch("team", { title: v })} />
              <TextField label="Sub-heading" value={q.team.subtitle} onChange={(v) => patch("team", { subtitle: v })} />
            </Row>
            <ListEditor
              items={q.team.members}
              onChange={(members) => patch("team", { members })}
              create={() => ({ id: newId(), count: 1, role: "", duration: "" })}
              addLabel="Add a team member"
              renderItem={(member, patchMember) => (
                <Row cols={3}>
                  <NumberField label="How many" min={1} value={member.count} onChange={(count) => patchMember({ count })} />
                  <TextField label="Role" value={member.role} onChange={(role) => patchMember({ role })} placeholder="Candid Photographer" />
                  <TextField label="Duration" value={member.duration} onChange={(duration) => patchMember({ duration })} placeholder="2 days" />
                </Row>
              )}
            />
          </Card>

          <Card title="Deliverables" description="What actually lands in the client's hands, and when.">
            <Row>
              <TextField label="Section heading" value={q.deliverables.title} onChange={(v) => patch("deliverables", { title: v })} />
              <TextField label="Sub-heading" value={q.deliverables.subtitle} onChange={(v) => patch("deliverables", { subtitle: v })} />
            </Row>
            <LinesField label="Deliverables" rows={6} items={q.deliverables.items} onChange={(items) => patch("deliverables", { items })} />
            <TextField label="Delivery timeline" hint="Shown as a highlighted note under the list." value={q.deliverables.timelineNote} onChange={(v) => patch("deliverables", { timelineNote: v })} />
          </Card>

          <Card title="Pricing" description="Show one all-in figure, or break it down line by line.">
            <TextField label="Section heading" value={q.pricing.title} onChange={(v) => patch("pricing", { title: v })} />
            <Toggle
              label="Show an itemised breakdown"
              hint="When on, the total is the sum of the lines below."
              checked={q.pricing.showLineItems}
              onChange={(showLineItems) => patch("pricing", { showLineItems })}
            />

            {q.pricing.showLineItems ? (
              <>
                <ListEditor
                  items={q.pricing.lineItems}
                  onChange={(lineItems) => patch("pricing", { lineItems })}
                  create={() => ({ id: newId(), label: "", note: "", amount: 0 })}
                  addLabel="Add a line"
                  emptyLabel="Add at least one line, or switch the breakdown off."
                  renderItem={(item, patchItem) => (
                    <div className="space-y-3">
                      <Row>
                        <TextField label="Label" value={item.label} onChange={(label) => patchItem({ label })} placeholder="Candid photography — 2 days" />
                        <NumberField label="Amount" suffix="₹" value={item.amount} onChange={(amount) => patchItem({ amount })} />
                      </Row>
                      <TextField label="Note (optional)" value={item.note} onChange={(note) => patchItem({ note })} />
                    </div>
                  )}
                />
                <p className="rounded-md bg-cream px-4 py-3 text-sm text-forest">
                  Total from lines: <strong className="tabular-nums">{formatINR(total)}</strong>
                </p>
              </>
            ) : (
              <NumberField label="Total amount" suffix="₹" value={q.pricing.total} onChange={(v) => patch("pricing", { total: v })} />
            )}

            <TextField
              label="Amount in words"
              hint={`Leave blank to use: ${numberToIndianWords(total)}`}
              value={q.pricing.amountInWordsOverride}
              onChange={(v) => patch("pricing", { amountInWordsOverride: v })}
            />
            <TextField label="Note under the total" value={q.pricing.note} onChange={(v) => patch("pricing", { note: v })} />
          </Card>

          <Card title="Payment schedule" description="Percentages are turned into rupee amounts automatically.">
            <TextField label="Section heading" value={q.payments.title} onChange={(v) => patch("payments", { title: v })} />
            <ListEditor
              items={q.payments.milestones}
              onChange={(ms) => patch("payments", { milestones: ms })}
              create={() => ({ id: newId(), label: "", percent: 0, when: "" })}
              addLabel="Add a milestone"
              renderItem={(m, patchM, index) => (
                <div className="space-y-3">
                  <Row cols={3}>
                    <TextField label="Label" value={m.label} onChange={(label) => patchM({ label })} placeholder="Booking amount" className="sm:col-span-2" />
                    <NumberField label="Percent" suffix="%" value={m.percent} onChange={(percent) => patchM({ percent })} />
                  </Row>
                  <TextField label="When" value={m.when} onChange={(when) => patchM({ when })} placeholder="To confirm the dates" />
                  <p className="text-[0.75rem] text-muted">
                    Client sees <strong className="tabular-nums text-forest">{formatINR(milestones[index]?.amount ?? 0)}</strong>
                  </p>
                </div>
              )}
            />
            {q.payments.milestones.length > 0 && percentSum !== 100 && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-[0.8rem] text-amber-900">
                Your milestones add up to {percentSum}%, not 100%. The last one absorbs the difference, so
                the schedule still totals {formatINR(total)}.
              </p>
            )}
          </Card>

          <Card title="Terms & conditions">
            <TextField label="Section heading" value={q.terms.title} onChange={(v) => patch("terms", { title: v })} />
            <LinesField label="Terms" rows={6} items={q.terms.items} onChange={(items) => patch("terms", { items })} />
          </Card>

          <Card title="Sign-off & contact" description="How the client reaches you the moment they decide.">
            <TextAreaField label="Closing message" rows={3} value={q.signoff.message} onChange={(v) => patch("signoff", { message: v })} />
            <Row>
              <TextField label="Your name" value={q.signoff.personName} onChange={(v) => patch("signoff", { personName: v })} />
              <TextField label="Business name" value={q.signoff.businessName} onChange={(v) => patch("signoff", { businessName: v })} />
            </Row>
            <Row>
              <TextField label="Phone" value={q.signoff.phone} onChange={(v) => patch("signoff", { phone: v })} />
              <TextField label="WhatsApp number" hint="With country code, digits only — e.g. 918109705662." value={q.signoff.whatsapp} onChange={(v) => patch("signoff", { whatsapp: v })} />
            </Row>
            <Row>
              <TextField label="Email" type="email" value={q.signoff.email} onChange={(v) => patch("signoff", { email: v })} />
              <TextField label="Instagram handle" value={q.signoff.instagram} onChange={(v) => patch("signoff", { instagram: v })} placeholder="theweddingsridha" />
            </Row>
            <TextField label="Website" value={q.signoff.website} onChange={(v) => patch("signoff", { website: v })} placeholder="https://…" />
          </Card>

          <Card title="Share link" description="Send this to the client. Anyone with the link can view it.">
            <TextField
              label="Link ending"
              hint={shareUrl}
              value={slugDraft}
              onChange={(v) => {
                setSlugDraft(v);
                setSlugEdited(true);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copyLink} className="rounded-md border border-line bg-white px-4 py-2 text-sm font-medium text-forest transition hover:border-gold">
                {copied ? "Copied!" : "Copy link"}
              </button>
              <a href={`/q/${slugDraft}`} target="_blank" rel="noreferrer" className="rounded-md bg-forest px-4 py-2 text-sm font-medium text-cream transition hover:bg-forest-soft">
                Open client view
              </a>
            </div>
          </Card>
        </div>

        {/* -------------------------------------------------------- preview */}
        <div className={`${tab === "preview" ? "" : "hidden lg:block"}`}>
          <div className="lg:sticky lg:top-24">
            <p className="mb-2 hidden text-[0.7rem] font-semibold tracking-[0.12em] uppercase text-muted lg:block">
              Client preview — live
            </p>
            <div className="overflow-hidden rounded-lg border border-line bg-cream shadow-sm lg:h-[calc(100vh-8rem)] lg:overflow-y-auto">
              <QuotationView quotation={q} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveBadge({ state, error }: { state: SaveState; error: string }) {
  const map: Record<SaveState, { text: string; className: string }> = {
    saved: { text: "Saved", className: "text-muted" },
    dirty: { text: "Unsaved…", className: "text-amber-700" },
    saving: { text: "Saving…", className: "text-muted" },
    error: { text: error || "Save failed", className: "text-red-600" },
  };
  const { text, className } = map[state];
  return <span className={`text-[0.75rem] whitespace-nowrap ${className}`} title={error}>{text}</span>;
}
