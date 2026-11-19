"""Locations the suite needs, every one of them derived at run time.

Nothing here encodes a particular machine: the app directory comes from this
file's location, the dist directory is a folder of the project, and the
device directory is a fixed path on the phone.
"""

import glob
import os
import shutil

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEST_DIR = os.path.join(APP_DIR, 'test')
DIST_DIR = os.path.join(APP_DIR, 'dist')

OUTPUT_DIR = os.path.join(TEST_DIR, 'output')

LOG_NAME = 'run.log'
REPORT_NAME = 'report.json'

# Every device-side operation of the suite is confined to this directory.
DEVICE_TEMP_DIR = '/sdcard/Download/temp'


def ensure_output_dir():
    """Create test/output/ if missing and return its path."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    return OUTPUT_DIR


def reset_output_dir():
    """Start each run from a clean output directory."""
    if os.path.isdir(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR, ignore_errors=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    return OUTPUT_DIR


def dist_packages():
    """The packaged builds in dist/, newest first.

    The file names carry a version number that changes with every release, so
    the suite lists the directory instead of naming a file.
    """
    packages = []
    for path in glob.glob(os.path.join(DIST_DIR, '*')):
        name = os.path.basename(path)
        if name.startswith('.'):
            continue
        if not os.path.isfile(path):
            continue
        packages.append(path)
    packages.sort(key=os.path.getmtime, reverse=True)
    return packages


def dist_package():
    """The packaged build used as the upload/download payload.

    Returns None when dist/ holds no package.
    """
    packages = dist_packages()
    if not packages:
        return None
    return packages[0]

