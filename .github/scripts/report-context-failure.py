"""Expose bounded CI test diagnostics without requiring authenticated log access."""
import pathlib
import shutil
import sys

log = pathlib.Path(sys.argv[1])
if log.exists():
    target = pathlib.Path("test-results/context-validation.log")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(log, target)
    tail = log.read_text(errors="replace")[-5000:]
    escaped = tail.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
    title = sys.argv[2] if len(sys.argv) > 2 else "Visual validation output"
    print("::error title=" + title + "::" + escaped)
