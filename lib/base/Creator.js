/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Dirs = await requireAsync('Dirs'),
    Player = await requireAsync('./Player');

class Creator extends Player {
    protected applyRestore() {
        this.setEnv({
            DIRSTACK: () => this.directoryStack.join(' '),
            HOME: () => `/realms/${this.keyId}`
        });
        return super.applyRestore();
    }

    protected async connect(port, clientType) {
        let addCmdPath = [],
            result = Object.assign(
                await super.connect(port, clientType), {
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


        efuns.living.enableWizard(true);

        if (efuns.adminp(this)) {
            addCmdPath.push(Dirs.DIR_SCMDS_ADMIN,
                Dirs.DIR_SCMDS_ARCH,
                Dirs.DIR_CMDS_ADMIN);
        }
        else if (efuns.archp(this)) {
            addCmdPath.push(Dirs.DIR_SCMDS_ARCH);
        }

        addCmdPath.push(Dirs.DIR_CMDS_CREATOR,
            Dirs.DIR_SCMDS_CREATOR,
            Dirs.DIR_SCMDS_FILESYSTEM);

        let personalDir = `/realms/${this.name}/cmds`,
            dirExists = await efuns.fs.isDirectoryAsync(personalDir);

        if (dirExists === true)
            addCmdPath.push(personalDir);

        this.searchPathAdd(...addCmdPath);
        return result;
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

    /**
     * Load the creator from file.
     * @param {any} filename
     */
    protected async loadCreator(filename) {
        return await efuns.restoreObjectAsync(filename);
    }


    /** Immortals are allowed to idle indefinitely */
    get maxIdleTime() {
        return Number.MAX_SAFE_INTEGER;
    }

    protected applyGetWorkingDir() {
        return this.workingDirectory;
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
