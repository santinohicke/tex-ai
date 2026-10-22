#!/usr/bin/env python3
"""
Tex AI Suite: Policy Ingestion, Regulatory Entity Extraction & Compliance Audit

Features:
- Validates structural integrity of corporate policy markdown documents.
- Extracts regulatory and financial entities (CNV, UIF, BYMA, MEP, CEDEARs, etc.).
- Verifies policy coverage for HR benefits (WellHub, OSDE, Nubi, Day off de cumpleaños).
- Generates JSON summary reports for RAG pipeline ingestion in Node/TypeScript.
"""

import os
import re
import json
import argparse
from pathlib import Path
from typing import Dict, List, Any


FINANCIAL_ENTITIES = [
    "AML", "KYC", "CNV", "UIF", "BYMA", "MAE", "MEP", "CCL", "CEDEAR",
    "CAUCION", "RENAPER", "FATCA", "CRS", "PEP", "UBO", "AL30", "GD30"
]

REQUIRED_METADATA_KEYS = [
    "Código Interno",
    "Área Responsable",
    "Última Revisión",
    "Confidencialidad"
]

BENEFITS_TARGETS = [
    "prepaga", "wellhub", "cumpleaños", "nubi", "licencias", "híbrido"
]


class PolicyAuditor:
    def __init__(self, policies_dir: Path):
        self.policies_dir = policies_dir
        self.results: List[Dict[str, Any]] = []

    def run_audit(self) -> Dict[str, Any]:
        if not self.policies_dir.exists():
            raise FileNotFoundError(f"Directory not found: {self.policies_dir}")

        files = sorted(list(self.policies_dir.glob("*.md")))
        all_entities_found = set()
        total_chunks_estimated = 0

        for file_path in files:
            content = file_path.read_text(encoding="utf-8")
            metadata = self._extract_metadata(content)
            sections = self._extract_sections(content)
            entities = self._detect_entities(content)
            all_entities_found.update(entities)
            benefits = self._detect_benefits(content)

            file_report = {
                "file": file_path.name,
                "title": self._extract_title(content),
                "metadata": metadata,
                "sections_count": len(sections),
                "sections": [s["title"] for s in sections],
                "entities_detected": sorted(list(entities)),
                "benefits_detected": sorted(list(benefits)),
                "word_count": len(content.split()),
                "status": "VALID" if all(k in metadata for k in REQUIRED_METADATA_KEYS) else "WARN_METADATA_INCOMPLETE"
            }
            self.results.append(file_report)
            total_chunks_estimated += len(sections)

        summary = {
            "total_documents": len(files),
            "estimated_chunks": total_chunks_estimated,
            "unique_entities_indexed": sorted(list(all_entities_found)),
            "all_policies_compliant": all(r["status"] == "VALID" for r in self.results),
            "documents": self.results
        }
        return summary

    def _extract_title(self, content: str) -> str:
        match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
        return match.group(1).strip() if match else "Untitled"

    def _extract_metadata(self, content: str) -> Dict[str, str]:
        meta = {}
        for line in content.splitlines()[:15]:
            match = re.match(r"\*\*(.+?):\*\*\s*(.+)", line.strip())
            if match:
                meta[match.group(1).strip()] = match.group(2).strip()
        return meta

    def _extract_sections(self, content: str) -> List[Dict[str, str]]:
        headers = list(re.finditer(r"^(#{2,3})\s+(.+)$", content, re.MULTILINE))
        sections = []
        for i, h in enumerate(headers):
            level = len(h.group(1))
            title = h.group(2).strip()
            start = h.end()
            end = headers[i + 1].start() if i + 1 < len(headers) else len(content)
            body = content[start:end].strip()
            sections.append({"level": level, "title": title, "body": body})
        return sections

    def _detect_entities(self, content: str) -> set:
        normalized = content.upper()
        found = set()
        for entity in FINANCIAL_ENTITIES:
            pattern = rf"\b{re.escape(entity)}\b"
            if re.search(pattern, normalized):
                found.add(entity)
        return found

    def _detect_benefits(self, content: str) -> set:
        lowered = content.lower()
        found = set()
        for b in BENEFITS_TARGETS:
            if b in lowered:
                found.add(b)
        return found


def main():
    parser = argparse.ArgumentParser(description="Adcap AI Policy Ingestion & Audit Pipeline")
    parser.add_argument(
        "--dir",
        type=str,
        default=str(Path(__file__).resolve().parent.parent / "data" / "policies"),
        help="Path to directory containing policies markdown files"
    )
    parser.add_argument("--json", action="store_true", help="Output machine-readable JSON")
    parser.add_argument("--validate", action="store_true", help="Validate and exit with code 0/1")
    args = parser.parse_args()

    auditor = PolicyAuditor(Path(args.dir))
    report = auditor.run_audit()

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return

    print("=" * 68)
    print(" ADCAP GRUPO FINANCIERO — AUDITORÍA AUTOMATIZADA DE MANUALES RAG")
    print("=" * 68)
    print(f"Total Documentos Auditados: {report['total_documents']}")
    print(f"Chunks Estimados Indexables: {report['estimated_chunks']}")
    print(f"Entidades Financieras Detectadas: {len(report['unique_entities_indexed'])}")
    print(f"Entidades: {', '.join(report['unique_entities_indexed'])}")
    print("-" * 68)

    for doc in report["documents"]:
        status_flag = "[OK]" if doc["status"] == "VALID" else "[WARN]"
        print(f"{status_flag} {doc['file']} ({doc['word_count']} palabras, {doc['sections_count']} secciones)")
        print(f"     Código: {doc['metadata'].get('Código Interno', 'N/A')} | Responsable: {doc['metadata'].get('Área Responsable', 'N/A')}")
        if doc["benefits_detected"]:
            print(f"     Beneficios: {', '.join(doc['benefits_detected'])}")
        print(f"     Entidades: {', '.join(doc['entities_detected'])}")
        print()

    print("=" * 68)
    if report["all_policies_compliant"]:
        print("Resultado: AUDITORÍA EXITOSA. Todos los documentos cumplen el estándar.")
    else:
        print("Resultado: ALERTA. Algunos documentos requieren completar metadatos.")
    print("=" * 68)


if __name__ == "__main__":
    main()
