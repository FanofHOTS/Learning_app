"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  deleteDocumentSubtitle,
  getManageableDocumentSubtitles,
  saveDocumentSubtitle,
  type DocumentSubtitle,
  type SubtitleCue,
} from "../lib/api_document_subtitles";

type DocumentSubtitleEditorProps = {
  documentId: number;
  videoUrl: string;
  title: string;
};

function hasCueOverlap(cues: SubtitleCue[]): boolean {
  const sorted = [...cues].sort((left, right) => left.start - right.start);
  return sorted.some(
    (cue, index) => index > 0 && cue.start < sorted[index - 1].end,
  );
}

export default function DocumentSubtitleEditor({
  documentId,
  videoUrl,
  title,
}: DocumentSubtitleEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [tracks, setTracks] = useState<DocumentSubtitle[]>([]);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<number | null>(
    null,
  );
  const [language, setLanguage] = useState("vi");
  const [label, setLabel] = useState("Tiếng Việt");
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [startTime, setStartTime] = useState("0");
  const [endTime, setEndTime] = useState("3");
  const [cueText, setCueText] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setErrorMessage("");

    void getManageableDocumentSubtitles(documentId)
      .then((loadedTracks) => {
        if (!active) return;
        setTracks(loadedTracks);
        const firstTrack = loadedTracks[0];
        if (firstTrack) {
          setSelectedSubtitleId(firstTrack.id);
          setLanguage(firstTrack.language);
          setLabel(firstTrack.label);
          setCues(firstTrack.cues ?? []);
          setIsPublished(firstTrack.is_published);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải các bản phụ đề.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [documentId]);

  const activeCue = useMemo(
    () => cues.find((cue) => currentTime >= cue.start && currentTime <= cue.end),
    [cues, currentTime],
  );
  const hasOverlap = useMemo(() => hasCueOverlap(cues), [cues]);

  function selectTrack(value: string) {
    setSuccessMessage("");
    setErrorMessage("");
    if (!value) {
      setSelectedSubtitleId(null);
      setLanguage("vi");
      setLabel("Tiếng Việt");
      setCues([]);
      setIsPublished(false);
      return;
    }

    const track = tracks.find((item) => item.id === Number(value));
    if (!track) return;
    setSelectedSubtitleId(track.id);
    setLanguage(track.language);
    setLabel(track.label);
    setCues(track.cues ?? []);
    setIsPublished(track.is_published);
  }

  function addCue() {
    const start = Number(startTime);
    const end = Number(endTime);
    const text = cueText.trim();
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
      setErrorMessage("Thời điểm kết thúc phải lớn hơn thời điểm bắt đầu.");
      return;
    }
    if (!text) {
      setErrorMessage("Hãy nhập nội dung đoạn phụ đề.");
      return;
    }

    setCues((current) =>
      [...current, { start, end, text }].sort(
        (left, right) => left.start - right.start,
      ),
    );
    setCueText("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function setCueAtCurrentTime() {
    const video = videoRef.current;
    if (!video) return;
    const start = video.currentTime;
    const proposedEnd = start + 3;
    const end =
      Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(proposedEnd, video.duration)
        : proposedEnd;
    setStartTime(start.toFixed(2));
    setEndTime(end.toFixed(2));
    setErrorMessage("");
  }

  function updateCue(index: number, patch: Partial<SubtitleCue>) {
    setCues((current) =>
      current.map((cue, cueIndex) =>
        cueIndex === index ? { ...cue, ...patch } : cue,
      ),
    );
    setSuccessMessage("");
  }

  async function handleSave() {
    if (!language.trim() || !label.trim()) {
      setErrorMessage("Hãy nhập mã ngôn ngữ và tên ngôn ngữ phụ đề.");
      return;
    }
    if (isPublished && cues.length === 0) {
      setErrorMessage("Hãy thêm ít nhất một đoạn trước khi xuất bản phụ đề.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const saved = await saveDocumentSubtitle(documentId, {
        ...(selectedSubtitleId ? { subtitle_id: selectedSubtitleId } : {}),
        language: language.trim(),
        label: label.trim(),
        cues,
        is_published: isPublished,
      });
      setTracks((current) => [
        ...current.filter(
          (track) =>
            track.id !== saved.id && track.language !== saved.language,
        ),
        saved,
      ].sort((left, right) => left.language.localeCompare(right.language)));
      setSelectedSubtitleId(saved.id);
      setSuccessMessage("Đã lưu phụ đề và tệp WebVTT.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không thể lưu phụ đề.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedSubtitleId || !window.confirm("Xóa bản phụ đề này?")) return;
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await deleteDocumentSubtitle(documentId, selectedSubtitleId);
      setTracks((current) =>
        current.filter((track) => track.id !== selectedSubtitleId),
      );
      setSelectedSubtitleId(null);
      setLanguage("vi");
      setLabel("Tiếng Việt");
      setCues([]);
      setIsPublished(false);
      setSuccessMessage("Đã xóa bản phụ đề.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không thể xóa phụ đề.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl bg-slate-950">
        <video
          ref={videoRef}
          controls
          src={videoUrl}
          aria-label={title}
          onTimeUpdate={(event) =>
            setCurrentTime(event.currentTarget.currentTime)
          }
          className="block max-h-[65vh] w-full bg-slate-950"
        >
          Trình duyệt của bạn không hỗ trợ thẻ video.
        </video>
        {activeCue ? (
          <div
            className="pointer-events-none absolute inset-x-3 bottom-14 whitespace-pre-line rounded bg-black/80 px-3 py-2 text-center text-lg font-semibold text-white sm:inset-x-10 sm:text-xl"
          >
            {activeCue.text}
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <h4 className="font-semibold text-slate-900">Tạo phụ đề</h4>
            <p className="mt-1 text-sm text-slate-600">
              Nhập lời thoại và mốc thời gian. Chọn một đoạn để phát video tại
              đúng vị trí.
            </p>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Bản phụ đề
            <select
              value={selectedSubtitleId ?? ""}
              onChange={(event) => selectTrack(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
            >
              <option value="">Tạo bản phụ đề mới</option>
              {tracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.label} ({track.language})
                  {track.is_published ? " — đã xuất bản" : " — bản nháp"}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Mã ngôn ngữ
              <input
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                maxLength={35}
                placeholder="vi hoặc en"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Tên hiển thị
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                maxLength={80}
                placeholder="Tiếng Việt"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Bắt đầu (giây)
              <input
                type="number"
                min={0}
                step={0.1}
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Kết thúc (giây)
              <input
                type="number"
                min={0}
                step={0.1}
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={setCueAtCurrentTime}
            className="text-sm font-semibold text-sky-700 hover:text-sky-900"
          >
            Dùng thời điểm video hiện tại
          </button>

          <label className="block text-sm font-medium text-slate-700">
            Nội dung phụ đề
            <textarea
              rows={3}
              maxLength={1000}
              value={cueText}
              onChange={(event) => setCueText(event.target.value)}
              placeholder="Nhập lời thoại cho đoạn này..."
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={addCue}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-200"
          >
            <Plus className="h-4 w-4" />
            Thêm đoạn
          </button>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-semibold text-slate-900">
                Các đoạn ({cues.length})
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                Phụ đề được lưu thành tệp WebVTT để trình phát hỗ trợ nút CC.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(event) => setIsPublished(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Xuất bản cho người học
            </label>
          </div>

          {hasOverlap ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Một số đoạn phụ đề bị chồng thời gian. Hãy kiểm tra trước khi xuất
              bản.
            </p>
          ) : null}

          {isLoading ? (
            <p className="text-sm text-slate-500">Đang tải phụ đề...</p>
          ) : (
            <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
              {cues.map((cue, index) => (
                <div
                  key={`${index}-${cue.start}`}
                  className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[6rem_6rem_minmax(0,1fr)_2rem]"
                >
                  <input
                    aria-label={`Thời điểm bắt đầu đoạn ${index + 1}`}
                    type="number"
                    min={0}
                    step={0.1}
                    value={cue.start}
                    onChange={(event) => {
                      const start = Number(event.target.value);
                      updateCue(index, { start });
                    }}
                    onFocus={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = cue.start;
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                  <input
                    aria-label={`Thời điểm kết thúc đoạn ${index + 1}`}
                    type="number"
                    min={0}
                    step={0.1}
                    value={cue.end}
                    onChange={(event) => {
                      const end = Number(event.target.value);
                      updateCue(index, { end });
                    }}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                  <textarea
                    aria-label={`Nội dung đoạn ${index + 1}`}
                    rows={2}
                    maxLength={1000}
                    value={cue.text}
                    onChange={(event) =>
                      updateCue(index, { text: event.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    aria-label={`Xóa đoạn ${index + 1}`}
                    onClick={() =>
                      setCues((current) =>
                        current.filter((_, cueIndex) => cueIndex !== index),
                      )
                    }
                    className="self-start rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {cues.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                  Chưa có đoạn phụ đề. Thêm một đoạn để bắt đầu.
                </p>
              ) : null}
            </div>
          )}

          {errorMessage ? (
            <p role="alert" className="text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
          {successMessage ? (
            <p role="status" className="text-sm text-emerald-700">
              {successMessage}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isLoading || isSaving}
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Đang lưu..." : "Lưu phụ đề"}
            </button>
            {selectedSubtitleId ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleDelete()}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Xóa bản này
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
