#!/usr/bin/env python3
"""Deterministic boundary fakes for the frozen ADK maintenance samples.

Only the boundaries are replaced: issue discovery, the agent runner, the ADK
logging helper and the `google.genai` content types. The control flow under
test is the frozen upstream file itself, loaded from the checked-out target.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace

REPO_ROOT = Path(__file__).resolve().parents[1]
TARGET_ROOT = Path(
    os.environ.get("ADK_TARGET_DIR", REPO_ROOT / ".work" / "upstream")
).resolve()
SAMPLES_ROOT = TARGET_ROOT / "contributing" / "samples" / "adk_team"

STALE_MAIN = SAMPLES_ROOT / "adk_stale_agent" / "main.py"
SIBLING_MAIN = SAMPLES_ROOT / "adk_issue_monitoring_agent" / "main.py"

ISSUES = [101, 202, 303]


def install_module(name: str, **attributes: object) -> ModuleType:
  module = ModuleType(name)
  for key, value in attributes.items():
    setattr(module, key, value)
  sys.modules[name] = module
  return module


class FakeSessionService:

  async def create_session(self, **_: object) -> SimpleNamespace:
    return SimpleNamespace(id="synthetic-session")


class FailingRunner:
  """Runner whose streaming call always raises before yielding an event."""

  def __init__(self, **_: object) -> None:
    self.session_service = FakeSessionService()

  async def run_async(self, **_: object):
    if False:
      yield None
    raise RuntimeError("synthetic runner failure")


class FakePart:

  def __init__(self, text: str) -> None:
    self.text = text


class FakeContent:

  def __init__(self, role: str, parts: list[FakePart]) -> None:
    self.role = role
    self.parts = parts


class FakeLogs:

  @staticmethod
  def setup_adk_logger(**_: object) -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s %(message)s",
        force=True,
    )


def require_target() -> None:
  """Fail loudly when the frozen target is not checked out."""
  if not STALE_MAIN.is_file():
    raise SystemExit(
        f"frozen target file not found: {STALE_MAIN}\n"
        "run `npm run target:checkout` first"
    )


def install_shared_fakes() -> None:
  for name in (
      "adk_stale_agent",
      "adk_issue_monitoring_agent",
      "google",
      "google.adk",
      "google.adk.cli",
  ):
    install_module(name)
  install_module("google.adk.cli.utils", logs=FakeLogs())
  install_module("google.adk.runners", InMemoryRunner=FailingRunner)
  install_module(
      "google.genai",
      types=SimpleNamespace(Content=FakeContent, Part=FakePart),
  )


def install_stale_agent_fakes() -> None:
  """Boundary fakes for `adk_stale_agent.main`."""
  counter = {"value": 0}

  def reset_api_call_count() -> None:
    counter["value"] = 0

  install_shared_fakes()
  install_module("adk_stale_agent.agent", root_agent=object())
  install_module(
      "adk_stale_agent.settings",
      CONCURRENCY_LIMIT=3,
      OWNER="synthetic-owner",
      REPO="synthetic-repo",
      SLEEP_BETWEEN_CHUNKS=0,
      STALE_HOURS_THRESHOLD=24,
  )
  install_module(
      "adk_stale_agent.utils",
      get_api_call_count=lambda: counter["value"],
      get_old_open_issue_numbers=lambda *_args, **_kwargs: list(ISSUES),
      reset_api_call_count=reset_api_call_count,
  )


def install_sibling_fakes() -> None:
  """Boundary fakes for `adk_issue_monitoring_agent.main`."""

  def fail_issue_details(*_args: object) -> object:
    raise RuntimeError("synthetic sibling fetch failure")

  install_shared_fakes()
  install_module("adk_issue_monitoring_agent.agent", root_agent=object())
  install_module(
      "adk_issue_monitoring_agent.settings",
      BOT_ALERT_SIGNATURE="synthetic-signature",
      BOT_NAME="synthetic-bot",
      CONCURRENCY_LIMIT=3,
      OWNER="synthetic-owner",
      REPO="synthetic-repo",
      SLEEP_BETWEEN_CHUNKS=0,
  )
  install_module(
      "adk_issue_monitoring_agent.utils",
      get_api_call_count=lambda: 0,
      get_issue_comments=lambda *_args: [],
      get_issue_details=fail_issue_details,
      get_repository_maintainers=lambda *_args: [],
      get_target_issues=lambda *_args: [404],
      reset_api_call_count=lambda: None,
  )
