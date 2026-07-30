#!/usr/bin/env python3
"""Check the adjacent issue-monitoring sample's per-issue error shape.

This asserts one narrow thing about the frozen sibling file: after an injected
failure inside `process_single_issue`, the coroutine still returns its normal
two-value metrics tuple, so the caller cannot tell the audit did not happen.
It makes no claim about that sample's batch accounting or exit status.
"""

from __future__ import annotations

import asyncio
import importlib.util
import pathlib
import sys
from types import ModuleType

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from adk_fakes import (
    FailingRunner,
    SIBLING_MAIN,
    install_sibling_fakes,
    require_target,
)


def load_module(name: str, path: pathlib.Path) -> ModuleType:
  spec = importlib.util.spec_from_file_location(name, path)
  if spec is None or spec.loader is None:
    raise RuntimeError(f"cannot load {path}")
  module = importlib.util.module_from_spec(spec)
  sys.modules[name] = module
  spec.loader.exec_module(module)
  return module


async def main() -> None:
  require_target()
  install_sibling_fakes()
  sibling_main = load_module("adk_issue_monitoring_agent.main", SIBLING_MAIN)
  result = await sibling_main.process_single_issue(
      FailingRunner(), 404, maintainers=[]
  )
  if not isinstance(result, tuple) or len(result) != 2:
    raise AssertionError("sibling path did not return its normal metrics tuple")
  print("SIBLING_RETURNED_AFTER_ERROR=true")


if __name__ == "__main__":
  asyncio.run(main())
