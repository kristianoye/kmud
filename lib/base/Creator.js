/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Dirs = require('Dirs'),
    Daemon = require('Daemon'),
    CommandResolver = efuns.loadObjectSync(Daemon.Command),
    { Player, PlayerShell } = require(Base.Player);

class CreatorShell extends PlayerShell {
    constructor(user, env) {
        super(user);

        register('directoryStack', ['/']);
        register(':env', Object.assign({
            $$: this.instanceId,
            $0: "-kmcsh",
            HISTSIZE: "1000",
            HOME: `/realms/${user.name}`,
            LANG: 'en_US.UTF-8',
            SHLVL: "1",
            TERM: "",
            USER: user.name
        }, env));
    }

    /** @type {string[]} */
    get directoryStack() {
        return get('directoryStack', '/') || '/base';
    }

    private set directoryStack(value) {
        set('directoryStack', value);
    }

    /**
     * Expand file expressions that contain wildcards (* or ?).
     * @param {string} expr The input string after variable expansion, etc.
     * @returns {string} The user input with file expressions expanded.
     */
    expandFileExpressions(expr) {
        //  Nothing to be done here
        if (expr.indexOf('*') === -1 && expr.indexOf('?'))
            return expr;

        let i = 0,
            wd = this.workingDirectory,
            m = expr.length,
            output = '',
            word = '',
            s = 0,
            doExpand = false,
            isEscaped = false,
            inString = false;

        for (; i < m; i++) {
            let c = expr.charAt(i);

            switch (c) {
                case '\\':
                    if (isEscaped)
                        word += c, isEscaped = false;
                    else
                        isEscaped = true;
                    break;

                case '"':
                    if (isEscaped)
                        word += c, isEscaped = false
                    else
                        inString = !inString;
                    break;

                case '?':
                case '*':
                    if (isEscaped)
                        word += c, isEscaped = false;
                    else
                        word += c, doExpand = true;
                    break;

                default:
                    let isWS = /\s/.test(c);
                    word += c, isEscaped = false;
                    if (isWS || i + 1 === m) {
                        if (doExpand) {
                            let files = efuns.readDirectorySync(efuns.resolvePath(word.trim(), wd)),
                                slash = word.lastIndexOf('/');
                            if (slash > -1) {
                                files = files.map(s => word.slice(0, slash + 1) + s);
                            }
                            if (files.length === 0)
                                output += word;
                            else
                                output += files.join(' ') + ' ';
                        }
                        else
                            output += word;
                        word = '';
                        doExpand = false;
                    }
                    break;
            }
        }
        if (word) output += word;
        return output;
    }

    /**
     * Only do fancy command expansion/splitting for certain command scenarios
     * @param {string} verb The first verb used must be filesystem-related to
     * warrant further processing (or input must be prefixed with a [+] plus)
     */
    static isShellCommand(verb) {
        return CommandResolver().isShellCommand(verb);
    }

    /**
     * Process raw user input and return well-structured commands
     * that are ready to be dispatched.
     * 
     * @param {string} raw The raw input from the user.
     * @returns {MUDInputEvent|MUDInputEvent[]} Returns one or more well-structured commands
     */
    abstract processInput(raw) {
        try {
            let cmds = efuns.input.splitCommand(raw, {
                aliases: this.aliases,                          // The user's aliases
                history: this.history,                          // History commands to be considered
                variables: this.environment,                    // Variables to expand
                allowEscapedLines: true,                        // Allow user commands to span multiple lines (requires server buffering)
                allowFunctionVariables: true,                   // Variables can contain functions/macros e.g. HPMAX=(user) => user.maxHealth
                maxCommandLength: 500,                          // Maximum command length allowed
                user: this.user,                                // The user executing the command

                //  Enable additional features after gleaning a little user intent
                onFirstVerb: (cmd, settings) => {               // Executes as soon as the first verb is determined
                    if (CreatorShell.isShellCommand(cmd.verb)) {
                        settings.allowAsyncCommands = true;     // e.g. "command1 &" runs command1 in background
                        settings.allowChaining = true;          // e.g. "command1 ; command 2" or "command1 && command2 || command3"
                        settings.allowFileExpressions = true;   // e.g. "command1 *.js"
                        settings.allowFileIO = true;            // e.g. "command1 arg 1> output 2> errors"
                        settings.allowInputRedirect = true;     // e.g. "command1 < souce"
                        settings.allowPiping = true;            // e.g. "command1 | grep -i test"
                        settings.cwd = this.workingDirectory;   // e.g. ... duh?
                    }
                },
                onWriteHistory: hist => {
                    this.history.push(hist);
                }
            });
            return cmds;
        }
        catch (err) {
            write(`-kmsh: ${err.message}`);
        }
        return []; // Do no commands
    }

    /**
     * Returns the directory at the top of the user's directory stack.
     * @type {string}
     */
    get workingDirectory() {
        let stack = this.directoryStack;
        return stack[0];
    }
}

class Creator extends Player {
    protected constructor(filename, data) {
        super(filename, data);
        register('shell', new CreatorShell(this), PROTECTED);
     }

    dispatchInput(input, fromHistory) {
        if (thisPlayer !== this) {
            logger.log('Illegal force attempt');
            return;
        }
        return super.dispatchInput(input, fromHistory);
    }

    protected get shell() {
        return get('shell');
    }

    /** Immortals are allowed to idle indefinitely */
    get maxIdleTime() { return Number.MAX_SAFE_INTEGER; }

    protected processInput(text) {
        return this.shell.processInput(text);
    }

    save(callback) {
        var PlayerDaemon = efuns.loadObjectSync(Daemon.Player);
        PlayerDaemon().saveCreator(this, callback);
    }

    get directoryStack() {
        return this.getProperty('directoryStack') || ['/'];
    }

    displayStack() {
        var ds = this.directoryStack, s = [];
        for (var i = ds.length - 1; i > -1; i--) { s.push(ds[i]); }
        this.writeLine(s.join(' '));
        this.setProperty('directoryStack', ds);
    }

    getenv(name) {
        return name === 'test' ? 'Kriton' : '';
    }

    get searchPath() {
        let sp = get('body/searchPath', []);
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

            var personalDir = `/realms/${this.primaryName}/cmds`;

            if (efuns.isDirectorySync(personalDir))
                sp.push(personalDir);
            set('body/searchPath', sp);
        }
        return sp.slice(0);
    }

    get workingDirectory() {
        var stack = this.directoryStack;
        return stack.length > 0 ? stack[stack.length - 1] : '/';
    }

    set workingDirectory(dir) {
        var stack = this.directoryStack;
        if (efuns.isDirectorySync(dir)) {
            stack[stack.length - 1] = dir;
            this.setProperty('directoryStack', stack);
        }
    }
}

module.exports = { Creator, CreatorShell };
