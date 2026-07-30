#!/usr/bin/env python3
"""Run the frozen `adk_stale_agent/main.py` as `__main__` with fake boundaries.

The frozen file is executed under `run_name="__main__"` so its own top-level
handler decides the process status. This script deliberately adds no exit
handling of its own: whatever status the frozen entry point produces is the
status this process returns, and that is the number the harness records.
"""

from __future__ import annotations

import pathlib
import runpy
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from adk_fakes import STALE_MAIN, install_stale_agent_fakes, require_target

require_target()
install_stale_agent_fakes()
print("EVIDENCE_CLASS=synthetic-orchestration", flush=True)
print("NETWORK_REQUIRED=false", flush=True)
print("SECRET_REQUIRED=false", flush=True)
runpy.run_path(str(STALE_MAIN), run_name="__main__")
