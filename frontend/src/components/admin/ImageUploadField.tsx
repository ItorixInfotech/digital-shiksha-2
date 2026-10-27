import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImageUp, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPost, ApiError } from "@/lib/api";
import type { MediaOut } from "@/lib/types";

/** Image field for admin forms: upload a file (stored by the API at /api/media/{id}) or paste a link, with a preview. */
export default function ImageUploadField({ value, onChange, testid }: { value: string; onChange: (v: string) => void; testid: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.size > 3 * 1024 * 1024) return toast.error("Image must be 3 MB or smaller");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiPost<MediaOut>("/admin/media", fd);
      onChange(res.url);
      toast.success("Logo uploaded — save the college to apply it");
    } catch (e) {
      const detail = e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body ? String((e.body as { detail: unknown }).detail) : "";
      toast.error(detail || "Upload failed. Please try another image.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center" data-testid={`${testid}-wrap`}>
      <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white p-2">
        {value ? <img src={value} alt="Logo preview" className="max-h-full max-w-full object-contain" data-testid={`${testid}-preview`} />
          : <span className="text-center text-[11px] text-slate-400">No logo</span>}
      </div>
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" data-testid={`${testid}-file`}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()} data-testid={`${testid}-upload-button`}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />} {value ? "Replace logo" : "Upload logo"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")} data-testid={`${testid}-remove-button`}>
              <X className="size-4" /> Remove
            </Button>
          )}
        </div>
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="…or paste an image link (https://… or /logos/…)" data-testid={testid} />
      </div>
    </div>
  );
}
