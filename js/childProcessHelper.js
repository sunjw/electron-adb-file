const Utils = require('./utils.js');
const ChildProcess = require('child_process');

class ChildProcessHelper {
    constructor(cmd, args) {
        this.cmd = cmd;
        this.args = args;
        this.childProcess = 0;
    }

    run(onStdOutCallback, onExitCallback = 0) {
        this.childProcess = ChildProcess.spawn(this.cmd, this.args);
        let errToCallback = 0;

        this.childProcess.stdout.on('data', (data) => {
            onStdOutCallback(this, data);
        });

        this.childProcess.stderr.on('data', (data) => {
            onStdOutCallback(this, data);
        });

        this.childProcess.on('error', (err) => {
            // error happened before close
            errToCallback = err;
            Utils.log('Async [' + this.cmd + ' ' + (this.args.join(' ')) + '] exited with error: ' + err);
        });

        this.childProcess.on('close', (code) => {
            Utils.log('Async [' + this.cmd + ' ' + (this.args.join(' ')) + '] exited with code: ' + code);
            if (onExitCallback != 0) {
                onExitCallback(this, code, errToCallback);
            }
        });
    }

    stop() {
        if (this.childProcess != 0) {
            this.childProcess.kill('SIGKILL');
        }
    }

    runSync() {
        const childCmdResult = ChildProcess.spawnSync(this.cmd, this.args);
        Utils.log('Sync [' + this.cmd + ' ' + (this.args.join(' ')) + '] exited with code: ' + childCmdResult.status);
        let retCmdResult = {};
        retCmdResult.child = this;
        retCmdResult.exitCode = childCmdResult.status;
        retCmdResult.err = 0;
        if (childCmdResult.error !== undefined) {
            retCmdResult.err = childCmdResult.error;
        }
        retCmdResult.stdout = childCmdResult.stdout.toString();
        retCmdResult.stderr = childCmdResult.stderr.toString();
        return retCmdResult;
    }
}

// exports
exports.ChildProcessHelper = ChildProcessHelper;
