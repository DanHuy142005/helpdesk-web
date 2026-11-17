import { usePortalData, useActions, useWrite } from "@/shared";
import { Eye, FileText, FolderPlus, Upload } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared";
import { Badge, IconTile, PageHeader, PillTabs, SectionCard, type Tone } from "@/shared";
import { type DocumentItem } from "../data";

const catTone: Record<DocumentItem["category"], Tone> = {
  "Quy trình": "primary",
  "Chính sách": "danger",
  "Hướng dẫn": "info",
  "Biểu mẫu": "success",
};

export function AdminDocumentsPage() {
  const { documents, stats, workspace } = usePortalData();
  const actions = useActions();
  const write = useWrite();
  const [cat, setCat] = useState("all");
  const rows = cat === "all" ? documents : documents.filter((d) => d.category === cat);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Tài nguyên CNTT"
        title="Tài liệu nội bộ"
        description="Quy trình, chính sách, hướng dẫn và biểu mẫu phục vụ vận hành CNTT."
        actions={
          <>
            <Button variant="outline" onClick={() => actions.editEntity("documents")}>
              <FolderPlus /> Soạn tài liệu
            </Button>
            <Button variant="brand" onClick={() => actions.editEntity("documents")}>
              <Upload /> Tải lên
            </Button>
          </>
        }
      />
      <PillTabs
        value={cat}
        onChange={setCat}
        tabs={[
          { value: "all", label: "Tất cả", count: documents.length },
          { value: "Quy trình", label: "Quy trình" },
          { value: "Chính sách", label: "Chính sách" },
          { value: "Hướng dẫn", label: "Hướng dẫn" },
          { value: "Biểu mẫu", label: "Biểu mẫu" },
        ]}
      />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((d) => (
          <article
            key={d.id}
            role="button"
            tabIndex={0}
            onClick={() => actions.openDocument(d.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") actions.openDocument(d.id);
            }}
            className="card-surface group p-5 transition-all hover:-translate-y-0.5 hover:shadow-card"
          >
            <div className="flex items-start justify-between">
              <IconTile icon={FileText} tone={catTone[d.category] || "primary"} size="lg" />
              <Badge tone={catTone[d.category] || "primary"} dot={false}>
                {d.category}
              </Badge>
            </div>
            <h3 className="mt-4 text-[15px] font-bold leading-snug group-hover:text-primary">
              {d.title}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">Phụ trách: {d.owner}</p>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
              <span>
                {d.updated} · {d.size}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="size-3.5" /> {d.views}
              </span>
            </div>
          </article>
        ))}
      </div>
      <SectionCard
        title="Dung lượng lưu trữ"
        description={`${(workspace.documents.reduce((n, d) => n + d.bytes, 0) / 1024).toFixed(1)} KB tài liệu và tệp đính kèm`}
      >
        <div className="flex h-3 overflow-hidden rounded-full bg-surface">
          {["Quy trình", "Hướng dẫn", "Chính sách", "Biểu mẫu"].map((category, i) => (
            <div
              key={category}
              className={["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-5"][i]}
              style={{
                width: `${workspace.documents.reduce((n, d) => n + d.bytes, 0) ? (workspace.documents.filter((d) => d.category === category).reduce((n, d) => n + d.bytes, 0) / workspace.documents.reduce((n, d) => n + d.bytes, 0)) * 100 : 0}%`,
              }}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-full bg-chart-1" /> Quy trình
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-full bg-chart-2" /> Hướng dẫn
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-full bg-chart-3" /> Chính sách
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-full bg-chart-5" /> Biểu mẫu
          </span>
        </div>
      </SectionCard>
    </div>
  );
}
