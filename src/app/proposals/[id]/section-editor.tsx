"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SECTION_TYPE_META, createSection, type ProposalSection, type ProposalSectionType } from "@/lib/proposal-types";

const SECTION_TYPES = Object.keys(SECTION_TYPE_META) as ProposalSectionType[];

export function SectionListEditor({
  sections,
  onChange,
}: {
  sections: ProposalSection[];
  onChange: (sections: ProposalSection[]) => void;
}) {
  function update(index: number, next: ProposalSection) {
    onChange(sections.map((s, i) => (i === index ? next : s)));
  }
  function remove(index: number) {
    onChange(sections.filter((_, i) => i !== index));
  }
  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  function add(type: ProposalSectionType) {
    onChange([...sections, createSection(type)]);
  }

  return (
    <div className="space-y-4">
      {sections.map((section, i) => (
        <Card key={section.id} className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{SECTION_TYPE_META[section.type].label}</Badge>
              <span className="text-xs text-muted-foreground">Page {i + 1}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="size-7" disabled={i === 0} onClick={() => move(i, -1)}>
                <ChevronUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={i === sections.length - 1}
                onClick={() => move(i, 1)}
              >
                <ChevronDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => remove(i)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
          <SectionFields section={section} onChange={(next) => update(i, next)} />
        </Card>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline">
            <Plus /> Add section
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {SECTION_TYPES.map((type) => (
            <DropdownMenuItem key={type} onClick={() => add(type)}>
              <div>
                <p className="font-medium">{SECTION_TYPE_META[type].label}</p>
                <p className="text-xs text-muted-foreground">{SECTION_TYPE_META[type].description}</p>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SectionFields({ section, onChange }: { section: ProposalSection; onChange: (s: ProposalSection) => void }) {
  switch (section.type) {
    case "COVER":
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Heading" className="col-span-2">
            <Input value={section.heading} onChange={(e) => onChange({ ...section, heading: e.target.value })} />
          </Field>
          <Field label="Subheading" className="col-span-2">
            <Input value={section.subheading} onChange={(e) => onChange({ ...section, subheading: e.target.value })} />
          </Field>
          <Field label="Date">
            <Input value={section.date} onChange={(e) => onChange({ ...section, date: e.target.value })} placeholder="e.g. 16 August 2026" />
          </Field>
        </div>
      );

    case "TEXT":
      return (
        <div className="space-y-3">
          <Field label="Heading">
            <Input value={section.heading} onChange={(e) => onChange({ ...section, heading: e.target.value })} />
          </Field>
          <Field label="Body">
            <Textarea rows={5} value={section.body} onChange={(e) => onChange({ ...section, body: e.target.value })} />
          </Field>
        </div>
      );

    case "SERVICES":
      return (
        <div className="space-y-3">
          <Field label="Heading">
            <Input value={section.heading} onChange={(e) => onChange({ ...section, heading: e.target.value })} />
          </Field>
          <ListEditor
            label="Items"
            items={section.items}
            onChange={(items) => onChange({ ...section, items })}
            renderRow={(item, onRowChange) => <Input value={item} onChange={(e) => onRowChange(e.target.value)} placeholder="e.g. Monthly content shoot" />}
            newItem={() => ""}
          />
        </div>
      );

    case "PRICING":
      return (
        <div className="space-y-3">
          <Field label="Heading">
            <Input value={section.heading} onChange={(e) => onChange({ ...section, heading: e.target.value })} />
          </Field>
          <ListEditor
            label="Line items"
            items={section.items}
            onChange={(items) => onChange({ ...section, items })}
            renderRow={(item, onRowChange) => (
              <div className="grid flex-1 grid-cols-3 gap-2">
                <Input value={item.label} onChange={(e) => onRowChange({ ...item, label: e.target.value })} placeholder="Label" />
                <Input value={item.price} onChange={(e) => onRowChange({ ...item, price: e.target.value })} placeholder="£1,500" />
                <Input value={item.note} onChange={(e) => onRowChange({ ...item, note: e.target.value })} placeholder="Note (optional)" />
              </div>
            )}
            newItem={() => ({ label: "", price: "", note: "" })}
          />
          <Field label="Total">
            <Input value={section.total} onChange={(e) => onChange({ ...section, total: e.target.value })} placeholder="£1,500" />
          </Field>
        </div>
      );

    case "TIMELINE":
      return (
        <div className="space-y-3">
          <Field label="Heading">
            <Input value={section.heading} onChange={(e) => onChange({ ...section, heading: e.target.value })} />
          </Field>
          <ListEditor
            label="Steps"
            items={section.steps}
            onChange={(steps) => onChange({ ...section, steps })}
            renderRow={(step, onRowChange) => (
              <div className="grid flex-1 grid-cols-2 gap-2">
                <Input value={step.title} onChange={(e) => onRowChange({ ...step, title: e.target.value })} placeholder="Title" />
                <Input value={step.detail} onChange={(e) => onRowChange({ ...step, detail: e.target.value })} placeholder="Detail (optional)" />
              </div>
            )}
            newItem={() => ({ title: "", detail: "" })}
          />
        </div>
      );

    case "CLOSING":
      return (
        <div className="space-y-3">
          <Field label="Heading">
            <Input value={section.heading} onChange={(e) => onChange({ ...section, heading: e.target.value })} />
          </Field>
          <Field label="Body">
            <Textarea rows={3} value={section.body} onChange={(e) => onChange({ ...section, body: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact name">
              <Input value={section.contactName} onChange={(e) => onChange({ ...section, contactName: e.target.value })} />
            </Field>
            <Field label="Contact email">
              <Input value={section.contactEmail} onChange={(e) => onChange({ ...section, contactEmail: e.target.value })} />
            </Field>
          </div>
        </div>
      );
  }
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ListEditor<T>({
  label,
  items,
  onChange,
  renderRow,
  newItem,
}: {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  renderRow: (item: T, onRowChange: (next: T) => void) => React.ReactNode;
  newItem: () => T;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            {renderRow(item, (next) => onChange(items.map((it, idx) => (idx === i ? next : it))))}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, newItem()])}>
        <Plus /> Add row
      </Button>
    </div>
  );
}
