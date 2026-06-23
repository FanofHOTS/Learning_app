"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  FileText,
  GitCommit,
  Layers3,
  NotebookPen,
} from "lucide-react";
import { BLOOM_LEVELS, type BloomLevelKey } from "./_bloom-objectives";

// ─── Types ───────────────────────────────────────────────────────

export type PrerequisiteMap = Record<number, number | null>; // componentId → prerequisiteComponentId

export type TaxonomyTagMap = Record<string, BloomLevelKey[]>; // "module:{id}" or "component:{id}" → Bloom levels

export type ContentStructureData = {
  prerequisites: PrerequisiteMap;
  taxonomyTags: TaxonomyTagMap;
};

export const DEFAULT_CONTENT_STRUCTURE: ContentStructureData = {
  prerequisites: {},
  taxonomyTags: {},
};

export function parseContentStructure(json: string): ContentStructureData {
  try {
    const parsed = JSON.parse(json);
    return {
      prerequisites:
        typeof parsed.prerequisites === "object" && parsed.prerequisites !== null
          ? parsed.prerequisites
          : {},
      taxonomyTags:
        typeof parsed.taxonomyTags === "object" && parsed.taxonomyTags !== null
          ? parsed.taxonomyTags
          : {},
    };
  } catch {
    return { ...DEFAULT_CONTENT_STRUCTURE };
  }
}

export function serializeContentStructure(data: ContentStructureData): string {
  return JSON.stringify(data);
}

// ─── Helpers ──────────────────────────────────────────────────────

type TreeComponent = {
  id: number;
  title: string;
  component_type: string;
  module_id: number;
  component_sequence: number;
};

type TreeModule = {
  id: number;
  title: string;
  module_sequence: number;
};

type ContentStructureProps = {
  value: string; // JSON string
  modules: TreeModule[];
  components: TreeComponent[];
  onChange?: (json: string) => void;
};

// ─── Component ────────────────────────────────────────────────────

export default function ContentStructure({
  value,
  modules,
  components,
  onChange,
}: ContentStructureProps) {
  const data = useMemo(() => parseContentStructure(value), [value]);

  const [expandedModules, setExpandedModules] = useState<Set<number>>(() =>
    new Set(modules.map((m) => m.id)),
  );

  const sortedModules = useMemo(
    () => [...modules].sort((a, b) => a.module_sequence - b.module_sequence),
    [modules],
  );

  const sortedComponents = useMemo(() => {
    const moduleOrder = new Map<number, number>();
    sortedModules.forEach((m) => moduleOrder.set(m.id, m.module_sequence));

    return [...components].sort((a, b) => {
      const aMod = moduleOrder.get(a.module_id) ?? 0;
      const bMod = moduleOrder.get(b.module_id) ?? 0;
      if (aMod !== bMod) return aMod - bMod;
      return a.component_sequence - b.component_sequence;
    });
  }, [components, sortedModules]);

  const updatePrerequisite = useCallback(
    (componentId: number, prerequisiteId: number | null) => {
      if (!onChange) return;
      const next: ContentStructureData = {
        ...data,
        prerequisites: { ...data.prerequisites, [componentId]: prerequisiteId },
      };
      onChange(serializeContentStructure(next));
    },
    [data, onChange],
  );

  const toggleTaxonomyTag = useCallback(
    (key: string, level: BloomLevelKey) => {
      if (!onChange) return;
      const current = data.taxonomyTags[key] ?? [];
      const next = current.includes(level)
        ? current.filter((l) => l !== level)
        : [...current, level];
      const nextTags = { ...data.taxonomyTags, [key]: next };
      if (next.length === 0) delete nextTags[key];
      const nextData: ContentStructureData = {
        ...data,
        taxonomyTags: nextTags,
      };
      onChange(serializeContentStructure(nextData));
    },
    [data, onChange],
  );

  const toggleModuleExpanded = useCallback((moduleId: number) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }, []);

  // Compute stats
  const stats = useMemo(() => {
    const allKeys = new Set<string>();
    sortedComponents.forEach((c) => allKeys.add(`component:${c.id}`));
    sortedModules.forEach((m) => allKeys.add(`module:${m.id}`));

    const tagged = new Set<string>();
    for (const key of Object.keys(data.taxonomyTags)) {
      if (data.taxonomyTags[key]?.length > 0) tagged.add(key);
    }

    return {
      total: allKeys.size,
      tagged: tagged.size,
      untagged: allKeys.size - tagged.size,
    };
  }, [data.taxonomyTags, sortedComponents, sortedModules]);

  if (!onChange) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-6 text-center text-sm text-slate-500">
        Mở chế độ chỉnh sửa để quản lý cấu trúc nội dung.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            📋 Cấu trúc nội dung
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Cây module, tiên quyết và gắn thẻ Bloom
          </p>
        </div>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
          {stats.tagged}/{stats.total} đã gắn thẻ
        </span>
      </div>

      {/* Untagged alert */}
      {stats.untagged > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {stats.untagged} mục chưa gắn thẻ Bloom
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Gắn thẻ cấp độ Bloom cho module và thành phần để thể hiện phân bổ mục tiêu học tập.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tree */}
      <div className="space-y-3">
        {sortedModules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-6 text-center text-sm text-slate-500">
            Khóa học chưa có module nào.
          </div>
        ) : (
          sortedModules.map((module, mIdx) => {
            const moduleComponents = sortedComponents.filter(
              (c) => c.module_id === module.id,
            );
            const moduleKey = `module:${module.id}`;
            const moduleTags = data.taxonomyTags[moduleKey] ?? [];
            const isExpanded = expandedModules.has(module.id);

            return (
              <div
                key={module.id}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
              >
                {/* Module header */}
                <div
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50 ${
                    mIdx < sortedModules.length - 1 ? "border-b border-slate-100" : ""
                  }`}
                  onClick={() => toggleModuleExpanded(module.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <Layers3 className="h-5 w-5 shrink-0 text-sky-600" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        Module {module.module_sequence}: {module.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {moduleComponents.length} thành phần
                      </p>
                    </div>
                  </div>

                  {/* Module taxonomy tags */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {BLOOM_LEVELS.map((level) => {
                      const isSet = moduleTags.includes(level.key);
                      return (
                        <button
                          key={level.key}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTaxonomyTag(moduleKey, level.key);
                          }}
                          className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold transition-all ${
                            isSet
                              ? `bg-white shadow-sm ${level.iconClass} ring-1 ring-slate-200`
                              : "text-slate-200 hover:text-slate-400 hover:bg-slate-50"
                          }`}
                          title={`${isSet ? "Bỏ gắn" : "Gắn"} thẻ ${level.label} cho module`}
                        >
                          {level.label.charAt(0)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Component list */}
                {isExpanded && (
                  <div className="space-y-2 px-4 py-3 bg-slate-50/50">
                    {moduleComponents.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-500">
                        Module chưa có thành phần
                      </div>
                    ) : (
                      moduleComponents.map((component, cIdx) => {
                        const compKey = `component:${component.id}`;
                        const compTags = data.taxonomyTags[compKey] ?? [];
                        const isAssessment =
                          component.component_type === "exam" ||
                          component.component_type === "assignment";
                        const prerequisiteId =
                          data.prerequisites[component.id] ?? null;

                        const availablePrerequisites = sortedComponents.filter(
                          (c) => c.id !== component.id,
                        );

                        const Icon =
                          component.component_type === "exam"
                            ? NotebookPen
                            : component.component_type === "assignment"
                              ? ClipboardList
                              : FileText;

                        const hasCycle = useMemo(() => {
                          if (!prerequisiteId) return false;
                          // Simple cycle check
                          const visited = new Set<number>();
                          let current: number | null = prerequisiteId;
                          while (current !== null) {
                            if (current === component.id) return true;
                            if (visited.has(current)) return true;
                            visited.add(current);
                            current = data.prerequisites[current] ?? null;
                          }
                          return false;
                        }, [prerequisiteId, component.id, data.prerequisites]);

                        return (
                          <div
                            key={component.id}
                            className={`rounded-xl border bg-white p-3 transition-colors ${
                              hasCycle
                                ? "border-red-300 bg-red-50"
                                : "border-slate-200"
                            }`}
                          >
                            {/* Component header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-medium text-slate-500">
                                  {cIdx + 1}
                                </span>
                                <Icon
                                  className={`h-4 w-4 shrink-0 ${
                                    component.component_type === "exam"
                                      ? "text-emerald-600"
                                      : component.component_type === "assignment"
                                        ? "text-violet-600"
                                        : "text-cyan-600"
                                  }`}
                                />
                                <span className="text-sm font-medium text-slate-900 truncate">
                                  {component.title}
                                </span>
                                {!isAssessment && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                    Tài liệu
                                  </span>
                                )}
                                {hasCycle && (
                                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600">
                                    Lặp
                                  </span>
                                )}
                              </div>

                              {/* Component taxonomy tags */}
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                {BLOOM_LEVELS.map((level) => {
                                  const isSet = compTags.includes(level.key);
                                  return (
                                    <button
                                      key={level.key}
                                      type="button"
                                      onClick={() =>
                                        toggleTaxonomyTag(compKey, level.key)
                                      }
                                      className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold transition-all ${
                                        isSet
                                          ? `bg-white shadow-sm ${level.iconClass} ring-1 ring-slate-200`
                                          : "text-slate-200 hover:text-slate-400"
                                      }`}
                                      title={`${isSet ? "Bỏ" : "Gắn"} ${level.label}`}
                                    >
                                      {level.label.charAt(0)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Prerequisite selector */}
                            <div className="mt-2 flex items-center gap-2">
                              <GitCommit className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <select
                                value={prerequisiteId ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updatePrerequisite(
                                    component.id,
                                    val ? Number(val) : null,
                                  );
                                }}
                                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-sky-400"
                              >
                                <option value="">Không có tiên quyết (mở tự do)</option>
                                {availablePrerequisites.map((pc) => {
                                  const pMod = sortedModules.find(
                                    (m) => m.id === pc.module_id,
                                  );
                                  return (
                                    <option key={pc.id} value={pc.id}>
                                      {pMod ? `[M${pMod.module_sequence}] ` : ""}
                                      {pc.title}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bloom level legend */}
      <details className="group">
        <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-700">
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
          Chú thích thẻ Bloom
        </summary>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px] text-slate-600">
          {BLOOM_LEVELS.map((level) => (
            <div
              key={level.key}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 ${level.bgClass}`}
            >
              <level.icon className="h-3 w-3" />
              <span className={level.iconClass}>{level.label}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
