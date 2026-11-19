"""Shared harness for the Electron ADB File end-to-end tests.

Playwright cannot launch Electron directly, so the app is started with a
Chromium DevTools Protocol port and the renderer is then attached over CDP.
The app is driven exactly like a browser page: the real toolbar buttons are
clicked, the real adb calls run, and the real file list is rendered.

Only `playwright` is required; there is no pytest dependency.
"""

import os
import re
import signal
import socket
import subprocess
import sys
import time
import traceback
import urllib.request

from playwright.sync_api import sync_playwright

import paths

APP_DIR = paths.APP_DIR
IS_WINDOWS = os.name == 'nt'


def _electron_binary():
    """The Electron executable to launch.

    `node_modules/.bin/electron` is a POSIX shell shim; on Windows it is not
    an executable at all, so use the packaged binary instead.
    """
    if IS_WINDOWS:
        return os.path.join(APP_DIR, 'node_modules', 'electron', 'dist', 'electron.exe')
    return os.path.join(APP_DIR, 'node_modules', '.bin', 'electron')


ELECTRON_BIN = _electron_binary()

_ANSI = re.compile(r'\x1b\[[0-9;]*m')

# Signatures of a genuine renderer failure, matched against console output.
# The app reports everything through utils.log(), i.e. plain console.log, so
# an uncaught exception only shows up as a page error or as console text that
# looks like an exception.
_ERROR_PATTERNS = (
    re.compile(r'^(EvalError|RangeError|TypeError|ReferenceError|SyntaxError|Error)\b'),
    re.compile(r'\bUncaught\b'),
    re.compile(r'\bUnhandled\b'),
    re.compile(r'violates the following Content Security Policy'),
)

# The app's own vocabulary, used to wait for a state instead of a timeout.
DEVICE_LINE = '#divDeviceList .deviceLine'
DEVICE_ID = '#divDeviceList .deviceLine .deviceId'
DEVICE_STATUS = '#divDeviceList .deviceLine .deviceStatus'
DEVICE_DIALOG = '#divDialogWrapper'
DIR_LIST = '#divDirList'
DIR_LINE = '#divDirList .fileLine'
DIR_FILE_NAME = '#divDirList .fileName'
DIR_SIZE = '#divDirList .fileTypeOrSize'
DIR_MODIFIED = '#divDirList .fileModified'
PATH_BAR = '#divToolbarPathContainer'
PATH_DEVICE = '#divToolbarPathDevice'
DIALOG_TITLE = '#divDialogTitle'

# The app shows this hint while an adb command is running.
WAITING_TIP = '#divTipsWaiting'

# The app logs this line once a directory listing has been rendered. It is
# the precise "the rows are the new ones" signal: the path bar is rebuilt
# before the adb call returns, so it changes too early to be useful.
LISTING_DONE_LOG = 'refreshDirList, fileLineCount='

# Buttons of the toolbar.
BTN_ANDROID = '#aBtnAndroid'
BTN_SDCARD = '#aBtnSdcard'
BTN_REFRESH = '#aBtnRefresh'
BTN_BACK = '#aBtnBack'
BTN_FORWARD = '#aBtnForward'
BTN_HIDDEN = '#aBtnHiddenFile'

# The app is driven over adb, so a round trip is much slower than a local
# render. The timeouts are generous but still bounded: a hang must show up as
# a failure instead of a run that never ends.
READY_TIMEOUT_MS = 20000
ACTION_TIMEOUT_MS = 10000


class TestFailure(AssertionError):
    """Raised by the expect_* helpers when an assertion does not hold."""


def expect_true(condition, message):
    if not condition:
        raise TestFailure(message)


def expect_eq(actual, expected, message):
    if actual != expected:
        raise TestFailure('%s (expected %r, got %r)' % (message, expected, actual))


def expect_contains(haystack, needle, message):
    if needle not in haystack:
        raise TestFailure('%s (%r not found in %r)' % (message, needle, str(haystack)[:200]))


def expect_not_contains(haystack, needle, message):
    if needle in haystack:
        raise TestFailure('%s (%r unexpectedly found in %r)' % (message, needle, str(haystack)[:200]))


def _strip_ansi(text):
    return _ANSI.sub('', text)


def _looks_like_error(text):
    stripped = text.strip()
    if not stripped:
        return False
    return any(pattern.search(stripped) for pattern in _ERROR_PATTERNS)


def _free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def _cdp_ready(port, proc, timeout):
    """Poll the CDP endpoint until Electron is serving it."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if proc.poll() is not None:
            raise TestFailure('Electron exited early with code %s' % proc.returncode)
        try:
            with urllib.request.urlopen('http://127.0.0.1:%d/json/version' % port, timeout=1):
                return True
        except Exception:
            time.sleep(0.3)
    raise TestFailure('Electron did not open CDP port %d within %ss' % (port, timeout))


class ElectronApp:
    """A running Electron instance with its renderer attached over CDP."""

    def __init__(self, launch_timeout=45):
        self.launch_timeout = launch_timeout
        self.proc = None
        self.pw = None
        self.browser = None
        self.page = None
        self.cdp = None
        self.port = None
        # Every renderer failure seen since launch; the app must stay empty.
        self.errors = []
        # Every console line the app logged, in order.
        self.logs = []
        # A test that provokes errors on purpose registers them here so the
        # per-case zero-error assertion does not fire on its own fixtures.
        self.expected_errors = []

    def __enter__(self):
        self.port = _free_port()
        popen_kwargs = dict(
            cwd=APP_DIR,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if IS_WINDOWS:
            # New process group so the whole tree can be killed at once.
            popen_kwargs['creationflags'] = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            popen_kwargs['start_new_session'] = True
        self.proc = subprocess.Popen(
            [ELECTRON_BIN, '.', '--remote-debugging-port=%d' % self.port],
            **popen_kwargs
        )
        _cdp_ready(self.port, self.proc, self.launch_timeout)

        self.pw = sync_playwright().start()
        self.browser = self.pw.chromium.connect_over_cdp('http://127.0.0.1:%d' % self.port)
        self.page = self._renderer_page()
        self.page.bring_to_front()

        # A CDP session is needed to hand a real file to the app.
        self.cdp = self.browser.contexts[0].new_cdp_session(self.page)

        self.page.on('console', self._on_console)
        self.page.on('pageerror', self._on_pageerror)

        # The app opens the device dialog on start-up; wait until the device
        # list has been filled in, since that is the first thing the tests
        # interact with.
        self.wait_for_device_line()
        return self

    def __exit__(self, *exc_info):
        try:
            if self.browser is not None:
                self.browser.close()
        except Exception:
            pass
        try:
            if self.pw is not None:
                self.pw.stop()
        except Exception:
            pass
        if self.proc is not None and self.proc.poll() is None:
            # Kill the whole process group: `electron` spawns helper processes.
            if IS_WINDOWS:
                self._kill_tree_windows()
            else:
                try:
                    os.killpg(os.getpgid(self.proc.pid), signal.SIGTERM)
                except Exception:
                    self.proc.terminate()
            try:
                self.proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                if not IS_WINDOWS:
                    try:
                        os.killpg(os.getpgid(self.proc.pid), signal.SIGKILL)
                    except Exception:
                        self.proc.kill()
                else:
                    self._kill_tree_windows(force=True)
        return False

    def _kill_tree_windows(self, force=False):
        """Terminate the Electron process and all of its children.

        `taskkill /T` walks the child processes, which is the Windows
        equivalent of killing the POSIX process group.
        """
        args = ['taskkill', '/F' if force else '/T', '/PID', str(self.proc.pid)]
        try:
            subprocess.run(args, stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL, timeout=15)
        except Exception:
            try:
                self.proc.kill()
            except Exception:
                pass

    def _renderer_page(self):
        for context in self.browser.contexts:
            for candidate in context.pages:
                if candidate.url.startswith('file://'):
                    return candidate
        raise TestFailure('no file:// renderer page found over CDP')

    def _on_console(self, message):
        text = message.text
        self.logs.append(text)
        if message.type == 'error' or _looks_like_error(text):
            self.errors.append('console.%s: %s' % (message.type, text))

    def _on_pageerror(self, error):
        self.errors.append('pageerror: %s' % error)

    # -- error tracking ----------------------------------------------------

    def error_mark(self):
        return len(self.errors)

    def errors_since(self, mark):
        return self.errors[mark:]

    def allow_errors(self, *needles):
        """Accept renderer errors matching `needles` for the current case."""
        self.expected_errors = list(needles)

    def _unexpected_errors(self, mark):
        found = self.errors_since(mark)
        if not self.expected_errors:
            return found
        return [entry for entry in found
                if not any(needle in entry for needle in self.expected_errors)]

    def expect_no_errors(self, mark, context):
        new_errors = self._unexpected_errors(mark)
        if new_errors:
            raise TestFailure('%s produced renderer errors:\n  %s'
                              % (context, '\n  '.join(new_errors)))

    def _abort_on_renderer_error(self, mark, what):
        """Turn a renderer exception into an immediate, readable failure.

        Every wait in this suite is also an implicit error detector: a broken
        renderer raises the moment the app touches the failing code, and
        waiting out a full timeout after that just looks like a hang.
        """
        new_errors = self._unexpected_errors(mark)
        if new_errors:
            raise TestFailure('aborted while waiting for %s:\n  %s'
                              % (what, '\n  '.join(new_errors)))

    # -- waiting -----------------------------------------------------------

    def wait_for_device_line(self, timeout=READY_TIMEOUT_MS):
        """Wait until the device dialog lists at least one visible device."""
        mark = self.error_mark()
        deadline = time.time() + timeout / 1000.0
        while time.time() < deadline:
            if self.count(DEVICE_LINE) > 0 and self.is_visible(DEVICE_LINE):
                return
            self._abort_on_renderer_error(mark, 'the device list')
            self.page.wait_for_timeout(150)
        raise TestFailure('no device showed up in the device dialog within %dms' % timeout)

    def wait_ready(self, selector, timeout=READY_TIMEOUT_MS, state='attached'):
        """Wait for a selector, aborting early if the renderer throws."""
        mark = self.error_mark()
        try:
            self.page.wait_for_selector(selector, state=state, timeout=timeout)
        except Exception:
            self._abort_on_renderer_error(mark, selector)
            raise

    def wait_until(self, expression, arg=None, timeout=READY_TIMEOUT_MS,
                   what='condition'):
        """Poll an expression in the page until it becomes truthy."""
        mark = self.error_mark()
        try:
            self.page.wait_for_function(expression, arg=arg, timeout=timeout)
        except Exception:
            self._abort_on_renderer_error(mark, what)
            raise TestFailure('timed out after %dms waiting for %s'
                              % (timeout, what))

    def wait_for_any(self, selectors, timeout=READY_TIMEOUT_MS):
        """Wait until at least one of the selectors is present."""
        mark = self.error_mark()
        deadline = time.time() + timeout / 1000.0
        while time.time() < deadline:
            for selector in selectors:
                if self.count(selector) > 0:
                    return selector
            self._abort_on_renderer_error(mark, 'any of %s' % ', '.join(selectors))
            self.page.wait_for_timeout(150)
        raise TestFailure('none of %s appeared within %dms' % (selectors, timeout))

    # -- page helpers ------------------------------------------------------

    def text(self, selector):
        return self.page.evaluate(
            '() => { const el = document.querySelector(%r); return el ? el.textContent : null; }'
            % selector)

    def texts(self, selector):
        return self.page.evaluate(
            '() => [...document.querySelectorAll(%r)].map(el => el.textContent)' % selector)

    def count(self, selector):
        return self.page.evaluate('document.querySelectorAll(%r).length' % selector)

    def hash(self):
        return self.page.evaluate('window.location.hash')

    def attr(self, selector, name):
        return self.page.evaluate(
            'sel => { const el = document.querySelector(sel); return el ? el.getAttribute(%r) : null; }'
            % name, selector)

    def click(self, selector):
        self.page.click(selector, timeout=ACTION_TIMEOUT_MS)

    def is_disabled(self, selector):
        """The app marks a disabled toolbar button with the `disabled` class."""
        return self.page.evaluate(
            'sel => { const el = document.querySelector(sel); return !!el && el.classList.contains("disabled"); }',
            selector)

    # -- app specific ------------------------------------------------------

    def device_ids(self):
        """The device identifiers shown in the device dialog."""
        return self.page.evaluate(
            """() => [...document.querySelectorAll('#divDeviceList .deviceLine .deviceId')]
                   .map(el => el.textContent.trim())""")

    def device_statuses(self):
        return self.page.evaluate(
            """() => [...document.querySelectorAll('#divDeviceList .deviceLine .deviceStatus')]
                   .map(el => el.textContent.trim())""")

    def current_device(self):
        """The device the app is currently working with."""
        text = self.text(PATH_DEVICE)
        if not text:
            return None
        for part in text.split(':'):
            part = part.strip()
            if part and part != 'No device selected':
                return part
        return None

    def path_text(self):
        """The path shown in the path bar."""
        return (self.text(PATH_BAR) or '').strip()

    def dir_entries(self):
        """The rows of the file list, as plain dictionaries.

        The file name is read from the `data-ref` attribute, which holds the
        raw name; the visible link text is HTML-escaped.
        """
        return self.page.evaluate(
            """() => [...document.querySelectorAll('#divDirList .fileLine')].map(row => ({
                   name: (row.querySelector('.fileName') || {}).getAttribute
                           ? row.querySelector('.fileName').getAttribute('data-ref') : '',
                   isDir: !!row.querySelector('.fileName.fileDir'),
                   size: (row.querySelector('.fileTypeOrSize') || {}).textContent || '',
                   modified: (row.querySelector('.fileModified') || {}).textContent || '',
               }))""")

    def dir_names(self):
        return [entry['name'] for entry in self.dir_entries()]

    def click_dir_entry(self, name, timeout=READY_TIMEOUT_MS):
        """Click the link of the file list row with the given name.

        The name is matched against the raw `data-ref` attribute, so names
        with spaces or other special characters are handled correctly.
        """
        index = self.page.evaluate(
            """name => {
                 const rows = [...document.querySelectorAll('#divDirList .fileLine')];
                 return rows.findIndex(row => {
                     const el = row.querySelector('.fileName');
                     return el && el.getAttribute('data-ref') === name;
                 });
             }""", name)
        if index < 0:
            raise TestFailure('no file list row named %r (rows: %r)'
                              % (name, self.dir_names()))
        link = self.page.locator(DIR_LINE).nth(index).locator('.fileNameLink a')
        link.click(timeout=timeout)

    def wait_for_path(self, expected, timeout=READY_TIMEOUT_MS):
        """Wait until the path bar shows the given path.

        The path bar is rebuilt before the adb call returns, so it changes
        too early. Use `wait_for_listing` to wait for the rows themselves.
        """
        self.wait_until(
            """expected => {
                 const el = document.querySelector('#divToolbarPathContainer');
                 if (!el) { return false; }
                 return el.textContent.replace(/\\s+/g, ' ').trim().indexOf(expected) >= 0;
             }""",
            arg=expected, timeout=timeout,
            what='the path bar to show %r' % expected)

    def open_dir(self, path, timeout=READY_TIMEOUT_MS):
        """Walk into a directory by clicking through it.

        The app has no "go to path" box, so the directory is opened the way
        a person would: by clicking each part of the path in turn. Every
        step waits for the listing of the new directory.
        """
        parts = [part for part in path.split('/') if part]
        for part in parts:
            mark = self.listing_mark()
            self.click_dir_entry(part)
            self.wait_for_listing(mark, timeout=timeout)
            self.wait_for_path(part, timeout=timeout)

    def drop_file(self, path, timeout=ACTION_TIMEOUT_MS):
        """Drop a local file onto the file list, the way the app is used.

        The app reads the native path of the dropped file, so a synthetic
        drag event is not enough: the file has to come from the file system.
        A hidden file input is filled with the real path over CDP and the
        resulting file is then handed to the app in a drop event.
        """
        if self.cdp is None:
            raise TestFailure('no CDP session, cannot drop a file')

        # Fill a file input with the real file. Playwright refuses to upload
        # files over 50 MB, and the packages in dist/ are much larger, so the
        # input is filled over CDP instead, which only needs the path.
        self.page.evaluate(
            """() => {
                 let input = document.querySelector('#testFileInput');
                 if (!input) {
                     input = document.createElement('input');
                     input.type = 'file';
                     input.id = 'testFileInput';
                     input.style.display = 'none';
                     document.body.appendChild(input);
                 }
                 input.value = '';
             }""")
        root = self.cdp.send('DOM.getDocument')['root']['nodeId']
        node_id = self.cdp.send('DOM.querySelector',
                                {'nodeId': root, 'selector': '#testFileInput'})['nodeId']
        self.cdp.send('DOM.setFileInputFiles', {'files': [path], 'nodeId': node_id})

        # Hand the file to the app the way a drag from the file manager does.
        self.page.evaluate(
            """() => {
                 const input = document.querySelector('#testFileInput');
                 const file = input.files[0];
                 if (!file) { throw new Error('the file input holds no file'); }
                 const transfer = new DataTransfer();
                 transfer.items.add(file);
                 const target = document.querySelector('#divDirWrapper');
                 for (const type of ['dragenter', 'dragover']) {
                     target.dispatchEvent(new DragEvent(type, {
                         bubbles: true, cancelable: true, dataTransfer: transfer,
                     }));
                 }
                 target.dispatchEvent(new DragEvent('drop', {
                     bubbles: true, cancelable: true, dataTransfer: transfer,
                 }));
                 input.remove();
             }""")

    def transfer_rows(self):
        """The rows of the transfer list, as plain dictionaries."""
        return self.page.evaluate(
            """() => [...document.querySelectorAll('#divTransferList .transferLine')].map(row => ({
                   name: (row.querySelector('.fileName') || {}).textContent || '',
                   progress: (row.querySelector('.transferProgress') || {}).textContent || '',
                   finished: !!row.querySelector('.transferProgress.finished'),
               }))""")

    def transfer_row(self, name):
        """The transfer row of the given file, or None."""
        for row in self.transfer_rows():
            if row['name'] == name:
                return row
        return None

    def wait_for_transfer(self, name, timeout=READY_TIMEOUT_MS):
        """Wait until a transfer of the given file has finished."""
        mark = self.error_mark()
        deadline = time.time() + timeout / 1000.0
        while time.time() < deadline:
            row = self.transfer_row(name)
            if row is not None and row['finished']:
                return row
            self._abort_on_renderer_error(mark, 'the transfer of %r' % name)
            self.page.wait_for_timeout(200)
        raise TestFailure('the transfer of %r did not finish within %dms'
                          % (name, timeout))

    def listing_mark(self):
        """A marker for the directory listings logged so far."""
        return len(self.logs)

    def wait_for_listing(self, mark=None, timeout=READY_TIMEOUT_MS):
        """Wait until a directory listing has been rendered.

        The app logs `refreshDirList, fileLineCount=N` right after it has
        filled the file list, so that log line is the exact moment the rows
        are the new ones. Waiting for the path bar instead would return too
        early, because the app rebuilds the path bar before the adb call
        comes back.
        """
        if mark is None:
            mark = 0
        deadline = time.time() + timeout / 1000.0
        while time.time() < deadline:
            for line in self.logs[mark:]:
                if LISTING_DONE_LOG in line:
                    return
            self.page.wait_for_timeout(100)
        raise TestFailure('no directory listing was rendered within %dms' % timeout)

    def dialog_open(self):
        """Whether the modal is currently shown."""
        return self.page.evaluate(
            """() => {
                 const modal = document.querySelector('#divDialogWrapper');
                 return !!modal && modal.classList.contains('show');
             }""")

    def wait_for_dialog_closed(self, timeout=READY_TIMEOUT_MS):
        """Wait until the modal and its backdrop are gone.

        Bootstrap fades the dialog out and removes the backdrop afterwards.
        The backdrop keeps swallowing clicks while it is around, so every
        action that follows a dialog has to wait for it.
        """
        self.wait_until(
            """() => {
                 const modal = document.querySelector('#divDialogWrapper');
                 const backdrop = document.querySelector('.modal-backdrop');
                 const modalOpen = modal && modal.classList.contains('show');
                 return !modalOpen && !backdrop;
             }""",
            timeout=timeout, what='the dialog to close')

    def open_device_dialog(self, timeout=READY_TIMEOUT_MS):
        """Make sure the device dialog is open.

        The app opens the dialog on start-up, but closes it again once a
        device is chosen, so the device link in the path bar is used to
        bring it back.
        """
        if self.dialog_open() and self.count(DEVICE_LINE) > 0:
            self.wait_for_device_line(timeout=timeout)
            return

        # A dialog that is on its way out still has a backdrop around, and
        # that backdrop swallows the click on the path bar.
        self.wait_until(
            """() => !document.querySelector('.modal-backdrop')""",
            timeout=timeout, what='the dialog backdrop to go away')

        self.page.locator('#divToolbarPathDevice a').first.click(timeout=timeout)
        self.wait_for_device_line(timeout=timeout)



    def is_visible(self, selector):
        return self.page.locator(selector).first.is_visible()

    def select_device(self, device_id=None, timeout=READY_TIMEOUT_MS):
        """Select a device in the device dialog.

        When no device id is given the first listed device is used. Selecting
        a device closes the dialog and loads the root directory.
        """
        self.open_device_dialog(timeout=timeout)
        self.wait_for_device_line(timeout=timeout)
        ids = self.device_ids()
        expect_true(ids, 'the device dialog lists no device')
        if device_id is None:
            device_id = ids[0]
        expect_contains(ids, device_id, 'device %r is not listed' % device_id)

        index = ids.index(device_id)
        link = self.page.locator(DEVICE_ID).nth(index).locator('a')
        # Selecting a device loads the root directory, so the listing that
        # follows has to be waited for as well.
        mark = self.listing_mark()
        link.click(timeout=timeout)

        # The dialog is hidden first, the device is selected afterwards.
        self.wait_for_dialog_closed(timeout=timeout)
        self.wait_until(
            """device => {
                 const el = document.querySelector('#divToolbarPathDevice');
                 return !!el && el.textContent.indexOf(device) >= 0;
             }""",
            arg=device_id, timeout=timeout,
            what='device %r to be selected' % device_id)
        self.wait_for_listing(mark, timeout=timeout)
        return device_id



class Suite:
    """A named group of test cases."""

    def __init__(self, name):
        self.name = name
        self.cases = []

    def case(self, title):
        def decorator(fn):
            self.cases.append((title, fn))
            return fn
        return decorator


class Runner:
    """Runs every suite and prints a report. Exit code 1 on any failure."""

    GREEN = '\033[32m'
    RED = '\033[31m'
    YELLOW = '\033[33m'
    DIM = '\033[2m'
    RESET = '\033[0m'

    def __init__(self, only=None, fail_fast=False):
        self.suites = []
        self.only = only
        self.fail_fast = fail_fast

    def add(self, suite):
        self.suites.append(suite)

    def run(self):
        passed, failures = 0, []
        results = []
        log_lines = []
        aborted = False

        def emit(line=''):
            print(line)
            log_lines.append(line)

        emit(self.DIM + 'launching electron (one instance for the whole run)...' + self.RESET)
        with ElectronApp() as app:
            for suite in self.suites:
                if aborted:
                    break
                emit('\n%s== %s ==%s' % (self.YELLOW, suite.name, self.RESET))
                for title, fn in suite.cases:
                    if self.only and self.only not in title and self.only not in suite.name:
                        continue
                    # Every case starts without renderer errors left over.
                    mark = app.error_mark()
                    app.allow_errors()
                    started = time.time()
                    try:
                        fn(app)
                        app.expect_no_errors(mark, title)
                    except Exception as exc:
                        elapsed = time.time() - started
                        errors = app._unexpected_errors(mark)
                        failures.append((suite.name, title, exc, traceback.format_exc()))
                        results.append({
                            'suite': suite.name, 'case': title, 'status': 'fail',
                            'seconds': round(elapsed, 2),
                            'message': str(exc), 'renderer_errors': errors,
                        })
                        emit('  %sFAIL%s %s %s(%.1fs)%s'
                             % (self.RED, self.RESET, title, self.DIM, elapsed, self.RESET))
                        # A renderer exception is systemic, not a one-off: every
                        # remaining case would burn its full timeout and the run
                        # would look hung. Stop here instead.
                        if self.fail_fast or errors:
                            aborted = True
                            if not self.fail_fast and errors:
                                emit('    %srenderer error - stopping the run%s'
                                     % (self.DIM, self.RESET))
                            break
                        continue
                    elapsed = time.time() - started
                    passed += 1
                    results.append({
                        'suite': suite.name, 'case': title, 'status': 'pass',
                        'seconds': round(elapsed, 2),
                    })
                    emit('  %sok%s   %s %s(%.1fs)%s'
                         % (self.GREEN, self.RESET, title, self.DIM, elapsed, self.RESET))

        emit('')
        if aborted:
            emit('%saborted after the first failure%s' % (self.RED, self.RESET))
        if failures:
            for suite_name, title, exc, tb in failures:
                emit('%sFAILED%s %s / %s' % (self.RED, self.RESET, suite_name, title))
                if isinstance(exc, TestFailure):
                    emit('    %s' % exc)
                else:
                    emit(self.DIM + tb + self.RESET)
            emit('\n%s%d passed, %d failed%s'
                 % (self.RED, passed, len(failures), self.RESET))
        else:
            emit('%sall %d tests passed%s' % (self.GREEN, passed, self.RESET))

        self._write_artifacts(log_lines, results, passed, len(failures))
        return 1 if failures else 0

    def _write_artifacts(self, log_lines, results, passed, failed):
        """Persist the run under test/output/ for later inspection."""
        import json
        try:
            directory = paths.reset_output_dir()
            plain = '\n'.join(_strip_ansi(line) for line in log_lines)
            with open(os.path.join(directory, paths.LOG_NAME), 'w') as handle:
                handle.write(plain + '\n')
            with open(os.path.join(directory, paths.REPORT_NAME), 'w') as handle:
                json.dump({
                    'passed': passed,
                    'failed': failed,
                    'total': passed + failed,
                    'results': results,
                }, handle, indent=2, ensure_ascii=False)
            print(self.DIM + 'artefacts: %s' % directory + self.RESET)
        except Exception as exc:  # never fail the run because of logging
            print(self.DIM + 'could not write artefacts: %s' % exc + self.RESET)


def main(runner):
    sys.exit(runner.run())
