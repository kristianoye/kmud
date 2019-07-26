/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */

const
    Daemon = require('Daemon'),
    Living = require('./Living'),
    ChatDaemon = efuns.loadObjectSync(Daemon.Chat),
    CommandResolver = efuns.loadObjectSync(Daemon.Command),
    EmoteDaemon = efuns.loadObjectSync(Daemon.Emote);

class Interactive extends Living {
    protected get $shellVariables() {
        return get({
            COLUMNS: () => {
                return efuns.clientCaps(this).clientWidth;
            },
            LINES: () => {
                return efuns.clientCaps(this).clientHeight;
            },
            TERM: () => {
                return efuns.clientCaps(this).terminalType;
            }
        });
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
        if (typeof value === 'number' && value > 0) set(value);
    }

    protected get aliases() {
        return get({
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
        });
    }

    protected applyRestore() {
        return true;
    }

    /**
     * Exports the user's shell variables
     */
    exportEnv() {
        return Object.assign({}, this.$shellVariables);
    }

    getenv(name, defaultValue) {
        let env = this.$shellVariables;
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
     * The actual work of processing the command.
     * @param {MUDInputEvent} evt The event
     */
    protected async executeCommand(evt) {
        let cmdObj = false,
            cmdResult = false;

        if ((cmdResult = this.executeEditor(evt)))
            return cmdResult;
        else if ((cmdResult = await this.executeShellCommand(evt)))
            return cmdResult;
        else if (ChatDaemon().cmd(evt.verb, evt.args, evt))
            return true;
        return await super.executeCommand(evt);
    }

    getAge(flag) {
        return flag && [this.age, this.ageIdle] || this.age;
            
    }

    get birth() { return get(efuns.ticks); }

    protected connect() {
        let channels = this.channels,

            channelList = ChatDaemon().eventAddListener(this)
                .map(ch => {
                    writeLine(`You are now listening to ${ch}.`);
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

        this.lastLogin = efuns.ticks;
        efuns.living.enableHeartbeat();

        return {
            aliases: this.aliases,
            allowEnvironment: true,
            allowEscaping: false,
            history: this.history,
            env: this.$shellVariables
        };
    }

    protected disconnect(reason, saveAndQuit = false) {
        efuns.unguarded(() => {
            efuns.living.enableHeartbeat(false);
            writeLine(reason || 'Good-bye');
        })
    }

    get channels() {
        return get({});
    }

    protected heartbeat(length) {
        try {
            this.age += length;
            if (efuns.queryIdle(this) > 60000) this.ageIdle += length;
        }
        catch (e) {
            message("write", "Your heart has stopped!", this);
            efuns.living.enableHeartbeat(false);
        }
    }

    protected get history() {
        return get([]);
    }

    protected eventDestroy() {
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
            throw err;
        }
        return false;
    }

    setEnv(varName, value) {
        let env = this.$shellVariables;
        if (efuns.isPOO(varName)) {
            Object.keys(varName).forEach(key => {
                this.setEnv(key, varName[key]);
            });
        }
        if (typeof varName === 'string') {
            if (typeof value === 'undefined') delete env[varName];
            else env[varName] = value;
        }
    }

    setListening(channel, flag) {
        let channels = this.channels;
        if (channel in channels) {
            channels[channel] = flag;
        }
        return this;
    }
}

module.exports = Interactive;

