import sys

try:
    import asyncore as _asyncore
except ModuleNotFoundError:
    import pyasyncore as _asyncore
    sys.modules["asyncore"] = _asyncore
