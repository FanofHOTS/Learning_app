"""Dọn các lượt làm bài đã bỏ dở từ lâu.

Chỉ xóa những lượt còn ở trạng thái `in_progress` (chưa từng nộp), đã quá hạn
nộp hơn số ngày giữ lại và không gắn với kết quả bài thi nào. Kết quả bài thi
và lượt đã nộp luôn được giữ lại làm lịch sử điểm của sinh viên.

Số ngày giữ lại lấy từ biến môi trường `EXAM_ATTEMPT_RETENTION_DAYS`
(mặc định 7, kẹp trong khoảng 1-365).
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlmodel import Session, select

from models.exam_attempt import ExamAttempt
from models.exam_result import ExamResult

STATUS_IN_PROGRESS = "in_progress"
DEFAULT_RETENTION_DAYS = 7
MIN_RETENTION_DAYS = 1
MAX_RETENTION_DAYS = 365


def retention_days_from_env() -> int:
    """Số ngày giữ lượt làm bài bỏ dở, đọc từ env và kẹp trong khoảng hợp lệ."""
    raw = os.getenv("EXAM_ATTEMPT_RETENTION_DAYS", "").strip()
    try:
        days = int(raw) if raw else DEFAULT_RETENTION_DAYS
    except ValueError:
        days = DEFAULT_RETENTION_DAYS
    return max(MIN_RETENTION_DAYS, min(MAX_RETENTION_DAYS, days))


def _as_utc(value: Optional[datetime]) -> Optional[datetime]:
    """SQLite trả về datetime không kèm timezone; gắn UTC để so sánh an toàn."""
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def purge_stale_exam_attempts(
    session: Session,
    retention_days: Optional[int] = None,
) -> dict[str, Any]:
    """Xóa các lượt làm bài bỏ dở đã quá hạn lâu ngày.

    Trả về `{deleted, retention_days, cutoff}` để endpoint/nhật ký báo cáo được.
    """
    days = (
        retention_days_from_env()
        if retention_days is None
        else max(MIN_RETENTION_DAYS, min(MAX_RETENTION_DAYS, int(retention_days)))
    )
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    attempts = session.exec(
        select(ExamAttempt).where(ExamAttempt.status == STATUS_IN_PROGRESS)
    ).all()

    result: dict[str, Any] = {
        "deleted": 0,
        "retention_days": days,
        "cutoff": cutoff.isoformat(),
    }
    if not attempts:
        return result

    attempt_ids = [attempt.id for attempt in attempts if attempt.id is not None]
    linked_result_ids: set[int] = set()
    if attempt_ids:
        linked_result_ids = {
            attempt_id
            for attempt_id in session.exec(
                select(ExamResult.attempt_id).where(
                    ExamResult.attempt_id.in_(attempt_ids)
                )
            ).all()
            if attempt_id is not None
        }

    deleted = 0
    for attempt in attempts:
        if attempt.id is None or attempt.id in linked_result_ids:
            continue

        # Lượt không giới hạn thời gian được tính theo lúc bắt đầu.
        reference = _as_utc(attempt.deadline_at) or _as_utc(attempt.started_at)
        if reference is None or reference > cutoff:
            continue

        session.delete(attempt)
        deleted += 1

    if deleted:
        session.commit()

    result["deleted"] = deleted
    return result
