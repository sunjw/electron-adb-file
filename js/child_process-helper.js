const Utils = require('./utils.js');
const ChildProcess = require('child_process');

class ChildProcessHelper {
    constructor(cmd, args) {
        this.cmd = cmd;
        this.args = args;
    }

    run(onStdOutCallback, onExitCallback = 0) {
        const childCmd = ChildProcess.spawn(this.cmd, this.args);
        var errToCallback = 0;

        childCmd.stdout.on('data', (data) => {
            onStdOutCallback(this, data);
        });

        childCmd.stderr.on('data', (data) => {
            onStdOutCallback(this, data);
        });

        childCmd.on('error', (err) => {
            // error happened before close
            errToCallback = err;
            Utils.log('Async [' + this.cmd + ' ' + (this.args.join(' ')) + '] exited with error: ' + err);
        });

        childCmd.on('close', (code) => {
            Utils.log('Async [' + this.cmd + ' ' + (this.args.join(' ')) + '] exited with code: ' + code);
            if (onExitCallback != 0) {
                onExitCallback(this, code, errToCallback);
            }
        });
    }

    runSync() {
        const childCmdResult = ChildProcess.spawnSync(this.cmd, this.args);
        Utils.log('Sync [' + this.cmd + ' ' + (this.args.join(' ')) + '] exited with code: ' + childCmdResult.status);
        var retCmdResult = {};
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
