#!/usr/bin/env python3
"""
Self-check unit test for Adcap AI Policy Ingestion & Audit Pipeline.
"""

import unittest
from pathlib import Path
from tex_audit import PolicyAuditor


class TestPolicyAuditor(unittest.TestCase):
    def setUp(self):
        self.policies_dir = Path(__file__).resolve().parent.parent / "data" / "policies"
        self.auditor = PolicyAuditor(self.policies_dir)

    def test_audit_execution(self):
        report = self.auditor.run_audit()
        self.assertGreaterEqual(report["total_documents"], 3)
        self.assertGreaterEqual(report["estimated_chunks"], 15)
        self.assertTrue(report["all_policies_compliant"])

    def test_financial_entities_detected(self):
        report = self.auditor.run_audit()
        entities = report["unique_entities_indexed"]
        for expected in ["AML", "KYC", "MEP", "CEDEAR", "UIF", "CNV"]:
            self.assertIn(expected, entities)

    def test_benefits_detected(self):
        report = self.auditor.run_audit()
        hr_doc = next(d for d in report["documents"] if "HR" in d["file"])
        self.assertIn("wellhub", hr_doc["benefits_detected"])
        self.assertIn("prepaga", hr_doc["benefits_detected"])
        self.assertIn("cumpleaños", hr_doc["benefits_detected"])


if __name__ == "__main__":
    unittest.main()
