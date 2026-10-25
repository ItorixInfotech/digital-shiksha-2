import { useMemo, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { isHtml, sanitize } from "@/lib/richtext";

/** Shows admin content: editor HTML (sanitised) or legacy plain text split into paragraphs. Internal links stay in-app. */
export default function RichText({ value, className, testid }: { value: string; className?: string; testid: string }) {
  const nav = useNavigate();
  const html = useMemo(() => (isHtml(value) ? sanitize(value) : null), [value]);
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest("a");
    const href = a?.getAttribute("href") ?? "";
    if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey || !href.startsWith("/")) return;
    e.preventDefault();
    nav(href);
  };
  if (html !== null) {
    return <div className={cn("rich-content", className)} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} data-testid={testid} />;
  }
  return (
    <div className={cn("rich-content", className)} data-testid={testid}>
      {value.split(/\n\s*\n/).filter((p) => p.trim()).map((p, i) => <p key={`${i}-${p.slice(0, 24)}`}>{p}</p>)}
    </div>
  );
}
