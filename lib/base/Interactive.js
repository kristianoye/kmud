/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import Living from './Living';
import { CHAT_D } from 'Daemon';

export default class Interactive extends Living {

    // #region Properties

    protected get $environment() {
        return get({
            COLUMNS: () => {
                return efuns.clientCaps(this).clientWidth;
            },
            LINES: () => {
                return efuns.clientCaps(this).clientHeight;
            },
            ERRORCOLOR: 'RED',
            TERM: () => {
                return efuns.clientCaps(this).terminalType;
            }
        });
    }

    protected set $environment(vars) {
        if (typeof vars === 'object')
            set(vars);
    }

    protected getCommandPrompt() {
        return '> ';
    }

    protected get age() {
        return get(0);
    }

    protected set age(value) {
        if (typeof value === 'number' && value > 0) set(value);
    }

    get ageIdle() {
        return get(0);
    }

    protected set ageIdle(value) {
        if (typeof value === 'number' && value > 0)
            set(value);
    }

    protected get aliases() {
        return get({
            "$'": 'say $*',
            "$:": 'emote $*',
            down: 'go down',
            east: 'go east',
            eq: 'inventory',
            exa: 'look at $*',
            inv: 'inventory',
            i: 'inventory',
            north: 'go north',
            northwest: 'go northwest',
            northeast: 'go northeast',
            south: 'go south',
            southeast: 'go southeast',
            southwest: 'go southwest',
            up: 'go up',
            west: 'go west'
        });
    }

    protected get history() {
        return get(new ArrayWithMax(100));
    }

    // #endregion

    // #region Methods

    /** 
     * Called when the object is restored 
     */
    protected applyRestore() {
        return true;
    }

    /**
     * Exports the user's shell variables
     */
    exportEnv() {
        return { ...this.$environment };
    }

    /**
     * Get an environmental variable
     * @param {string} name The name of the variable to fetch
     * @param {any} defaultValue The default value if the value does not exist
     */
    getEnv(name, defaultValue) {
        let env = this.$environment;
        let val = env[name], result = val;
        if (val) {
            if (typeof val === 'function') {
                result = val();
            }
            return result || defaultValue || '';
        }
        return defaultValue || '';
    }

    /**
     * Check to see if the user is in editor and if so dispatch the command.
     * @param {MUDInputEvent} evt The input event from the user.
     * @returns {boolean} Returns true if the command executes successfully.
     */
    private executeEditor(evt) {
        if (efuns.driverFeature('editor')) {
            let editorState = efuns.queryEditorMode();
            if (editorState !== -1) {
                if (evt.verb.startsWith('!')) {
                    evt.verb = evt.verb.slice(1);
                    evt.original = evt.original.slice(1);
                }
                else {
                    let result = efuns.editorCmd(evt.original), state = {};
                    editorState = efuns.queryEditorMode(state);
                    switch (editorState) {
                        case 0:
                            //  User is editor command prompt
                            if (state.filename) {
                                evt.prompt.text = `[${state.filename}]${(state.dirty ? '*' : '')}: `;
                            }
                            else {
                                evt.prompt.text = `${(state.dirty ? '*' : '')}: `;
                            }
                            return true;

                        case -1:
                            //  User has left the editor
                            return MUDEVENT_STOP;

                        case -2:
                            //  User is viewing help file
                            return true;

                        default:
                            //  User is input mode at a specific line
                            if (state.showLineNumbers)
                                evt.prompt.text = `${state.line}:\r\t`;
                            else
                                evt.prompt.text = ':\r\t';
                            return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Perform history command or expansion.
     * @param {MUDInputEvent} evt
     */
    protected async executeShellCommand(evt) {
        let cmds = this.getShellCommands(),
            verb = evt.verb;

        if (verb in cmds) {
            let cmd = cmds[verb];

            if (typeof this[cmd] === 'function') {
                let result = efuns.isAsync(this[cmd]) ? await this[cmd](evt.args, evt) : this[cmd](evt.args, evt);
                if (result === true || result === 0)
                    return true;
            }
        }
        return false;
    }

    private internalShellHistory(args, evt) {
        let show = true, i = 0, max = 0, nv = 0, history = this.history;

        for (i = 0, max = args.length; i < max; i++) {
            switch (args[i]) {
                case '-d':
                    if ((i + 1) >= args.length) {
                        writeLine('History: Usage: history -d [offset]');
                        return true;
                    }
                    var deleteList = [];
                    do {
                        if (!(nv = parseInt(evt.args[i + 1])))
                            break;
                        deleteList.pushDistinct(nv);
                        i++;
                    }
                    while (true);
                    deleteList.sort((a, b) => a > b ? -1 : 1).forEach(i => {
                        history.splice(i, 1);
                    });
                    show = false;
                    break;

                case '-c':
                    history.splice(0, history.length);
                    show = false;
                    break;
            }
        }
        if (show) {
            for (i = 0, max = history.length; i < max; i++) {
                if (history[i]) {
                    this.writeLine(`  ${i}  ${history[i]}`);
                }
            }
        }
        return true;
    }

    private internalShellOptions(args) {
        let optnames = [],
            options = this.getShellOptions(),
            op = '';

        for (let i = 0; i < args.length; i++) {
            switch (args[i]) {
                case '-s':
                case '-p':
                case '-u':
                    op = args[i].charAt(1);
                    break;
                default:
                    if (args[i].charAt(0) === '-')
                        errorLine(`-kmsh: shopt: ${args[i]}: invalid option`);
                    else
                        optnames.push(args[i]);
            }
        }
        let printOnly = false;
        if (optnames.length === 0) {
            optnames = Object.keys(options).sort();
            printOnly = true;
        }
        let longest = optnames.map(o => o.length).sort((a, b) => a > b ? -1 : 1).shift();
        optnames.forEach(name => {
            if (name in options === false)
                return errorLine(`-kmsh: shopt: ${name}: invalid shell option name`);
            switch (op) {
                case 'p':
                    writeLine(`shopt ${(options[name] ? '-s' : '-u')} ${name}`);
                    break;
                case 's':
                case 'u':
                    if (printOnly) {
                        if ((op === 's' && options[name]) || (op === 'u' && !options[name]))
                            writeLine(`{0,-${longest + 4}}{1}`.fs(name, options[name] ? 'on' : 'off'));
                    }
                    else {
                        options[name] = op === 's';
                        this.shellOptions = options;
                    }
                    break;
                case '':
                    writeLine(`{0,-${longest + 4}}{1}`.fs(name, options[name] ? 'on' : 'off'));
                    break;
            }
        });
        return true;
    }

    protected override isInternalCommand(verb) {
        let cmds = this.getShellCommands();
        return typeof verb === 'string' && verb in cmds;
    }

    /**
     * The actual work of processing the command.
     * @param {MUDInputEvent} evt The event
     */
    override protected async executeCommand(evt) {
        let cmdObj = false,
            cmdResult = false;

        if ((cmdResult = this.executeEditor(evt)))
            return cmdResult;
        else if ((cmdResult = await this.executeShellCommand(evt)))
            return cmdResult;
        else if (CHAT_D->cmd(evt.verb, evt.args, evt))
            return true;
        return await super.executeCommand(evt);
    }

    getAge(flag) {
        return flag && [this.age, this.ageIdle] || this.age;
    }

    get birth() { return get(efuns.ticks); }

    protected connect(port, clientType) {
        let channels = this.channels,

        channelList = CHAT_D->eventAddListener(this)
            .map(ch => {
                if (false === ch in channels) {
                    writeLine(`You are now listening to ${ch}.`);
                    channels[ch] = true;
                }
                return ch;
            }),

        deleteChannels = Object.keys(channels)
            .filter(ch => {
                if (channelList.indexOf(ch) === -1) {
                    delete channels[ch];
                    return true;
                }
            });

        deleteChannels.forEach(ch => {
            writeLine(`You no longer have access to the ${ch} channel.`);
        });
        this.channels = channels;
        this.lastLogin = efuns.ticks;
        efuns.living.enableHeartbeat();

        return {
            aliases: this.aliases,
            allowEnvironment: true,
            allowEscaping: false,
            history: this.history,
            env: this.$environment
        };
    }

    protected async disconnect(reason) {
        await efuns.unguarded(() => {
            efuns.living.enableHeartbeat(false);
            writeLine(reason || 'Good-bye');
        })
    }

    get channels() {
        return get({});
    }

    protected set channels(channelList) {
        if (typeof channelList === 'object')
            set(channelList);
    }

    protected heartbeat(length) {
        try {
            this.age += length;
            if (efuns.living.queryIdle(this) > 60000)
                this.ageIdle += length;
        }
        catch (e) {
            message("write", "Your heart has stopped!", this);
            efuns.living.enableHeartbeat(false);
        }
    }

    protected eventDestroy() {
        CHAT_D->eventRemoveListener(this.wrapper);
    }

    /**
     * Called when the user needs to page through some text
     * @param {string} text The text to page through; If blank then it will try to read stdin
     */
    async eventPageText(text, options = { autoExit: true }) {
        if (!text && stdin) {
            text = stdin.readAll();
        }
        let lines = Array.isArray(text) ? text : text.splitLines(),
            currentLine = 0,
            linesPerPage = parseInt(ENV.LINES) || 24;

        do {
            let page = lines.slice(currentLine, currentLine + linesPerPage);

        }
        while (true);
    }

    executeHistory(cmd) {
        var hist = this.commandHistory;
        if (cmd.startsWith('!')) {
            cmd = cmd.slice(1);

            if (hist.length === 0) {
                this.writeLine('No history, yet');
            }

            if (cmd === '!') {
                this.dispatchInput(hist[hist.length - 1], true);
            }
            else {
                let test = cmd.split(',').map(s => parseInt(s));
                if (test.length > 0) {
                    test.forEach(index => {
                        if (!hist[index])
                            writeLine(`History: Command index ${index} not found.`);
                        else
                            this.dispatchInput(hist[index]);
                    });
                    return;
                }
                for (var i = hist.length - 1; i > 0; i--) {
                    if (hist[i].startsWith(cmd)) {
                        return this.dispatchInput(hist[i], true);
                    }
                }
                this.writeLine('History: No match');
                return true;
            }
        }
    }

    getEditorPrompt() {
        let state = {},  editorState = efuns.queryEditorMode(state);
        switch (editorState) {
            case 0:
                //  User is editor command prompt
                if (state.filename) {
                    return `[${state.filename}]${(state.dirty ? '*' : '')}: `;
                }
                else {
                    return `${(state.dirty ? '*' : '')}: `;
                }

            case -1:
                return MUDEVENT_STOP;

            case -2:
                return true;

            default:
                if (state.showLineNumbers)
                    return `${state.line}:\r\t\t`;
                else
                    return '*\r\t\t';
        }
    }

    hasChannel(channel) {
        return channel in this.channels;
    }

    isListening(channel) {
        return this.channels[channel] === true;
    }

    get lastLogin() { return value(new Date().getTime()); }

    private set lastLogin(value) {
        if (typeof value === 'number' && value > 0) set(value);
    }

    /** 
     * Returns the max amount of time this object can be idle before it is removed from the game 
     * Time measured in ms.
     */
    get maxIdleTime() {
        return 60000;
    }

    async movePlayerAsync(target) {
        try {
            if (await this.moveObjectAsync(target)) {
                return writeLine(this.environment.onGetDescription(this));
            }
            return false;
        }
        catch (err) {
            throw err;
        }
        return false;
    }

    setEnv(varName, value) {
        let env = this.$environment,
            curEnv = env;
        if (typeof varName === 'object') {
            for (const [key, val] of Object.entries(varName)) {
                this.setEnv(key, val);
            }
        }
        if (typeof varName === 'string') {
            if (typeof value === 'undefined')
                delete env[varName];
            else {
                let parts = varName.split('.');

                if (parts.length > 1) {
                    varName = parts.pop();
                    for (let i = 0; i < parts.length; i++) {
                        let part = parts[i];

                        if (part in curEnv)
                            curEnv = curEnv[part];
                        else {
                            curEnv[part] = {};
                            curEnv = curEnv[part];
                        }
                    }
                }
                //  Custom validation logic
                switch (varName) {
                    case 'ERRORCOLOR':
                        {
                            let validColors = ['RED', 'ORANGE', 'BLUE', 'GREEN', 'YELLOW', 'CYAN', 'WHITE', 'BLACK', 'NONE', '%^MAGENTA%^'];
                            value = value.toUpperCase();
                            if (validColors.indexOf(value) === -1)
                                return `ERRORCOLOR value '${value}' is invalid; Must be one of ${validColors.join(', ')}`;
                        }
                        break;

                    case 'HISTSIZE':
                        {
                            let v = parseInt(value);
                            if (v < 0 || v > 1000)
                                return 'HISTSIZE must be an integer between 0 and 1000';
                        }
                        break;

                    case 'TITLE':
                        if (value.indexOf('$N') === -1)
                            return 'TITLE must contain a name placeholder ($N)';
                        this.titles['active'] = value;
                        break;
                }
                curEnv[varName] = value;
            }
            this.$environment = env;
            return value;
        }
    }

    setListening(channel, flag) {
        let channels = this.channels;
        if (channel in channels) {
            channels[channel] = flag;
        }
        return this;
    }

    getShellCommands() {
        return {
            history: 'internalShellHistory',
            shopt: 'internalShellOptions'
        };
    }

    getShellOptions() {
        return Object.assign({
            allowpartialverb: true,
            extquote: true,
            histignoredup: true,
            histignorewhitespace: true,
        }, this.shellOptions);
    }

    override getShellOption(name) {
        let options = this.getShellOptions();
        return typeof name === 'string' && name in options && options[name] === true;
    }

    get shellOptions() {
        return get({});
    }

    protected set shellOptions(options) {
        if (typeof options === 'object')
            set(options);
    }

    // #endregion
}
