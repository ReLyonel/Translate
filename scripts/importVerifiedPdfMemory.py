"""Index user-verified PDF references privately, without inventing bilingual pairs."""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
import pdf_corpus as corpus


def main():
    source = Path(sys.argv[1]).resolve(strict=True)
    destination = Path(os.environ['APPDATA']) / 'foundry-translator' / 'translation-memory' / 'pdf-reference'
    destination.mkdir(parents=True, exist_ok=True)
    corpus.DATA = destination
    documents = []
    for pdf in sorted(source.glob('*.pdf')):
        if pdf.is_symlink():
            raise ValueError('PDF_LINK_NOT_ALLOWED')
        record = corpus.entry(pdf)
        corpus.extract(record)
        if corpus.sha(pdf) != record['sha256']:
            raise ValueError('PDF_CHANGED_DURING_IMPORT')
        record.update({
            'pages_sha256': corpus.sha(destination / 'corpus' / record['id'] / 'pages.jsonl'),
            'segments_sha256': corpus.sha(destination / 'corpus' / record['id'] / 'segments.jsonl'),
            'source_verification': 'USER_VERIFIED',
            'source_verified': True,
            'verification_scope': 'DOCUMENT_ONLY_NOT_BILINGUAL_ALIGNMENT',
            'verified_at': datetime.now(timezone.utc).isoformat(),
            'approved_translation_pairs': 0,
            'documentType': 'reference',
        })
        documents.append(record)
    if not documents:
        raise ValueError('NO_PDF_REFERENCES')
    manifest = {
        'schema_version': 1,
        'policy': 'VERIFIED_REFERENCE_ALIGNMENT_REQUIRED',
        'documents': documents,
    }
    temporary = destination / 'index.json.tmp'
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    temporary.replace(destination / 'index.json')
    report = {'schema_version': 1, 'source_documents_verified': len(documents),
              'pages': sum(row['pageCount'] for row in documents),
              'segments': sum(row['segmentCount'] for row in documents),
              'approved_translation_pairs': 0,
              'documents': [{key: row[key] for key in ['fileName', 'sha256', 'language', 'pageCount', 'segmentCount']} for row in documents],
              'source_files_unchanged': True, 'inference_requests': 0}
    reports = Path('reports/thermal-memory')
    reports.mkdir(parents=True, exist_ok=True)
    (reports / 'pdf-memory.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=True))


if __name__ == '__main__':
    main()
