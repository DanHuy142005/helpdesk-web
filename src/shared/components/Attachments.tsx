import { useEffect, useRef, useState } from "react";
import { FileText, Paperclip, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authenticatedUrl, useWrite } from "../api/client";
import type { ApiAttachment } from "../api/types";

export function AttachmentPicker({
  files,
  onChange,
  disabled = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<{ file: File; url: string | null }[]>([]);
  useEffect(() => {
    const items = files.map((file) => ({
      file,
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }));
    setPreviews(items);
    return () =>
      items.forEach((item) => {
        if (item.url) URL.revokeObjectURL(item.url);
      });
  }, [files]);
  function add(incoming: File[]) {
    if (disabled) return;
    const next = [...files];
    for (const file of incoming) {
      if (!["image/png", "image/jpeg", "application/pdf", "text/plain"].includes(file.type)) {
        toast.error(`${file.name}: chỉ nhận PNG, JPG, PDF hoặc TXT.`);
        continue;
      }
      if (file.size === 0 || file.size > 5242880) {
        toast.error(`${file.name}: dung lượng phải từ 1 byte đến 5 MB.`);
        continue;
      }
      if (
        next.some(
          (item) =>
            item.name === file.name &&
            item.size === file.size &&
            item.lastModified === file.lastModified,
        )
      )
        continue;
      if (next.length === 10) {
        toast.error("Chỉ được đính kèm tối đa 10 tệp mỗi lần.");
        break;
      }
      next.push(file);
    }
    onChange(next);
  }
  return (
    <section aria-label="Đính kèm ảnh và tệp" className="space-y-3">
      <h3 className="text-sm font-semibold">Ảnh chụp màn hình và tệp đính kèm</h3>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          add(Array.from(event.dataTransfer.files));
        }}
        className="rounded-2xl border-2 border-dashed border-primary/25 bg-surface/60 p-5 text-center"
      >
        <UploadCloud className="mx-auto mb-2 size-8 text-primary" />
        <p className="text-sm font-semibold">Kéo thả ảnh chụp màn hình hoặc tệp vào đây</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Chọn nhiều ảnh · PNG, JPG, PDF, TXT · tối đa 10 tệp, 5 MB mỗi tệp
        </p>
        <input
          ref={input}
          aria-label="Tệp đính kèm yêu cầu"
          type="file"
          multiple
          accept="image/png,image/jpeg,application/pdf,text/plain"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            add(Array.from(event.target.files || []));
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="soft"
          className="mt-4"
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          <Paperclip /> Đính kèm tệp
        </Button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
        {previews.map(({ file, url }, index) => (
          <li
            key={`${file.name}-${file.size}-${file.lastModified}`}
            className="relative min-w-0 rounded-xl border bg-card p-3"
          >
            {url ? (
              <img
                src={url}
                alt={`Xem trước ${file.name}`}
                className="h-32 w-full rounded-lg bg-surface object-contain"
              />
            ) : (
              <FileText className="mx-auto my-6 size-12 text-primary" />
            )}
            <p className="mt-2 truncate pr-5 text-xs font-medium" title={file.name}>
              {file.name}
            </p>
            <p className="text-[11px] text-muted-foreground">{Math.ceil(file.size / 1024)} KB</p>
            <button
              type="button"
              aria-label={`Bỏ tệp ${file.name}`}
              disabled={disabled}
              onClick={() => onChange(files.filter((_, i) => i !== index))}
              className="absolute right-1 top-1 rounded-full border bg-card p-1 shadow-soft"
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AttachmentGallery({ files }: { files: ApiAttachment[] }) {
  if (!files.length) return null;
  return (
    <section aria-label="Ảnh và tệp của yêu cầu" className="space-y-3">
      <h3 className="font-bold">Ảnh và tệp của yêu cầu</h3>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {files.map((file) => (
          <li key={file.id} className="min-w-0 rounded-xl border bg-card p-3">
            {["image/png", "image/jpeg"].includes(file.mime) && (
              <a
                href={authenticatedUrl(`/attachments/${file.id}?inline=1`)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Xem ảnh ${file.name}`}
              >
                <img
                  src={authenticatedUrl(`/attachments/${file.id}?inline=1`)}
                  alt={file.name}
                  className="mb-2 h-40 w-full rounded-lg bg-surface object-contain"
                  loading="lazy"
                />
              </a>
            )}
            <a
              href={authenticatedUrl(`/attachments/${file.id}`)}
              className="block break-words text-xs font-semibold text-primary underline"
            >
              {file.name} · {Math.ceil(file.size / 1024)} KB
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TicketAttachmentUpload({
  ticketId,
  disabled = false,
}: {
  ticketId: string;
  disabled?: boolean;
}) {
  const [files, setFiles] = useState<File[]>([]),
    [pending, setPending] = useState(false);
  const write = useWrite();
  return (
    <section className="space-y-3">
      <AttachmentPicker files={files} onChange={setFiles} disabled={disabled || pending} />
      {files.length > 0 && (
        <Button
          type="button"
          variant="outline"
          disabled={disabled || pending}
          onClick={async () => {
            const body = new FormData();
            files.forEach((file) => body.append("files", file));
            setPending(true);
            try {
              await write(`/tickets/${encodeURIComponent(ticketId)}/attachments`, body);
              setFiles([]);
              toast.success("Đã lưu tệp đính kèm.");
            } catch {
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? "Đang tải lên…" : `Tải lên ${files.length} tệp`}
        </Button>
      )}
    </section>
  );
}
