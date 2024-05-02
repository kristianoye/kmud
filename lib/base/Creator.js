/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import Player from './Player';

const
    Dirs = await requireAsync('Dirs');

export default class Creator extends Player {
    protected override applyRestore() {
        this.setEnv({
            DIRSTACK: [],
            SHELLRC: `/realms/${this.keyId}/.kmshrc`,
            HISTFILE: `/realms/${this.keyId}/.history`,
            HOME: `/realms/${this.keyId}`,
            CWD: `/realms/${this.keyId}`
        });
        return super.applyRestore();
    }

    /**
     * Called when the player is connected to the MUD
     * @param {number} port The port the user connected to
     * @param {string} clientType The connected client type
     */
    protected override async connect(port, clientType) {
        let addCmdPath = [],
            result = Object.assign(
                await super.connect(port, clientType), {
                    expandAliases: true,
                    allowPipelining: true,
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
     * Create a wizard
     * @param {string} filename The file to load player data from
     */
    private override async create(filename) {
        super.create();
        await this.loadCreator(filename);
        efuns.living.enableLiving(this.keyId);
    }

    /**
     * Returns the directory stack
     * @type {string[]}
     */
    protected get directoryStack() {
        return this.getEnv('DIRSTACK', []);
    }

    /**
     * Set the directory stack
     */
    protected set directoryStack(stack) {
        if (Array.isArray(stack))
            this.setEnv('DIRSTACK', stack);
    }

    protected override async executeShellCommand(evt) {
        if (this.getShellOption('autocd')) {
            if (await this.internalChangeDirectory([], { args: [evt.verb] }, false))
                return true;
        }
        return await super.executeShellCommand(evt);
    }

    protected async internalChangeDirectory(args, cmd, showError=true) {
        let homedir, newdir, dir;

        homedir = this.getEnv('HOME') || '/';
        newdir = cmd.args.length ? efuns.resolvePath(cmd.args[0], this.workingDirectory) : homedir;

        dir = await efuns.fs.getObjectAsync(newdir);

        if (!dir.isDirectory) {
            if (this.getShellOption('cdspell')) {

            }
            if (showError) {
                errorLine(`cd: '${newdir}' no such file or directory`);
                return true;
            }
            else
                return false;
        }
        this.setEnv('CWD', newdir);
        return true;
    }

    protected async internalPopDirectory(args, cmd) {
        if (this.directoryStack.length === 1)
            return errorLine('popd: Directory stack is empty');
        this.directoryStack.shift();
        return writeLine(this.directoryStack.join(' '));
    }

    protected async internalPushDirectory(args, cmd) {
        let homedir, newdir, isDirectory;

        homedir = this.getEnv('HOME') || '/';
        newdir = cmd.args.length ? efuns.resolvePath(cmd.args[0], this.workingDirectory) : homedir;

        isDirectory = await efuns.fs.isDirectoryAsync(newdir);
        if (isDirectory !== true)
            return errorLine(`pushd: '${newdir}' no such file or directory`);
        this.directoryStack.unshift(newdir);
        return writeLine(this.directoryStack.join(' '));
    }

    protected async internalPrintWorkingDirectory(args, cmd) {
        return writeLine(this.workingDirectory);
    }

    protected async internalTypeCommand(args, evt) {
        for (let arg of args) {
            if (arg.charAt(0) === '-') {
            }
        }
    }

    /**
     * Prompt the user for the next command
     * @returns {string} The prompt to draw
     */
    protected override getCommandPrompt() {
        if (efuns.adminp(this))
            return `${this.name}@${efuns.mudName()}:${this.workingDirectory}# `;
        else
            return `${this.name}@${efuns.mudName()}:${this.workingDirectory}$ `;
    }

    override getShellCommands() {
        let cmds = Object.assign(super.getShellCommands(),
            {
                cd: 'internalChangeDirectory',
                popd: 'internalPopDirectory',
                pushd: 'internalPushDirectory',
                pwd: 'internalPrintWorkingDirectory',
                type: 'internalTypeCommand'
            });
        return cmds;
    }

    override getShellOptions() {
        let opts = super.getShellOptions() || {},
            current = this.shellOptions;

        return Object.assign(opts, {
            autocd: false,
            cdspell: false,
            dotglob: false,
            extglob: true,
            histappend: false,
            interactive_comments: false
        }, current);
    }

    protected override async getShellSettings(verb, options = {}) {
        let result = await super.getShellSettings(verb, options);
        if (this.isInternalCommand(verb)) {
            return Object.assign(result, {
                allowFileIO: true,
                allowLineSpanning: true,
                allowPipelining: true,
                cwd: this.workingDirectory || '/',
                expandBackticks: true,
                expandEnvironment: true,
                expandFileExpressions: true
            });
        }
        return result;
    }

    /**
     * Load the creator from file.
     * @param {any} filename
     */
    protected async loadCreator(filename) {
        return await efuns.restoreObjectAsync(filename);
    }

    /** Immortals are allowed to idle indefinitely */
    override get maxIdleTime() {
        return Number.MAX_SAFE_INTEGER;
    }

    protected applyGetWorkingDir() {
        return this.workingDirectory;
    }

    protected override setEnv(name, value) {
        if (name === 'CWD') {
            let stack = this.getEnv('DIRSTACK', []);
            stack[0] = value;
        }
        return super.setEnv(name, value);
    }

    get workingDirectory() {
        return this.getEnv('CWD');
    }

    /** Change the current directory */
    set workingDirectory(dir) {
        if (thisPlayer() === this) {
            let stack = this.directoryStack;
            this.setEnv('CWD', stack[0] = dir);
        }
    }
}
