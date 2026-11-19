"""Talking to the phone from the test suite.

The suite drives the real app, but it also needs to know what the phone
actually contains, and it needs to check that a phone is connected before it
starts.  All of that goes through the `adb` command line tool.

Nothing in here writes to the phone outside of `paths.DEVICE_TEMP_DIR`, and
nothing ever deletes a file.
"""

import os
import shutil
import subprocess

import paths


class AdbError(RuntimeError):
    """Raised when adb is missing or a command on the phone fails."""


class NoDeviceError(RuntimeError):
    """Raised when no usable phone is connected."""


def adb_path():
    """Locate the adb executable.

    The PATH is searched first; the Android SDK environment variables are
    used as a fallback so the suite also works in a shell that does not have
    the platform-tools directory on its PATH.
    """
    found = shutil.which('adb')
    if found:
        return found
    for variable in ('ANDROID_HOME', 'ANDROID_SDK_ROOT'):
        root = os.environ.get(variable)
        if not root:
            continue
        candidate = os.path.join(root, 'platform-tools', 'adb')
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    raise AdbError(
        'adb was not found. Install the Android platform-tools and make sure '
        'the adb command is on the PATH.')


def _run(args, timeout=60):
    """Run adb with the given arguments and return its stdout."""
    command = [adb_path()] + list(args)
    try:
        result = subprocess.run(command, capture_output=True, text=True,
                                timeout=timeout)
    except subprocess.TimeoutExpired:
        raise AdbError('adb %s timed out' % ' '.join(args))
    if result.returncode != 0:
        raise AdbError('adb %s failed (%d): %s'
                       % (' '.join(args), result.returncode,
                          (result.stderr or result.stdout).strip()))
    return result.stdout


def list_devices():
    """The phones adb knows about, as (identifier, status) pairs."""
    output = _run(['devices'])
    devices = []
    for line in output.splitlines():
        line = line.strip()
        if not line or line.startswith('List of devices'):
            continue
        if line.startswith('*'):
            # A daemon message, not a device.
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        devices.append((parts[0], parts[1]))
    return devices


def require_device():
    """The identifier of the connected phone, or explain why there is none.

    The suite needs a real phone: everything it checks happens over adb, so
    there is nothing meaningful to verify without one.
    """
    devices = list_devices()
    usable = [identifier for identifier, status in devices if status == 'device']
    if usable:
        return usable[0]
    if not devices:
        raise NoDeviceError(
            'No phone is connected.\n'
            'Connect a phone with USB debugging enabled, accept the '
            'authorisation prompt on the phone, and run the suite again.')
    details = ', '.join('%s (%s)' % pair for pair in devices)
    raise NoDeviceError(
        'No authorised phone is connected.\n'
        'Unlock the phone and accept the "Allow USB debugging" prompt, then '
        'run the suite again.\n'
        'adb sees: %s' % details)


def shell(device_id, command, timeout=60):
    """Run a shell command on the phone and return its stdout."""
    return _run(['-s', device_id, 'shell', command], timeout=timeout)


def list_remote(device_id, path):
    """The names of the entries of a directory on the phone."""
    output = shell(device_id, 'ls -A "%s"' % path)
    return [name for name in output.splitlines() if name.strip()]


def ensure_temp_dir(device_id):
    """Make sure the scratch directory exists on the phone.

    The suite works in `paths.DEVICE_TEMP_DIR` only. The directory is
    created when it is missing, and it is never removed.
    """
    shell(device_id, 'mkdir -p "%s"' % paths.DEVICE_TEMP_DIR)
    return paths.DEVICE_TEMP_DIR
