import os
import platform
import shlex
import shutil
import stat
import sys

from subprocess import Popen, PIPE, STDOUT

# Log to stdout
def log(message):
    print('%s' % (message))

# Log to stderr
def log_err(message):
    print(message, file=sys.stderr)

def run_cmd(cmd):
    log('Run: \n%s' % (cmd))
    os.system(cmd)

def run_cmd_with_stdio(cmd, input_data):
    log('Run: \n%s' % (cmd))
    p = Popen(shlex.split(cmd), stdout=PIPE, stdin=PIPE, stderr=STDOUT)
    return p.communicate(input = input_data)[0]

def run_cmd_with_stderr(cmd):
    log('Run: \n%s' % (cmd))
    p = Popen(shlex.split(cmd), stdout=PIPE, stdin=PIPE, stderr=PIPE)

    stdout_text, stderr_text = p.communicate()

    return stderr_text

def is_windows_sys():
    return (platform.system() == 'Windows')

def is_macos_sys():
    return (platform.system() == 'Darwin')

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
    shutil.copyfile(source, dest, follow_symlinks=False)

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

def read_file_content(file_path):
    if not os.path.exists(file_path):
        return ''
    file_content = open(file_path, 'rb').read()
    return file_content

def write_file_content(file_path, file_content):
    file_obj = open(file_path, 'wb')
    file_obj.write(file_content)
    file_obj.close()

def log_stage(stage_message):
    log('\n%s\n' % (stage_message))

def main():
    app_title = 'electron-adb-file'
    package_name = 'electron-adb-file'
    app_name = package_name + '.app'
    app_dir_path_relative = 'Contents/Resources/app'
    if is_windows_sys():
        app_name = package_name
        app_dir_path_relative = 'resources/app'
    app_path_relative = os.path.join(app_name, app_dir_path_relative)

    cwd = os.getcwd()

    # Update modules.
    log_stage('Update modules...')
    run_cmd('npm install')

    # Extract old package and remove old app.
    log_stage('Extract old package and remove old app...')
    os.chdir('dist')
    if is_windows_sys():
        run_cmd('7z -tzip x %s.zip' % (app_name))
    else:
        run_cmd('tar -xvf %s.tar.gz' % (app_name))
    remove_dir(app_path_relative)
    os.mkdir(app_path_relative)
    os.chdir(cwd)

    # Copy new app.
    log_stage('Copy new app...')
    app_dirs = ['assets', 'css', 'js', 'node_modules']
    for app_dir in app_dirs:
        dest_app_dir = os.path.join('dist', app_path_relative)
        dest_app_dir = os.path.join(dest_app_dir, app_dir)
        os.mkdir(dest_app_dir)
        copy_dir(app_dir, dest_app_dir)

    app_files = ['index.html', 'main.js',
                'package.json', 'package-lock.json',
                'README.md', 'LICENSE']
    for app_file in app_files:
        dest_app_file = os.path.join('dist', app_path_relative)
        dest_app_file = os.path.join(dest_app_file, app_file)
        copy_file(app_file, dest_app_file)

    release_file = os.path.join('dist', app_path_relative, 'assets', 'RELEASED')
    open(release_file, 'a').close()

    # Rebuild and clean.
    log_stage('Rebuild and clean...')
    os.chdir(os.path.join('dist', app_path_relative))
    if is_macos_sys():
        exec_fix_paths = ['./node_modules/.bin/electron-rebuild',
                        './node_modules/.bin/node-pre-gyp',
                        './node_modules/.bin/rimraf']
        for exec_file in exec_fix_paths:
            st = os.stat(exec_file)
            os.chmod(exec_file, st.st_mode | stat.S_IEXEC)
    run_cmd('npm rebuild')
    run_cmd('npm run rebuild-node-pty')
    remove_dir('./node_modules/electron/dist')
    if is_windows_sys():
        remove_dir('./node_modules/node-pty/build/Release/obj')
        remove_dir('./node_modules/node-pty/build/deps/winpty/src/Release/obj')
    else:
        remove_dir('./node_modules/node-pty/build/Release/obj.target')
    os.chdir(cwd)

    # Rename electron files.
    log_stage('Rename electron files...')
    os.chdir(os.path.join('dist', app_name))
    electron_exe_dir = ''
    electron_exe_name = ''
    electron_exe_app_name = ''
    if is_windows_sys():
        electron_exe_dir = './'
        electron_exe_name = 'electron.exe'
        electron_exe_app_name = '%s%s.exe' % (electron_exe_dir, app_title)
    elif is_macos_sys():
        electron_exe_dir = './Contents/MacOS/'
        electron_exe_name = 'Electron'
        electron_exe_app_name = '%s%s' % (electron_exe_dir, app_title)
    electron_exe_path = '%s%s' % (electron_exe_dir, electron_exe_name)
    if os.path.exists(electron_exe_path):
        os.rename(electron_exe_path, electron_exe_app_name)
    if is_macos_sys():
        info_plist_path = './Contents/Info.plist'
        info_plist_content = read_file_content(info_plist_path)
        info_plist_content = info_plist_content.replace(b'>Electron<',
                                bytes('>%s<' % (app_title), encoding='utf8'))
        write_file_content(info_plist_path, info_plist_content)
    os.chdir(cwd)

    # Package and clean up.
    log_stage('Package and clean up...')
    os.chdir('dist')
    if is_windows_sys():
        remove_file('%s.zip' % (app_name))
        run_cmd('7z -tzip a -r %s.zip %s' % (app_name, app_name))
    else:
        remove_file('%s.tar.gz' % (app_name))
        run_cmd('tar -czvf %s.tar.gz %s' % (app_name, app_name))
    remove_dir(app_name)

if __name__ == '__main__':
    main()
