import type { CSSProperties } from "react";
import { CheckCircle2, Mail, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProposalContent, ProposalLayout, ProposalSection } from "@/lib/proposal-types";
import "./proposal.css";

type ProposalClient = { companyName: string; color: string };

export function ProposalDocument({
  client,
  layout,
  content,
  mode,
}: {
  client: ProposalClient;
  layout: ProposalLayout;
  content: ProposalContent;
  mode: "view" | "print";
}) {
  const sections = content.sections;

  return (
    <div
      className={cn("proposal-root", mode === "print" ? "proposal-root--print" : "proposal-root--view")}
      data-layout={layout}
      style={{ "--brand": client.color } as unknown as CSSProperties}
    >
      {sections.map((section) => (
        <div key={section.id} className="proposal-page flex flex-col p-14">
          <SectionBody section={section} client={client} />
        </div>
      ))}
    </div>
  );
}

function SectionBody({ section, client }: { section: ProposalSection; client: ProposalClient }) {
  switch (section.type) {
    case "COVER":
      return (
        <div className="proposal-gradient -m-14 flex flex-1 flex-col justify-between p-14 text-white">
          <div className="flex items-center gap-2 text-sm font-medium tracking-wide text-white/80">
            <Sparkles className="size-4" /> PRMOTE
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/70">Proposal</p>
            <h1 className="mt-4 text-5xl font-semibold leading-tight text-balance">{section.heading || client.companyName}</h1>
            {section.subheading && <p className="mt-4 text-lg text-white/85">{section.subheading}</p>}
          </div>
          <div className="flex items-center justify-between text-sm text-white/70">
            <span>{client.companyName}</span>
            {section.date && <span>{section.date}</span>}
          </div>
        </div>
      );

    case "TEXT":
      return (
        <div className="flex flex-1 flex-col justify-center gap-6">
          {section.heading && <h2 className="text-3xl font-semibold text-slate-900">{section.heading}</h2>}
          <p className="whitespace-pre-wrap text-lg leading-relaxed text-slate-600">{section.body}</p>
        </div>
      );

    case "SERVICES":
      return (
        <div className="flex flex-1 flex-col justify-center gap-8">
          {section.heading && <h2 className="text-3xl font-semibold text-slate-900">{section.heading}</h2>}
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {section.items.map((item, i) => (
              <li key={i} className="proposal-chip flex items-start gap-3 rounded-2xl px-5 py-4 text-base font-medium">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      );

    case "PRICING":
      return (
        <div className="flex flex-1 flex-col justify-center gap-8">
          {section.heading && <h2 className="text-3xl font-semibold text-slate-900">{section.heading}</h2>}
          <div className="proposal-accent-border overflow-hidden rounded-2xl border">
            {section.items.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center justify-between gap-4 px-6 py-5",
                  i % 2 === 1 && "bg-slate-50"
                )}
              >
                <div>
                  <p className="font-medium text-slate-900">{item.label}</p>
                  {item.note && <p className="text-sm text-slate-500">{item.note}</p>}
                </div>
                <p className="text-lg font-semibold text-slate-900">{item.price}</p>
              </div>
            ))}
          </div>
          {section.total && (
            <div className="flex items-center justify-between rounded-2xl bg-slate-900 px-6 py-5 text-white">
              <span className="text-sm font-medium uppercase tracking-wide text-white/70">Total investment</span>
              <span className="text-2xl font-semibold text-white">{section.total}</span>
            </div>
          )}
        </div>
      );

    case "TIMELINE":
      return (
        <div className="flex flex-1 flex-col justify-center gap-8">
          {section.heading && <h2 className="text-3xl font-semibold text-slate-900">{section.heading}</h2>}
          <ol className="flex flex-col gap-6">
            {section.steps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <div className="proposal-gradient flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white">
                  {i + 1}
                </div>
                <div>
                  <p className="text-lg font-medium text-slate-900">{step.title}</p>
                  {step.detail && <p className="text-slate-600">{step.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      );

    case "CLOSING":
      return (
        <div className="flex flex-1 flex-col justify-center gap-8">
          {section.heading && <h2 className="text-3xl font-semibold text-slate-900">{section.heading}</h2>}
          {section.body && <p className="whitespace-pre-wrap text-lg leading-relaxed text-slate-600">{section.body}</p>}
          {(section.contactName || section.contactEmail) && (
            <div className="proposal-chip mt-4 flex flex-col gap-2 rounded-2xl px-6 py-5 text-base">
              {section.contactName && (
                <span className="flex items-center gap-2 font-medium">
                  <User className="size-4" /> {section.contactName}
                </span>
              )}
              {section.contactEmail && (
                <span className="flex items-center gap-2">
                  <Mail className="size-4" /> {section.contactEmail}
                </span>
              )}
            </div>
          )}
        </div>
      );
  }
}
