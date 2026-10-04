#!/usr/bin/env python3
"""Conservative EN->ES alignment candidates for SRD 5.2.1.
This stage never approves translation-memory entries automatically.
It generates reviewable candidates using:
- monotonic page correspondence
- block type
- text-length ratio
- numeric/dice signatures
- relative order within pages
- global sequence position
"""
import json
import math
import re
from collections import Counter
from pathlib import Path
DATA = Path("data/sources")
CORPUS = DATA / "corpus"
OUTPUT = DATA / "translation-memory" / "alignment-candidates.jsonl"
REPORT = DATA / "translation-memory" / "alignment-report.json"
EN_ID = "8974902d109d6e63"
ES_ID = "9ecc1b980016b104"
PAGE_WINDOW = 3
TOP_K = 3
def clean_text(text):
    text = text.replace("\xad", "")
    text = re.sub(r"(?<=\w)-\s+(?=\w)", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()
def is_noise(text):
    text = clean_text(text)
    if len(text) < 20:
        return True
    # Repeated SRD page footer.
    if re.fullmatch(
        r"(?:System Reference Document 5\.2\.1|"
        r"Documento de referencia del sistema 5\.2\.1)\s+\d+",
        text,
        re.IGNORECASE,
    ):
        return True
    # Table-of-contents/index entries.
    if re.search(r"\.{3,}\s*\d{1,3}\s*$", text):
        return True
    # Mostly punctuation/digits: likely layout/table noise.
    alnum = sum(ch.isalnum() for ch in text)
    if alnum / max(len(text), 1) < 0.55:
        return True
    return False
def load_segments(document_id):
    path = CORPUS / document_id / "segments.jsonl"
    if not path.exists():
        raise SystemExit(f"No existe el corpus: {path}")
    rows = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            row = json.loads(line)
            if not row.get("alignmentEligible", False):
                continue
            if row.get("type") not in {"paragraph", "heading"}:
                continue
            text = clean_text(row["text"])
            if is_noise(text):
                continue
            row = dict(row)
            row["text"] = text
            row["textNormalized"] = text
            rows.append(row)
    return rows
def add_local_positions(rows):
    page_counts = Counter(row["page"] for row in rows)
    page_seen = Counter()
    for row in rows:
        page = row["page"]
        index = page_seen[page]
        page_seen[page] += 1
        row["pageBlockIndex"] = index
        row["pageBlockCount"] = page_counts[page]
def tokenize(text):
    return re.findall(
        r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+",
        text.lower(),
    )
def numeric_signature(text):
    return tuple(
        re.findall(
            r"\b\d+d\d+(?:\s*[+-]\s*\d+)?\b|\b\d+(?:[.,]\d+)?\b",
            text.lower(),
        )
    )
def numeric_score(source, target):
    a = set(numeric_signature(source))
    b = set(numeric_signature(target))
    if not a and not b:
        return 0.5
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    return len(a & b) / max(len(a | b), 1)
def length_score(source, target):
    source_len = len(source)
    target_len = len(target)
    if not source_len or not target_len:
        return 0.0
    ratio = target_len / source_len
    # Spanish commonly expands compared with English.
    expected = 1.10
    distance = abs(math.log(ratio / expected))
    return math.exp(-distance * 1.7)
def type_score(source_type, target_type):
    return 1.0 if source_type == target_type else 0.25
def local_order_score(source, target):
    source_position = source["pageBlockIndex"] / max(
        source["pageBlockCount"] - 1,
        1,
    )
    target_position = target["pageBlockIndex"] / max(
        target["pageBlockCount"] - 1,
        1,
    )
    return max(0.0, 1.0 - abs(source_position - target_position) * 1.5)
def global_order_score(source_index, target_index, source_total, target_total):
    source_position = source_index / max(source_total - 1, 1)
    target_position = target_index / max(target_total - 1, 1)
    return max(0.0, 1.0 - abs(source_position - target_position) * 4.0)
def page_score(source_page, target_page, source_pages, target_pages):
    expected_target_page = round(
        source_page * target_pages / max(source_pages, 1)
    )
    distance = abs(target_page - expected_target_page)
    return max(
        0.0,
        1.0 - distance / (PAGE_WINDOW + 1),
    )
def shared_anchor_score(source, target):
    source_tokens = {
        token
        for token in tokenize(source)
        if len(token) >= 5
    }
    target_tokens = {
        token
        for token in tokenize(target)
        if len(token) >= 5
    }
    if not source_tokens or not target_tokens:
        return 0.0
    return min(
        len(source_tokens & target_tokens) / 3.0,
        1.0,
    )
def candidate_score(
    source,
    target,
    source_index,
    target_index,
    source_total,
    target_total,
    source_pages,
    target_pages,
):
    scores = {
        "page": page_score(
            source["page"],
            target["page"],
            source_pages,
            target_pages,
        ),
        "length": length_score(
            source["text"],
            target["text"],
        ),
        "type": type_score(
            source["type"],
            target["type"],
        ),
        "numeric": numeric_score(
            source["text"],
            target["text"],
        ),
        "localOrder": local_order_score(
            source,
            target,
        ),
        "globalOrder": global_order_score(
            source_index,
            target_index,
            source_total,
            target_total,
        ),
        "sharedAnchors": shared_anchor_score(
            source["text"],
            target["text"],
        ),
    }
    score = (
        scores["page"] * 0.30
        + scores["length"] * 0.20
        + scores["type"] * 0.10
        + scores["numeric"] * 0.20
        + scores["localOrder"] * 0.10
        + scores["globalOrder"] * 0.05
        + scores["sharedAnchors"] * 0.05
    )
    return round(score, 4), {
        key: round(value, 4)
        for key, value in scores.items()
    }
def confidence(score, margin, duplicate=False):
    if duplicate:
        return "low"
    if score >= 0.88 and margin >= 0.10:
        return "high"
    if score >= 0.78 and margin >= 0.06:
        return "medium"
    return "low"
def align():
    source = load_segments(EN_ID)
    target = load_segments(ES_ID)
    if not source or not target:
        raise SystemExit(
            "No hay suficientes segmentos elegibles para alinear."
        )
    add_local_positions(source)
    add_local_positions(target)
    source_total = len(source)
    target_total = len(target)
    source_pages = max(row["page"] for row in source)
    target_pages = max(row["page"] for row in target)
    target_by_page = {}
    for index, row in enumerate(target):
        target_by_page.setdefault(row["page"], []).append(
            (index, row)
        )
    candidates = []
    for source_index, source_row in enumerate(source):
        expected_page = round(
            source_row["page"] * target_pages
            / max(source_pages, 1)
        )
        scored = []
        for page in range(
            max(1, expected_page - PAGE_WINDOW),
            min(target_pages, expected_page + PAGE_WINDOW) + 1,
        ):
            for target_index, target_row in target_by_page.get(page, []):
                score, signals = candidate_score(
                    source_row,
                    target_row,
                    source_index,
                    target_index,
                    source_total,
                    target_total,
                    source_pages,
                    target_pages,
                )
                scored.append(
                    (
                        score,
                        signals,
                        target_index,
                        target_row,
                    )
                )
        scored.sort(
            key=lambda item: item[0],
            reverse=True,
        )
        if not scored:
            continue
        best = scored[0]
        second = scored[1] if len(scored) > 1 else None
        margin = (
            best[0] - second[0]
            if second
            else best[0]
        )
        alternatives = []
        for alternative in scored[1:TOP_K]:
            alternatives.append(
                {
                    "targetSegmentId": alternative[3]["id"],
                    "targetPage": alternative[3]["page"],
                    "score": alternative[0],
                    "text": alternative[3]["text"],
                }
            )
        candidates.append(
            {
                "source": source_row["text"],
                "target": best[3]["text"],
                "sourceHash": source_row["textHash"],
                "sourceDocument": EN_ID,
                "sourcePage": source_row["page"],
                "targetDocument": ES_ID,
                "targetPage": best[3]["page"],
                "sourceSegmentId": source_row["id"],
                "targetSegmentId": best[3]["id"],
                "score": best[0],
                "margin": round(margin, 4),
                "confidence": confidence(
                    best[0],
                    margin,
                ),
                "status": "review",
                "authority": "SRD 5.2.1 EN/ES candidate alignment",
                "matchType": "page-constrained-structural",
                "signals": best[1],
                "alternatives": alternatives,
            }
        )
    target_usage = Counter(
        row["targetSegmentId"]
        for row in candidates
    )
    for row in candidates:
        usage = target_usage[row["targetSegmentId"]]
        row["targetUsageCount"] = usage
        if usage > 1 and row["confidence"] == "high":
            row["confidence"] = "medium"
        if usage > 1:
            row["status"] = "review"
    OUTPUT.parent.mkdir(
        parents=True,
        exist_ok=True,
    )
    with OUTPUT.open("w", encoding="utf-8") as handle:
        for row in candidates:
            handle.write(
                json.dumps(
                    row,
                    ensure_ascii=False,
                ) + "\n"
            )
    distribution = Counter(
        row["confidence"]
        for row in candidates
    )
    report = {
        "sourceDocument": EN_ID,
        "targetDocument": ES_ID,
        "sourceSegments": source_total,
        "targetSegments": target_total,
        "candidates": len(candidates),
        "confidence": dict(distribution),
        "uniqueTargetCandidates": len(target_usage),
        "reusedTargets": sum(
            1
            for count in target_usage.values()
            if count > 1
        ),
        "approved": 0,
        "review": len(candidates),
        "note": (
            "Candidates are never auto-approved. "
            "Review is required before translation memory."
        ),
    }
    REPORT.write_text(
        json.dumps(
            report,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(
        json.dumps(
            report,
            ensure_ascii=False,
            indent=2,
        )
    )
if __name__ == "__main__":
    align()
