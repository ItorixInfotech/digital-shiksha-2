import { useMemo, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Extension } from "@tiptap/react";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import { toast } from "sonner";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { TableKit } from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Anchor, Baseline, Bold, Highlighter, ImagePlus, IndentDecrease, IndentIncrease,
  Italic, Link2, List, ListChecks, ListOrdered, Mail, Phone, Strikethrough, Table2, Unlink, Youtube as YoutubeIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toEditorHtml } from "@/lib/richtext";

/** id="" on paragraphs/headings so "#anchor" links can jump to them. */
const AnchorId = Extension.create({
  name: "anchorId",
  addGlobalAttributes() {
    return [{
      types: ["paragraph", "heading"],
      attributes: { id: { default: null, parseHTML: (el) => el.getAttribute("id"), renderHTML: (a) => (a.id ? { id: a.id } : {}) } },
    }];
  },
});

const SWATCHES = ["#0f172a", "#475569", "#b91c1c", "#c2410c", "#a16207", "#15803d", "#0e7490", "#1d4ed8", "#7e22ce", "#be185d", "#ffffff"];
const BG_SWATCHES = ["#fef9c3", "#dcfce7", "#dbeafe", "#fce7f3", "#ffedd5", "#fee2e2", "#e0e7ff", "#f1f5f9"];
const SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "40px"];
type LinkKind = "url" | "email" | "phone" | "anchor";
type Modal = { kind: "link"; type: LinkKind } | { kind: "anchor" } | { kind: "image" } | { kind: "youtube" } | null;

function Tb({ on, title, onClick, children, testid, disabled }: { on?: boolean; title: string; onClick: () => void; children: ReactNode; testid: string; disabled?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={on} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className={cn("grid size-8 place-items-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40",
        on && "bg-brand-navy/10 text-brand-navy")} data-testid={testid}>
      {children}
    </button>
  );
}
const Sep = () => <span className="mx-1 h-6 w-px bg-slate-200" aria-hidden />;

function ColorPick({ title, icon, colors, current, onPick, onClear, testid }: { title: string; icon: ReactNode; colors: string[]; current?: string; onPick: (c: string) => void; onClear: () => void; testid: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<button type="button" title={title} aria-label={title} className="relative grid size-8 place-items-center rounded-md text-slate-600 hover:bg-slate-100" data-testid={testid} />}>
        {icon}<span className="absolute inset-x-2 bottom-1 h-0.5 rounded" style={{ background: current || "transparent" }} />
      </PopoverTrigger>
      <PopoverContent className="w-56 space-y-2 p-3" align="start" finalFocus={false}>
        <p className="text-xs font-semibold text-slate-500">{title}</p>
        <div className="grid grid-cols-6 gap-1.5">
          {colors.map((c) => <button key={c} type="button" title={c} onClick={() => { onPick(c); setOpen(false); }} className="size-7 rounded-md border border-slate-200 transition-transform hover:scale-110" style={{ background: c }} data-testid={`${testid}-${c.slice(1)}`} />)}
          <input type="color" title="Custom colour" aria-label="Custom colour" onChange={(e) => onPick(e.target.value)} className="size-7 cursor-pointer rounded-md border border-slate-200 bg-white p-0.5" data-testid={`${testid}-custom`} />
        </div>
        <button type="button" onClick={() => { onClear(); setOpen(false); }} className="text-xs font-medium text-slate-500 hover:text-slate-900" data-testid={`${testid}-clear`}>Remove colour</button>
      </PopoverContent>
    </Popover>
  );
}

const LINK_LABEL: Record<LinkKind, { title: string; label: string; placeholder: string }> = {
  url: { title: "Insert / edit link", label: "Page or website address", placeholder: "/colleges/coep-pune or https://example.com" },
  email: { title: "Insert email link", label: "Email address", placeholder: "admissions@digitalshiksha.in" },
  phone: { title: "Insert telephone link", label: "Phone number", placeholder: "+91 81496 89468" },
  anchor: { title: "Link to an anchor on this page", label: "Anchor name", placeholder: "fees" },
};

function hrefFor(type: LinkKind, v: string): string {
  const s = v.trim();
  if (type === "email") return `mailto:${s.replace(/^mailto:/i, "")}`;
  if (type === "phone") return `tel:${s.replace(/^tel:/i, "").replace(/[^\d+]/g, "")}`;
  if (type === "anchor") return `#${s.replace(/^#/, "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;
  if (/^(https?:|\/|#)/i.test(s)) return s;
  return /^[\w-]+(\.[\w-]+)+/.test(s) ? `https://${s}` : `/${s}`;
}
const kindOf = (href: string): LinkKind => (href.startsWith("mailto:") ? "email" : href.startsWith("tel:") ? "phone" : href.startsWith("#") ? "anchor" : "url");
const shownValue = (href: string) => href.replace(/^(mailto:|tel:|#)/, "");

function Toolbar({ editor, open, testid }: { editor: Editor; open: (m: Modal) => void; testid: string }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: ([1, 2, 3, 4, 5, 6] as const).find((l) => e.isActive("heading", { level: l })) ?? 0,
      bold: e.isActive("bold"), italic: e.isActive("italic"), strike: e.isActive("strike"),
      align: (["left", "center", "right", "justify"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left",
      bullet: e.isActive("bulletList"), ordered: e.isActive("orderedList"), task: e.isActive("taskList"),
      link: e.isActive("link"), table: e.isActive("table"),
      size: (e.getAttributes("textStyle").fontSize as string | undefined) ?? "",
      color: e.getAttributes("textStyle").color as string | undefined,
      bg: e.getAttributes("textStyle").backgroundColor as string | undefined,
      canSink: e.can().sinkListItem("listItem") || e.can().sinkListItem("taskItem"),
      canLift: e.can().liftListItem("listItem") || e.can().liftListItem("taskItem"),
    }),
  });
  const c = () => editor.chain().focus();
  const item = editor.isActive("taskList") ? "taskItem" : "listItem";
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-slate-50/95 p-1.5 backdrop-blur" data-testid={`${testid}-toolbar`}>
      <select value={s.block} onChange={(e) => { const l = Number(e.target.value); if (l) c().setHeading({ level: l as 1 | 2 | 3 | 4 | 5 | 6 }).run(); else c().setParagraph().run(); }}
        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm" aria-label="Text style" data-testid={`${testid}-block-select`}>
        <option value={0}>Paragraph</option>
        {[1, 2, 3, 4, 5, 6].map((l) => <option key={l} value={l} label={`Heading ${l}`} />)}
      </select>
      <select value={s.size} onChange={(e) => (e.target.value ? c().setFontSize(e.target.value).run() : c().unsetFontSize().run())}
        className="ml-1 h-8 w-[84px] rounded-md border border-slate-200 bg-white px-2 text-sm" aria-label="Font size" data-testid={`${testid}-size-select`}>
        <option value="">Size</option>
        {SIZES.map((z) => <option key={z} value={z} label={z.replace("px", "")} />)}
      </select>
      <Sep />
      <Tb title="Bold (Ctrl+B)" on={s.bold} onClick={() => c().toggleBold().run()} testid={`${testid}-bold`}><Bold className="size-4" /></Tb>
      <Tb title="Italic (Ctrl+I)" on={s.italic} onClick={() => c().toggleItalic().run()} testid={`${testid}-italic`}><Italic className="size-4" /></Tb>
      <Tb title="Strikethrough" on={s.strike} onClick={() => c().toggleStrike().run()} testid={`${testid}-strike`}><Strikethrough className="size-4" /></Tb>
      <ColorPick title="Text colour" icon={<Baseline className="size-4" />} colors={SWATCHES} current={s.color} onPick={(v) => c().setColor(v).run()} onClear={() => c().unsetColor().run()} testid={`${testid}-color`} />
      <ColorPick title="Background colour" icon={<Highlighter className="size-4" />} colors={BG_SWATCHES} current={s.bg} onPick={(v) => c().setBackgroundColor(v).run()} onClear={() => c().unsetBackgroundColor().run()} testid={`${testid}-bg`} />
      <Sep />
      {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight], ["justify", AlignJustify]] as const).map(([a, Icon]) => (
        <Tb key={a} title={`Align ${a}`} on={s.align === a} onClick={() => c().setTextAlign(a).run()} testid={`${testid}-align-${a}`}><Icon className="size-4" /></Tb>
      ))}
      <Sep />
      <Tb title="Bulleted list" on={s.bullet} onClick={() => c().toggleBulletList().run()} testid={`${testid}-bullet-list`}><List className="size-4" /></Tb>
      <Tb title="Numbered list" on={s.ordered} onClick={() => c().toggleOrderedList().run()} testid={`${testid}-ordered-list`}><ListOrdered className="size-4" /></Tb>
      <Tb title="Checklist" on={s.task} onClick={() => c().toggleTaskList().run()} testid={`${testid}-task-list`}><ListChecks className="size-4" /></Tb>
      <Tb title="Nest list item (Tab)" disabled={!s.canSink} onClick={() => c().sinkListItem(item).run()} testid={`${testid}-indent`}><IndentIncrease className="size-4" /></Tb>
      <Tb title="Un-nest list item (Shift+Tab)" disabled={!s.canLift} onClick={() => c().liftListItem(item).run()} testid={`${testid}-outdent`}><IndentDecrease className="size-4" /></Tb>
      <Sep />
      <Tb title={s.link ? "Edit link" : "Insert link"} on={s.link} onClick={() => open({ kind: "link", type: s.link ? kindOf(String(editor.getAttributes("link").href ?? "")) : "url" })} testid={`${testid}-link`}><Link2 className="size-4" /></Tb>
      <Tb title="Insert email link" onClick={() => open({ kind: "link", type: "email" })} testid={`${testid}-email-link`}><Mail className="size-4" /></Tb>
      <Tb title="Insert telephone link" onClick={() => open({ kind: "link", type: "phone" })} testid={`${testid}-phone-link`}><Phone className="size-4" /></Tb>
      <Tb title="Remove link" disabled={!s.link} onClick={() => c().extendMarkRange("link").unsetLink().run()} testid={`${testid}-unlink`}><Unlink className="size-4" /></Tb>
      <Tb title="Add anchor here (or link to one)" onClick={() => open({ kind: "anchor" })} testid={`${testid}-anchor`}><Anchor className="size-4" /></Tb>
      <Sep />
      <DropdownMenu>
        <DropdownMenuTrigger render={<button type="button" title="Table" aria-label="Table" className={cn("flex h-8 items-center gap-1 rounded-md px-2 text-sm text-slate-600 hover:bg-slate-100", s.table && "bg-brand-navy/10 text-brand-navy")} data-testid={`${testid}-table-menu`} />}>
          <Table2 className="size-4" /> Table
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52" finalFocus={false}>
          <DropdownMenuItem onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} data-testid={`${testid}-table-insert`}>Insert table (3 × 3)</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!s.table} onClick={() => c().addRowAfter().run()} data-testid={`${testid}-table-add-row`}>Add row below</DropdownMenuItem>
          <DropdownMenuItem disabled={!s.table} onClick={() => c().addRowBefore().run()} data-testid={`${testid}-table-add-row-above`}>Add row above</DropdownMenuItem>
          <DropdownMenuItem disabled={!s.table} onClick={() => c().deleteRow().run()} data-testid={`${testid}-table-delete-row`}>Delete row</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!s.table} onClick={() => c().addColumnAfter().run()} data-testid={`${testid}-table-add-col`}>Add column right</DropdownMenuItem>
          <DropdownMenuItem disabled={!s.table} onClick={() => c().addColumnBefore().run()} data-testid={`${testid}-table-add-col-left`}>Add column left</DropdownMenuItem>
          <DropdownMenuItem disabled={!s.table} onClick={() => c().deleteColumn().run()} data-testid={`${testid}-table-delete-col`}>Delete column</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!s.table} onClick={() => c().toggleHeaderRow().run()} data-testid={`${testid}-table-header`}>Toggle header row</DropdownMenuItem>
          <DropdownMenuItem disabled={!s.table} onClick={() => c().deleteTable().run()} className="text-red-600" data-testid={`${testid}-table-delete`}>Delete table</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tb title="Insert image" onClick={() => open({ kind: "image" })} testid={`${testid}-image`}><ImagePlus className="size-4" /></Tb>
      <Tb title="Embed YouTube video" onClick={() => open({ kind: "youtube" })} testid={`${testid}-youtube`}><YoutubeIcon className="size-4" /></Tb>
    </div>
  );
}

/** After inserting an image/video, put the caret after it so the next insert doesn't replace the selected block. */
/** Overlays animate out for ~200ms and may hold focus meanwhile; hand it back to the editor once they're gone. */
const refocus = (editor: Editor) => window.setTimeout(() => { if (!editor.isDestroyed) editor.commands.focus(); }, 220);

const caretAfter = ({ tr }: { tr: Transaction }) => {
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(tr.selection.to, tr.doc.content.size)), 1));
  return true;
};

function InsertDialog({ editor, modal, close, testid }: { editor: Editor; modal: Exclude<Modal, null>; close: () => void; testid: string }) {
  const href = String(editor.getAttributes("link").href ?? "");
  const editingLink = modal.kind === "link" && editor.isActive("link") && kindOf(href) === modal.type;
  const [a, setA] = useState(() => (modal.kind === "link" && editingLink ? shownValue(href) : modal.kind === "anchor" ? String(editor.getAttributes(editor.isActive("heading") ? "heading" : "paragraph").id ?? "") : ""));
  const [b, setB] = useState(() => (modal.kind === "link" && editingLink ? !!editor.getAttributes("link").target : modal.kind === "link" && modal.type === "url"));
  const [label, setLabel] = useState("");
  const empty = editor.state.selection.empty;
  const meta = modal.kind === "link" ? LINK_LABEL[modal.type]
    : modal.kind === "anchor" ? { title: "Add anchor", label: "Anchor name for the current paragraph / heading", placeholder: "fees" }
    : modal.kind === "image" ? { title: "Insert image", label: "Image address (URL)", placeholder: "https://…/campus.jpg" }
    : { title: "Embed YouTube video", label: "YouTube video link", placeholder: "https://www.youtube.com/watch?v=…" };

  const apply = () => {
    const v = a.trim();
    const ch = editor.chain().focus();
    if (modal.kind === "link") {
      if (!v) { ch.extendMarkRange("link").unsetLink().run(); return close(); }
      const h = hrefFor(modal.type, v);
      const ext = /^https?:/i.test(h);
      const attrs = { href: h, target: ext && b ? "_blank" : null };
      // trailing plain space so the cursor (and further typing) ends up outside the new link
      if (empty && !editor.isActive("link")) ch.insertContent([{ type: "text", text: label.trim() || v, marks: [{ type: "link", attrs }] }, { type: "text", text: " " }]).run();
      else ch.extendMarkRange("link").setLink(attrs).run();
    } else if (modal.kind === "anchor") {
      const id = v.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || null;
      ch.updateAttributes(editor.isActive("heading") ? "heading" : "paragraph", { id }).run();
    } else if (modal.kind === "image") {
      if (v) ch.setImage({ src: v, alt: label.trim() || undefined }).command(caretAfter).run();
    } else if (v) {
      if (!ch.setYoutubeVideo({ src: v }).command(caretAfter).run()) { toast.error("That doesn't look like a YouTube video link"); return; }
    }
    close();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="sm:max-w-md" finalFocus={false} data-testid={`${testid}-dialog`}>
        <DialogHeader><DialogTitle>{editingLink ? "Edit link" : meta.title}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); apply(); }}>
          <div className="space-y-1.5">
            <Label htmlFor={`${testid}-dialog-value`}>{meta.label}</Label>
            <Input id={`${testid}-dialog-value`} autoFocus value={a} onChange={(e) => setA(e.target.value)} placeholder={meta.placeholder} data-testid={`${testid}-dialog-value`} />
            {modal.kind === "link" && modal.type === "url" && <p className="text-xs text-slate-500">Start with / for a page on this site (internal link) or https:// for another website.</p>}
            {modal.kind === "anchor" && <p className="text-xs text-slate-500">Then link to it from anywhere with the link button → #{a.trim() || "name"}.</p>}
          </div>
          {((modal.kind === "link" && empty && !editor.isActive("link")) || modal.kind === "image") && (
            <div className="space-y-1.5">
              <Label htmlFor={`${testid}-dialog-label`}>{modal.kind === "image" ? "Alt text (describes the image for Google)" : "Text to show"}</Label>
              <Input id={`${testid}-dialog-label`} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={modal.kind === "image" ? "COEP Pune main building" : "Leave empty to show the address"} data-testid={`${testid}-dialog-label`} />
            </div>
          )}
          {modal.kind === "link" && modal.type === "url" && (
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={b} onCheckedChange={(v) => setB(v === true)} data-testid={`${testid}-dialog-new-tab`} /> Open external websites in a new tab</label>
          )}
          <DialogFooter>
            {editingLink && <Button type="button" variant="outline" className="text-red-600" onClick={() => { editor.chain().focus().extendMarkRange("link").unsetLink().run(); close(); }} data-testid={`${testid}-dialog-remove`}>Remove link</Button>}
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="submit" className="bg-brand-navy text-white hover:bg-brand-blue" data-testid={`${testid}-dialog-apply`}>{editingLink ? "Update" : "Insert"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const EXTENSIONS = [
  StarterKit.configure({ link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: null } } }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  TextStyleKit.configure({ fontFamily: false, lineHeight: false }),
  TableKit.configure({ table: { resizable: false } }),
  TaskList, TaskItem.configure({ nested: true }),
  Image.configure({ HTMLAttributes: { loading: "lazy" } }),
  Youtube.configure({ nocookie: true, modestBranding: true, width: 640, height: 360 }),
  AnchorId,
];

/** WordPress-style editor for long admin fields. Emits HTML ("" when empty); accepts legacy plain text. */
export default function RichTextEditor({ value, onChange, testid, minHeight = 220 }: { value: string; onChange: (html: string) => void; testid: string; minHeight?: number }) {
  const [modal, setModal] = useState<Modal>(null);
  // Options must be referentially stable: TipTap re-applies changed options on every render, which resets the caret.
  const [initial] = useState(() => toEditorHtml(value));
  const editorProps = useMemo(() => ({ attributes: { class: "rich-content rich-editor px-4 py-3 focus:outline-none", style: `min-height:${minHeight}px`, "data-testid": `${testid}-content` } }), [minHeight, testid]);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const editor = useEditor({
    immediatelyRender: true,
    extensions: EXTENSIONS,
    content: initial,
    editorProps,
    onUpdate: ({ editor: e }) => onChangeRef.current(e.isEmpty ? "" : e.getHTML()),
  });
  if (!editor) return null;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm focus-within:border-brand-navy/40 focus-within:ring-2 focus-within:ring-brand-navy/10" data-testid={testid}>
      <Toolbar editor={editor} open={setModal} testid={testid} />
      <div className="max-h-[60vh] overflow-y-auto"><EditorContent editor={editor} /></div>
      {modal && <InsertDialog key={JSON.stringify(modal)} editor={editor} modal={modal} close={() => { setModal(null); refocus(editor); }} testid={testid} />}
    </div>
  );
}
