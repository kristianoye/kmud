/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Dirs = require('Dirs'),
    Player = require('./Player');

class Creator extends Player {
    protected applyRestore() {
        this.setEnv({
            DIRSTACK: () => this.directoryStack.join(' '),
            HOME: () => `/realms/${this.keyId}`
        });
        return super.applyRestore();
    }

    protected connect(port, clientType) {
        efuns.living.enableHeartbeat(true);
        return Object.assign(
            super.connect(port, clientType), {
                allowAliases: true,
                allowChaining: true,
                allowEnvironment: true,
                allowFileExpressions: true,
                allowLineSpanning: true,
                allowEscaping: true,
                allowFileIO: true,
                allowHistory: true,
                allowObjectShell: true
            });
    }

    /**
     * Returns the directory stack
     * @type {string[]}
     */
    protected get directoryStack() {
        return get([]);
    }

    /**
     * Set the directory stack
     */
    protected set directoryStack(stack) {
        if (Array.isArray(stack))
            set(stack.filter(s => typeof s === 'string' && s.length));
    }

    /**
     * Execute a shell command
     * @param {any} cmd
     */
    protected async executeShellCommand(cmd) {
        let homedir, newdir, isDirectory;

        switch (cmd.verb) {
            case 'cd':
                homedir = this.getenv('HOME') || '/';
                newdir = cmd.args.length ? efuns.resolvePath(cmd.args[0], this.workingDirectory) : homedir;

                isDirectory = await efuns.fs.isDirectoryAsync(newdir);
                if (isDirectory !== true)
                    return errorLine(`cd: '${newdir}' no such file or directory`);
                this.directoryStack[0] = newdir;
                return true;

            case 'popd': // Pop directory stack
                if (this.directoryStack.length === 1)
                    return errorLine('popd: Directory stack is empty');
                this.directoryStack.shift();
                return writeLine(this.directoryStack.join(' '));

            case 'pushd': // Push directory stack
                homedir = this.getenv('HOME') || '/';
                newdir = cmd.args.length ? efuns.resolvePath(cmd.args[0], this.workingDirectory) : homedir;

                isDirectory = await efuns.fs.isDirectoryAsync(newdir);
                if (isDirectory !== true)
                    return errorLine(`pushd: '${newdir}' no such file or directory`);
                this.directoryStack.unshift(newdir);
                return writeLine(this.directoryStack.join(' '));

            case 'pwd': // Print working directory
                return writeLine(this.workingDirectory);

            default:
                return super.executeShellCommand(cmd);
        }
    }


    /** Immortals are allowed to idle indefinitely */
    get maxIdleTime() {
        return Number.MAX_SAFE_INTEGER;
    }

    /**
     * Allows custom overriding of shell settings based on the first verb
     * @param {any} verb
     */
    private prepareCommand(verb) {
        // TODO: Make sure first command is actually shell-related
        // and return appropriate values.
        return {
            allowAliases: true,
            allowChaining: true,
            allowEnvironment: true,
            allowFileExpressions: true,
            allowLineSpanning: true,
            allowEscaping: true,
            allowFileIO: true,
            allowHistory: true,
            allowObjectShell: true
        };
    }

    get searchPath() {
        let sp = get([]);
        if (!Array.isArray(sp) || sp.length === 0) {
            sp = super.searchPath;
            if (efuns.adminp(this)) {
                sp.push(Dirs.DIR_SCMDS_ADMIN,
                    Dirs.DIR_SCMDS_ARCH,
                    Dirs.DIR_CMDS_ADMIN);
            }
            else if (efuns.archp(this)) {
                sp.push(Dirs.DIR_SCMDS_ARCH);
            }

            sp.push(Dirs.DIR_CMDS_CREATOR,
                Dirs.DIR_SCMDS_CREATOR,
                Dirs.DIR_SCMDS_FILESYSTEM);

            let personalDir = `/realms/${this.primaryName}/cmds`;

            if (efuns.isDirectorySync(personalDir))
                sp.push(personalDir);

            set(sp);
        }
        return sp.slice(0);
    }

    get workingDirectory() {
        let stack = this.directoryStack;
        return stack[0] || '/';
    }

    protected set workingDirectory(dir) {
        let stack = this.directoryStack;
        stack[0] = dir;
    }
}

module.exports = Creator;
