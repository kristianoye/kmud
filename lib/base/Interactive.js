/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

$include('Interactive');

const
    Base = require('Base'),
    Daemon = require('Daemon'),
    { Living } = require(Base.Living),
    ChatDaemon = efuns.loadObjectSync(Daemon.Chat),
    CommandResolver = efuns.loadObjectSync(Daemon.Command),
    EmoteDaemon = efuns.loadObjectSync(Daemon.Emote);

class Interactive extends Living {
    constructor(data) {
        super(data);
        this.applyRestore();
    }

    protected get aliases() {
        return get('interactive/aliases');
    }

    protected applyRestore() {
        register({
            interactive:
            {
                age: {
                    total: 0,
                    idle: 0,
                    birthday: efuns.ticks,
                    lastLogin: efuns.ticks
                },
                aliases: {
                    "'": 'say $*',
                    ":": 'emote $*',
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
                },
                history: [],
                ':shellVariables': {
                    COLUMNS: () => {
                        return efuns.clientCaps(this).clientWidth;
                    },
                    LINES: () => {
                        return efuns.clientCaps(this).clientHeight;
                    },
                    TERM: () => {
                        return efuns.clientCaps(this).terminalType;
                    }
                },
            }
        });
        return true;
    }

    getenv(name, defaultValue) {
        let env = this.shellVariables;
        let val = env[name], result = val;
        if (val) {
            if (typeof val === 'function') {
                result = val();
            }
            return result || defaultValue || '';
        }
        return defaultValue || '';
    }

    protected get shellVariables() {
        return get('interactive/:shellVariables');
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
     * @param {MUDInputEvent} evt A history command.
     * @returns {boolean} Returns true if successful.
     */
    private executeHistory(evt) {
        if (evt.verb.charAt(0) === '!') {
            let cmd = evt.verb.slice(1), index = -1, num = parseInt(cmd),
                history = this.history;

            if (cmd === '!') { // user input = !! (repeat last command)
                if (history.length === 0)
                    this.writeLine('No history, yet');
                else
                    index = history.length - 1;
            }
            if (num > -1 && num < history.length) {
                index = num;
            }
            else {
                for (let i = history.length - 1; i > 0; i--) {
                    if (history[i].startsWith(cmd)) {
                        index = i;
                        break;
                    }
                }
                if (index === -1) {
                    this.writeLine('History: No match');
                    return true;
                }
            }
            if (index > -1) {
                let words = history[index].split(/\s+/g);
                evt.fromHistory = true;
                evt.verb = words.shift().trim();
                evt.input = history[index].slice(evt.verb.length).trim();
                evt.args = words;
            }
        }
    }

    /**
     * Perform history command or expansion.
     * @param {MUDInputEvent} evt
     */
    private executeShellCommand(evt) {
        if (evt.verb === 'history') {
            let show = true, i = 0, max = 0, nv = 0;
            for (i = 0, max = evt.args.length; i < max; i++) {
                switch (evt.args[i]) {
                    case '-d':
                        if ((i + 1) >= evt.args.length) {
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
    }

    /**
     * Expand user aliases.
     * @param {MUDInputEvent} evt
     */
    private expandAliases(evt) {
        let aliases = this.aliases,
            alias = aliases[evt.verb],
            words;

        if (alias) {
            if (alias.indexOf('$') > -1) {
                let output = alias.split(/\s+/);

                words = evt.args.slice(0);

                for (let i = 0, m = output.length; i < m; i++) {
                    if (output[i].startsWith('$')) {
                        let tok = output[i].slice(1);

                        if (tok === '*')
                            output[i] = words.filter(s => s.length > 0).join(' ');
                        else {
                            let rem = tok.charAt(0) === '-',
                                num = parseInt(rem ? tok.slice(1) : tok);
                            output[i] = evt.args[num];
                            if (rem) words[tok] = '';
                        }
                    }
                }
                words = output.join(' ').trim().split(/\s+/g);
            }
            else {
                let input = alias + evt.original.slice(evt.verb.length);
                words = input.trim().split(/\s+/g);
            }
            evt.verb = words.shift().trim();
            evt.args = words;
        }
    }

    /**
     * The actual work of processing the command.
     * @param {MUDInputEvent} evt The event
     */
    protected async executeCommand(evt) {
        let cmd = false,
            cmdResult = false;

        if ((cmdResult = this.executeEditor(evt)))
            return cmdResult;
        else if ((cmdResult = await this.executeShellCommand(evt)))
            return cmdResult;
        else if (ChatDaemon().cmd(evt.verb, evt))
            return true;
        else if ((cmd = CommandResolver().resolve(evt.verb, this.searchPath))) {
            return evt.htmlEnabled && typeof cmd.webcmd === 'function' ?
                cmd.webcmd(evt.text, evt) :
                cmd.cmd(evt.text, evt);
        }
        else if ((cmdResult = EmoteDaemon().cmd(evt.verb, evt.args, evt)))
            return cmdResult;
        else
            return errorLine(`What? (Command '${evt.verb}' not recognized)`);
    }

    get age() {
        return get(PROP_AGE, 0);
    }

    protected set age(value) {
        if (typeof value === 'number' && value > 0)
            set(PROP_AGEIDLE, value);
    }

    get ageIdle() {
        return get(PROP_AGEIDLE, 0);
    }

    protected set ageIdle(value) {
        if (typeof value === 'number' && value > 0)
            set(PROP_AGEIDLE, value);
    }

    getAge(flag) {
        return flag && [this.age, this.ageIdle] || this.age;
            
    }

    abstract get aliases() {
        return get(PROP_ALIASES, {});
    }

    get birth() { return get(PROP_BIRTHDAY, efuns.ticks); }

    protected connect(port, clientType) {
        let channels = get('channels', {}),
            channelList = ChatDaemon().eventAddListener(this.wrapper)
                .map(ch => {
                    if (!(ch in channels)) channels[ch] = true;
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

        set(PROP_LASTLOGIN, new Date().getTime());
        efuns.living.enableHeartbeat();

        return {
            aliases: this.aliases,
            allowEnvironment: true,
            allowEscaping: false,
            history: this.history,
            env: this.shellVariables
        };
    }

    protected disconnect(reason, saveAndQuit = false) {
        efuns.unguarded(() => {
            efuns.living.enableHeartbeat(false);
            writeLine(reason || 'Good-bye');
        })
    }

    get channels() {
        return efuns.merge({}, this.getProperty('channels', {}));
    }

    protected heartbeat(length) {
        try {
            inc(PROP_AGE, length);
            if (efuns.queryIdle(this) > 60000)
                inc(PROP_AGEIDLE, length);
        }
        catch (e) {
            message("write", "Your heart has stopped!", this);
            efuns.living.enableHeartbeat(false);
        }
    }

    protected get history() {
        return this.getProtected('history', []);
    }

    eventSend(data) {
        this.client.eventSend(data);
        return this;
    }

    eventDestroy() {
        ChatDaemon().eventRemoveListener(this.wrapper);
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

    get hasBrowser() {
        var client = this.client;
        return client ? client.isBrowser : false;
    }

    hasChannel(channel) {
        return channel in this.channels;
    }        

    get idleTime() {
        return (new Date().getTime() - this.lastCommandTime);
    }

    isListening(channel) {
        return this.channels[channel] === true;
    }

    get lastCommandTime() {
        return this['_lastCommand'] || 0;
    }

    /** Returns the max amount of time this object can be idle before it is removed from the game */
    get maxIdleTime() { return 60000; }

    movePlayer(target) {
        try {
            if (this.moveObject(target)) {
                return writeLine(this.environment.onGetDescription(this));
            }
            return false;
        }
        catch (err) {

        }
        return false;
    }

    get searchPath() {
        return [];
    }

    setEnv(name, val) {
        var env = this.getProperty('environment', {});
        if (typeof name === 'string') {
            if (!val) {
                delete env[name];
            } else {
                env[name] = val;
            }
        }
    }

    setListening(channel, flag) {
        var channels = this.getProperty('channels', {});
        if (channel in channels) {
            channels[channel] = flag;
        }
        return this;
    }
}

module.exports = Interactive;

