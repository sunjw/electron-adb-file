"""Runs the Electron ADB File end-to-end suite.

    python3 test/run_tests.py                  # everything
    python3 test/run_tests.py directory        # only suites/cases matching "directory"
    python3 test/run_tests.py -x               # stop at the first failure
    python3 test/run_tests.py -x device        # ...restricted to one suite

The app is launched and driven over the Chrome DevTools Protocol, so the
tests exercise the real renderer, the real adb calls and the real file list.

The suite drives a real phone over adb. The app is started even when no
phone is connected: the device dialog then comes up empty, and the cases
that need a phone fail with a message saying so.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from base import Runner, main                  # noqa: E402
import test_device                             # noqa: E402
import test_directory                          # noqa: E402
import test_upload                             # noqa: E402
import test_pull                               # noqa: E402

MODULES = [test_device, test_directory, test_upload, test_pull]


def parse_args(argv):
    fail_fast = False
    only = None
    for arg in argv:
        if arg in ('-x', '--fail-fast'):
            fail_fast = True
        else:
            only = arg
    return only, fail_fast


if __name__ == '__main__':
    only, fail_fast = parse_args(sys.argv[1:])
    runner = Runner(only=only, fail_fast=fail_fast)
    for module in MODULES:
        runner.add(module.suite)
    main(runner)
