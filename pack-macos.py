import os
import platform
import shlex
import shutil
import sys

from subprocess import Popen, PIPE, STDOUT

# Log to stdout
def log(message):
    print "%s" % (message)

# Log to stderr
def log_err(message):
    print >> sys.stderr, message

def run_cmd(cmd):
    log("Run: \n%s" % (cmd))
    os.system(cmd)

def run_cmd_with_stdio(cmd, input_data):
    log("Run: \n%s" % (cmd))
    p = Popen(shlex.split(cmd), stdout=PIPE, stdin=PIPE, stderr=STDOUT)
    return p.communicate(input = input_data)[0]

def run_cmd_with_stderr(cmd):
    log("Run: \n%s" % (cmd))
    p = Popen(shlex.split(cmd), stdout=PIPE, stdin=PIPE, stderr=PIPE)

    stdout_text, stderr_text = p.communicate()

    return stderr_text

def is_windows_sys():
    return (platform.system() == "Windows")

def fix_win_path(path):
    if is_windows_sys():
        return path.replace("/", "\\")
    else:
        return path

def find_strings_in_string(strings, in_string):
    for str_itr in strings:
        if in_string.find(str_itr) >= 0:
            return True

    return False

def copy_file(source, dest):
    shutil.copyfile(source, dest)

def copy_dir(source, dest):
    for filename in os.listdir(source):
        src_file = os.path.join(source, filename)
        dst_file = os.path.join(dest, filename)
        if os.path.isdir(src_file):
            if not os.path.exists(dst_file):
                os.mkdir(dst_file)
            copy_dir(src_file, dst_file)

        if os.path.isfile(src_file):
            copy_file(src_file, dst_file)

def remove_file(path):
    if os.path.exists(path):
        os.remove(path)

def remove_dir(path):
    if os.path.exists(path):
        shutil.rmtree(path)

def main():
    app_name = 'electron-adb-file.app'
    app_dir_path_relative = 'Contents/Resources/app'
    app_path_relative = '%s/%s' % (app_name, app_dir_path_relative)

    cwd = os.getcwd()

    # Update modules.
    run_cmd('npm install')

    # Extract old package and remove old app.
    os.chdir('dist')
    run_cmd('tar -xvf %s.tar.gz' % (app_name))
    remove_dir(app_path_relative)
    os.mkdir(app_path_relative)
    os.chdir(cwd)

    # Copy new app.
    app_dirs = ['asserts', 'css', 'js', 'node_modules']
    for app_dir in app_dirs:
        dest_app_dir = 'dist/%s/%s' % (app_path_relative, app_dir)
        os.mkdir(dest_app_dir)
        copy_dir(app_dir, dest_app_dir)

    app_files = ['index.html', 'main.js', 
                'package.json', 'package-lock.json', 
                'README.md', 'LICENSE']
    for app_file in app_files:
        copy_file(app_file, 'dist/%s/%s' % (app_path_relative, app_file))

    # Rebuild and clean.
    os.chdir('dist/%s' % (app_path_relative))
    run_cmd('npm rebuild')
    remove_dir('node_modules/electron/dist')
    os.chdir(cwd)

    # Package.
    os.chdir('dist')
    remove_file('%s.tar.gz' % (app_name))
    run_cmd('tar -czvf %s.tar.gz %s' % (app_name, app_name))
    remove_dir(app_name)

if __name__ == '__main__':
    main()