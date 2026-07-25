"use client";

import { useState } from "react";
import {
  ArrowCounterClockwise,
  Check,
  ForkKnife,
  Hand,
  SkipForward,
  Sun,
} from "@phosphor-icons/react";
import {
  Badge,
  Button,
  Card,
  CardLabel,
  Input,
  PageShell,
  Section,
  Select,
  Textarea,
} from "@/app/components/ui";
import {
  COLOR,
  CONTRAST,
  MOTION_DOC,
  RADIUS,
  SHADOW,
  SPACE,
  TYPE,
} from "@/lib/design/tokens";

/* ── Style-guide-only helpers. Nothing here ships to a real surface. ─────── */

const SHADOW_CLASS: Record<string, string> = {
  "h-e1": "shadow-h-e1",
  "h-e2": "shadow-h-e2",
  "h-e3": "shadow-h-e3",
};

function Swatch({
  name,
  hex,
  note,
  dark,
}: {
  name: string;
  hex: string;
  note?: string;
  dark?: boolean;
}) {
  return (
    <div className="flex flex-col gap-h2">
      <div
        className="h-h16 w-full rounded-h-md border border-hearth-line"
        style={{ background: hex }}
      >
        <span
          className="flex h-full items-end p-h2 text-h9 font-medium"
          style={{ color: dark ? "#FFFFFF" : COLOR.ink2 }}
        >
          {hex}
        </span>
      </div>
      <div>
        <p className="text-h8 font-medium text-hearth-ink">{name}</p>
        {note && <p className="text-h9 text-hearth-ink-3">{note}</p>}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-h4 border-b border-hearth-line py-h4 last:border-b-0">
      <p className="w-[9rem] shrink-0 text-h9 text-hearth-ink-3">{label}</p>
      <div className="flex flex-wrap items-center gap-h3">{children}</div>
    </div>
  );
}

export default function DesignPage() {
  const [loading, setLoading] = useState(false);
  const [dish, setDish] = useState("Machboos rubyan");

  return (
    <PageShell
      title="Hearth"
      subtitle="The design language for the house. Review this, then Phase 1 begins."
      width="wide"
    >
      {/* ── Direction ─────────────────────────────────────────────────────── */}
      <Section heading="The direction">
        <div className="grid gap-h5 md:grid-cols-3">
          <Card>
            <CardLabel>Feeling</CardLabel>
            <p className="mt-h2 text-h6 text-hearth-ink-2">
              Calm, warm, confident. A high-end hotel in-room tablet, not a SaaS
              dashboard. It hangs in a family home, so it stays quiet when
              nobody is looking at it.
            </p>
          </Card>
          <Card>
            <CardLabel>Method</CardLabel>
            <p className="mt-h2 text-h6 text-hearth-ink-2">
              Typography-led. One typeface, one accent, generous air. Hierarchy
              comes from weight, scale and colour, never from decoration.
            </p>
          </Card>
          <Card>
            <CardLabel>Restraint</CardLabel>
            <p className="mt-h2 text-h6 text-hearth-ink-2">
              No glassmorphism, no gradient soup, no emoji as design, no
              dark-by-default. Motion is felt, not watched.
            </p>
          </Card>
        </div>
      </Section>

      {/* ── Colour ────────────────────────────────────────────────────────── */}
      <Section heading="Colour">
        <p className="mb-h5 max-w-[46rem] text-h6 text-hearth-ink-2">
          A warm neutral ramp carries almost everything. There is exactly one
          accent, ember, and it means &ldquo;this needs a person&rdquo;. Olive
          means done. Nothing else is allowed to introduce a colour.
        </p>

        <div className="mb-h8 grid grid-cols-2 gap-h5 md:grid-cols-4 lg:grid-cols-6">
          <Swatch name="Canvas" hex={COLOR.canvas} note="Page background" />
          <Swatch name="Surface" hex={COLOR.surface} note="Cards" />
          <Swatch name="Sunk" hex={COLOR.sunk} note="Wells, empty states" />
          <Swatch name="Line" hex={COLOR.line} note="Hairlines" />
          <Swatch name="Line strong" hex={COLOR.lineStrong} note="Input borders" />
          <Swatch name="Ink" hex={COLOR.ink} note="Primary text" dark />
          <Swatch name="Ink 2" hex={COLOR.ink2} note="Secondary text" dark />
          <Swatch name="Ink 3" hex={COLOR.ink3} note="Meta, timestamps" dark />
          <Swatch name="Accent" hex={COLOR.accent} note="Ember. Needs a person" dark />
          <Swatch name="Accent soft" hex={COLOR.accentSoft} note="Accent tint" />
          <Swatch name="Done" hex={COLOR.done} note="Olive. Completed" dark />
          <Swatch name="Done soft" hex={COLOR.doneSoft} note="Done tint" />
        </div>

        <Card tone="sunk" elevation="flat">
          <CardLabel>Measured contrast</CardLabel>
          <p className="mt-h2 mb-h4 text-h7 text-hearth-ink-2">
            Every foreground token was checked against every surface it is
            allowed on. WCAG AA needs 4.5:1. The lowest value in the system is{" "}
            <span className="font-semibold text-hearth-ink">4.76:1</span>.
          </p>
          <div className="grid gap-h3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Ink on canvas", CONTRAST.ink.canvas],
              ["Ink on surface", CONTRAST.ink.surface],
              ["Ink 2 on canvas", CONTRAST.ink2.canvas],
              ["Ink 3 on canvas", CONTRAST.ink3.canvas],
              ["Ink 3 on sunk", CONTRAST.ink3.sunk],
              ["Accent on canvas", CONTRAST.accent.canvas],
              ["Accent on soft", CONTRAST.accent.accentSoft],
              ["White on accent", CONTRAST.accent.surface],
              ["Done on surface", CONTRAST.done.surface],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="flex items-baseline justify-between gap-h3 rounded-h-sm bg-hearth-surface px-h4 py-h3"
              >
                <span className="text-h8 text-hearth-ink-2">{label}</span>
                <span className="h-tnum text-h8 font-semibold text-hearth-done">
                  {(value as number).toFixed(2)}:1
                </span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* ── Type ──────────────────────────────────────────────────────────── */}
      <Section heading="Type">
        <p className="mb-h5 max-w-[46rem] text-h6 text-hearth-ink-2">
          One family, Figtree. Humanist enough to feel warm at 128px on a wall,
          plain enough to stay legible at 13px for a reader whose first language
          is not English. I deliberately did not add a display serif: a second
          family would be decoration here, not hierarchy.
        </p>

        <Card elevation="flat" className="divide-y divide-hearth-line">
          {TYPE.map((t) => (
            <div
              key={t.name}
              className="flex flex-wrap items-baseline gap-h4 py-h4 first:pt-0 last:pb-0"
            >
              <span className="h-tnum w-[7rem] shrink-0 text-h9 text-hearth-ink-3">
                {t.name} · {t.px}px
              </span>
              <span
                className="min-w-0 truncate text-hearth-ink"
                style={{
                  fontSize: `${t.px}px`,
                  fontWeight: t.weight,
                  letterSpacing: t.tracking,
                  lineHeight: t.px > 40 ? 1 : 1.3,
                }}
              >
                Today
              </span>
              <span className="ml-auto text-h9 text-hearth-ink-3">{t.use}</span>
            </div>
          ))}
        </Card>

        <Card tone="sunk" elevation="flat" className="mt-h5">
          <CardLabel>Tabular numerals</CardLabel>
          <p className="mt-h2 text-h7 text-hearth-ink-2">
            The clock and every count use lining tabular figures, so digits keep
            their box and nothing shifts as the minute ticks over.
          </p>
          <p className="h-tnum mt-h4 text-h2 font-semibold tracking-[-0.02em] text-hearth-ink">
            18:41
          </p>
        </Card>
      </Section>

      {/* ── Space, radius, elevation ──────────────────────────────────────── */}
      <Section heading="Space, radius, elevation">
        <div className="grid gap-h5 lg:grid-cols-3">
          <Card>
            <CardLabel>Spacing · 4px base</CardLabel>
            <div className="mt-h4 flex flex-col gap-h2">
              {SPACE.map((s) => (
                <div key={s.name} className="flex items-center gap-h3">
                  <span className="h-tnum w-[4rem] shrink-0 text-h9 text-hearth-ink-3">
                    {s.px}px
                  </span>
                  <span
                    className="h-h2 rounded-h-sm bg-hearth-accent/25"
                    style={{ width: `${s.px}px` }}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardLabel>Radius</CardLabel>
            <p className="mt-h2 mb-h4 text-h9 text-hearth-ink-3">
              Soft system. Pills are reserved for badges, so a pill always
              means &ldquo;status&rdquo; and never &ldquo;button&rdquo;.
            </p>
            <div className="flex flex-col gap-h3">
              {RADIUS.map((r) => (
                <div key={r.name} className="flex items-center gap-h3">
                  <span
                    className="size-h10 shrink-0 border border-hearth-line-strong bg-hearth-sunk"
                    style={{ borderRadius: `${r.px}px` }}
                  />
                  <div className="min-w-0">
                    <p className="text-h8 text-hearth-ink">
                      {r.name} · {r.px === 999 ? "full" : `${r.px}px`}
                    </p>
                    <p className="text-h9 text-hearth-ink-3">{r.use}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardLabel>Elevation</CardLabel>
            <p className="mt-h2 mb-h4 text-h9 text-hearth-ink-3">
              Shadows are tinted warm, never pure black. Three steps only.
            </p>
            <div className="flex flex-col gap-h5">
              {SHADOW.map((s) => (
                <div
                  key={s.name}
                  /* Static classes, not a template string — Tailwind scans
                     source text and cannot see an interpolated class name. */
                  className={`rounded-h-md bg-hearth-surface p-h4 ${SHADOW_CLASS[s.name]}`}
                >
                  <p className="text-h8 font-medium text-hearth-ink">{s.name}</p>
                  <p className="text-h9 text-hearth-ink-3">{s.use}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      {/* ── Motion ────────────────────────────────────────────────────────── */}
      <Section heading="Motion">
        <p className="mb-h5 max-w-[46rem] text-h6 text-hearth-ink-2">
          Four durations, two easings. Each one has a job. Anything that cannot
          name its job does not get animated. All of it collapses to static
          under reduced motion.
        </p>
        <Card elevation="flat" className="divide-y divide-hearth-line">
          {MOTION_DOC.map((m) => (
            <div
              key={m.name}
              className="flex flex-wrap items-baseline gap-h4 py-h4 first:pt-0 last:pb-0"
            >
              <span className="w-[6rem] shrink-0 text-h8 font-medium text-hearth-ink">
                {m.name}
              </span>
              <span className="h-tnum w-[5rem] shrink-0 text-h8 text-hearth-ink-3">
                {m.ms}ms
              </span>
              <span className="text-h7 text-hearth-ink-2">{m.use}</span>
            </div>
          ))}
        </Card>
      </Section>

      {/* ── Components ────────────────────────────────────────────────────── */}
      <Section heading="Components">
        <Card elevation="flat">
          <Row label="Button variant">
            <Button icon={<Check size={18} weight="bold" />}>Done</Button>
            <Button variant="secondary" icon={<SkipForward size={18} />}>
              Skip
            </Button>
            <Button variant="quiet">Sign out</Button>
            <Button variant="done" icon={<Check size={18} weight="bold" />}>
              Completed
            </Button>
          </Row>

          <Row label="Button size">
            <Button size="sm">Small · 44px</Button>
            <Button size="md">Medium · 48px</Button>
            <Button size="lg">Large · 60px</Button>
          </Row>

          <Row label="Button state">
            <Button disabled>Disabled</Button>
            <Button
              loading={loading}
              onClick={() => {
                setLoading(true);
                setTimeout(() => setLoading(false), 1400);
              }}
            >
              {loading ? "Saving" : "Tap to load"}
            </Button>
          </Row>

          <Row label="Badge">
            <Badge tone="accent" icon={<Hand size={13} weight="fill" />}>
              Request
            </Badge>
            <Badge tone="done" icon={<Check size={13} weight="bold" />}>
              Done
            </Badge>
            <Badge tone="neutral">6 of 9</Badge>
            <Badge tone="muted">Skipped</Badge>
          </Row>
        </Card>

        <div className="mt-h5 grid gap-h5 md:grid-cols-2">
          <Card>
            <CardLabel>Form controls</CardLabel>
            <div className="mt-h4 flex flex-col gap-h5">
              <Input
                label="Request"
                placeholder="Fresh towels in the guest room"
                hint="Abdullah sees this on his panel straight away."
              />
              <Select
                label="Dinner"
                value={dish}
                onChange={(e) => setDish(e.target.value)}
              >
                <option>Machboos rubyan</option>
                <option>Chicken makhani</option>
                <option>Khoresh sabzy</option>
              </Select>
              <Textarea label="Note" placeholder="Optional" rows={2} />
              <Input
                label="Title"
                defaultValue=""
                error="Give the request a short title."
              />
            </div>
          </Card>

          <div className="flex flex-col gap-h5">
            <Card tone="accent" elevation="e2">
              <div className="flex items-start justify-between gap-h4">
                <div className="min-w-0">
                  <Badge tone="accent" icon={<Hand size={13} weight="fill" />}>
                    Request from Mariam
                  </Badge>
                  <p className="mt-h3 text-h5 font-semibold text-hearth-ink">
                    Fresh towels in the guest room
                  </p>
                  <p className="mt-h1 text-h9 text-hearth-ink-3">Just now</p>
                </div>
              </div>
              <div className="mt-h5 flex gap-h3">
                <Button size="md" icon={<Check size={18} weight="bold" />}>
                  Got it
                </Button>
              </div>
            </Card>

            <Card tone="done">
              <div className="flex items-center gap-h4">
                <Check size={22} weight="bold" className="text-hearth-done" />
                <div className="min-w-0">
                  <p className="text-h5 font-semibold text-hearth-ink line-through decoration-hearth-ink-3/40">
                    Water the garden
                  </p>
                  <p className="text-h9 text-hearth-ink-3">Done at 07:12</p>
                </div>
              </div>
            </Card>

            <Card tone="sunk" elevation="flat">
              <div className="flex flex-col items-center gap-h3 py-h6 text-center">
                <Sun size={28} className="text-hearth-ink-3" />
                <p className="text-h6 font-medium text-hearth-ink">
                  Nothing left today
                </p>
                <p className="max-w-[22rem] text-h8 text-hearth-ink-3">
                  Every task is finished. The empty state is a reward, not a
                  blank page.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </Section>

      {/* ── Applied ───────────────────────────────────────────────────────── */}
      <Section heading="Applied: what the surfaces will feel like">
        <div className="grid gap-h5 lg:grid-cols-[1.2fr_1fr]">
          <Card elevation="e2" className="overflow-hidden">
            <CardLabel>Dashboard fragment · read at 2 metres</CardLabel>
            <div className="mt-h5">
              <p className="h-tnum text-h1 font-semibold leading-none tracking-[-0.03em] text-hearth-ink">
                18:41
              </p>
              <p className="mt-h3 text-h4 text-hearth-ink-2">
                Saturday, 25 July
              </p>
            </div>

            <div className="mt-h10 grid gap-h6 sm:grid-cols-2">
              <div>
                <CardLabel>Today</CardLabel>
                <p className="mt-h2 flex items-baseline gap-h2">
                  <span className="h-tnum text-h2 font-semibold tracking-[-0.02em] text-hearth-ink">
                    6
                  </span>
                  <span className="text-h4 text-hearth-ink-3">of 9</span>
                </p>
                {/* Progress reads as a filled arc of the accent on a hairline
                    track, not a heavy dashboard bar. */}
                <div
                  className="mt-h4 h-h2 w-full overflow-hidden rounded-h-pill bg-hearth-sunk"
                  role="progressbar"
                  aria-valuenow={6}
                  aria-valuemin={0}
                  aria-valuemax={9}
                  aria-label="Tasks completed today"
                >
                  <div
                    className="h-full rounded-h-pill bg-hearth-accent"
                    style={{ width: `${(6 / 9) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <CardLabel>Dinner</CardLabel>
                <p className="mt-h2 flex items-start gap-h3">
                  <ForkKnife
                    size={26}
                    className="mt-h1 shrink-0 text-hearth-ink-3"
                  />
                  <span className="text-h4 font-medium text-hearth-ink">
                    Machboos rubyan
                  </span>
                </p>
              </div>
            </div>
          </Card>

          <Card elevation="e2">
            <CardLabel>Staff panel fragment · one-handed on a tablet</CardLabel>
            <ul className="mt-h5 flex flex-col gap-h4">
              {[
                { title: "Water the garden", win: "07:00 - 08:00" },
                { title: "Wash the cars", win: "09:00 - 11:00" },
              ].map((t) => (
                <li
                  key={t.title}
                  className="rounded-h-md border border-hearth-line bg-hearth-surface p-h5"
                >
                  <p className="text-h5 font-semibold text-hearth-ink">
                    {t.title}
                  </p>
                  <p className="h-tnum mt-h1 text-h8 text-hearth-ink-3">
                    {t.win}
                  </p>
                  <div className="mt-h4 flex gap-h3">
                    <Button
                      size="lg"
                      icon={<Check size={20} weight="bold" />}
                      className="flex-1"
                    >
                      Done
                    </Button>
                    <Button
                      size="lg"
                      variant="secondary"
                      icon={<SkipForward size={20} />}
                    >
                      Skip
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-h5 flex items-center gap-h2 text-h9 text-hearth-ink-3">
              <ArrowCounterClockwise size={14} />
              Icons carry the meaning, the word confirms it. Every target
              clears 48px.
            </p>
          </Card>
        </div>
      </Section>

      <p className="mt-h16 border-t border-hearth-line pt-h6 text-h8 text-hearth-ink-3">
        Phase 0. Tokens and base components only. No real page has been
        touched yet.
      </p>
    </PageShell>
  );
}
