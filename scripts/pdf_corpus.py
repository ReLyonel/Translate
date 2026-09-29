#!/usr/bin/env python3
"""Local-only PDF indexing and extraction; PDFs are always read in place."""
import hashlib, json, os, re, sys
from pathlib import Path

DEFAULT_SOURCE = r"C:\Users\leond\OneDrive\Escritorio\Nueva carpeta"
SOURCE = Path(os.environ.get("PDF_SOURCE_DIR", DEFAULT_SOURCE))
DATA = Path("data/sources")
INDEX = DATA / "pdf-index.json"

def normalized(text): return re.sub(r"\s+", " ", text).strip()
def language(text):
    sample = f" {text.lower()} "
    en = sum(sample.count(f" {word} ") for word in ("the", "and", "of", "to", "with", "saving"))
    es = sum(sample.count(f" {word} ") for word in (" el", " la", " de", " y", " con", " para"))
    return "en" if en >= 3 and en > es * 1.25 else "es" if es >= 3 and es > en * 1.25 else "unknown"
def pdfs(): return sorted(SOURCE.glob("*.pdf")) if SOURCE.is_dir() else []
def sha(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""): h.update(block)
    return h.hexdigest()
def require_fitz():
    try:
        import fitz
        return fitz
    except ImportError as error:
        raise SystemExit("Falta PyMuPDF. Instale dependencias locales: python3 -m pip install -r scripts/requirements-pdf.txt") from error
def entry(path):
    fitz = require_fitz(); doc = fitz.open(path)
    first = "".join(page.get_text() for page in list(doc)[:3])
    digest = sha(path)
    return {"id": digest[:16], "path": str(path.resolve()), "fileName": path.name, "size": path.stat().st_size, "sha256": digest, "pageCount": len(doc), "language": language(first), "documentType": "unknown", "status": "pending"}
def scan():
    records=[]
    for path in pdfs():
        try: records.append(entry(path))
        except Exception as error: records.append({"id": hashlib.sha256(str(path).encode()).hexdigest()[:16], "path": str(path.resolve()), "fileName": path.name, "size": path.stat().st_size, "sha256": "", "pageCount": 0, "language": "unknown", "documentType": "unknown", "status": "error", "error": str(error)})
    DATA.mkdir(parents=True, exist_ok=True); INDEX.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    return records
def extract(record):
    fitz=require_fitz(); doc=fitz.open(record["path"]); folder=DATA/"corpus"/record["id"]; folder.mkdir(parents=True, exist_ok=True)
    pages, segments=[],[]; heading=""
    for number, page in enumerate(doc, 1):
        text=page.get_text("text"); pages.append({"document": record["id"], "page": number, "text": text, "metadata": {"width": page.rect.width, "height": page.rect.height}})
        for order, paragraph in enumerate(filter(None, (normalized(p) for p in text.split("\n\n"))), 1):
            kind="heading" if len(paragraph) < 110 and not paragraph.endswith(".") else "paragraph"
            if kind == "heading": heading=paragraph
            segments.append({"id": f'{record["id"]}-p{number}-s{order}', "language": record["language"] if record["language"] != "unknown" else language(paragraph), "sourceDocument": record["id"], "page": number, "text": paragraph, "textNormalized": normalized(paragraph), "textHash": hashlib.sha256(normalized(paragraph).encode()).hexdigest(), "type": kind, "heading": heading, "metadata": {"order": order}})
    for name, rows in (("pages.jsonl",pages),("segments.jsonl",segments)):
        (folder/name).write_text("".join(json.dumps(row,ensure_ascii=False)+"\n" for row in rows),encoding="utf-8")
    record["status"]="processed"; record["segmentCount"]=len(segments)
def main():
    command=sys.argv[1]; records=scan() if command in ("scan","extract") or not INDEX.exists() else json.loads(INDEX.read_text(encoding="utf-8"))
    if command == "extract":
        for record in records:
            if record["status"] != "error": extract(record)
        INDEX.write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding="utf-8")
    if command == "inspect":
        print(json.dumps(records,ensure_ascii=False,indent=2))
    elif command == "report":
        print(json.dumps({"source":str(SOURCE),"pdfs":len(records),"processed":sum(r["status"]=="processed" for r in records),"pages":sum(r["pageCount"] for r in records),"segments":sum(r.get("segmentCount",0) for r in records)},ensure_ascii=False,indent=2))
    else:
        for row in records: print(f'{row["fileName"]}\t{row["path"]}\t{row["size"]}\t{row["pageCount"]}\t{row["sha256"]}\t{row["language"]}\t{row["status"]}')
if __name__ == "__main__": main()
