const
    _connected = Symbol('_connected'),
    _client = Symbol('_client'),
    Living = require('./Living');

include('Dirs', 'Daemon');

var ChatDaemon = efuns.loadObject(DAEMON_CHAT),
    CommandResolver = efuns.loadObject(DAEMON_COMMAND),
    EmoteDaemon = efuns.loadObject(DAEMON_EMOTE);

class Interactive extends Living {
    /**
        * Construct an interactive user.
        * @param {MUDCreationContext} ctx
        */
    constructor(ctx) {
        super(ctx
            .prop({
                age: 0,
                aliases: {
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
                birthday: new Date().getTime(),
                environment: {},
                idleAge: 0,
                lastLogin: new Date().getTime()
            })
            .symbols(_connected, false));

        let _client = null,
            _remoteAddress = false,
            $storage = ctx.$storage,
            /** @type {string[]} */ history = $storage.getProperty('commandHistory', []),
            self = this;

        Object.defineProperties(this, {
            client: {
                get: function () {
                    return _client;
                }
            },
            connected: {
                get: function () {
                    return _remoteAddress !== false;
                }
            }
        });

        /**
         * Check to see if the user is in editor and if so dispatch the command.
         * @param {MUDInputEvent} evt
         */
        function executeEditor(evt) {
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
        function executeHistory(evt) {
            if (evt.verb.charAt(0) === '!') {
                let cmd = evt.verb.slice(1), index = -1, num = parseInt(cmd);

                if (cmd === '!') { // user input = !! (repeat last command)
                    if (history.length === 0) 
                        self.writeLine('No history, yet');
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
                    var words = history[index].split(/\s+/g);
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
        function executeShellCommand(evt) {
            if (evt.verb === 'history') {
                let show = true, i = 0, max = 0, nv = 0;
                for (i = 0, max = evt.args.length; i < max; i++) {
                    switch (evt.args[i]) {
                        case '-d':
                            if ((i + 1) >= evt.args.length) {
                                this.writeLine('History: Usage: history -d [offset]');
                                return true;
                            }
                            var deleteList = [];
                            do {
                                if (!(nv = parseInt(evt.args[i + 1]))) break;
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
        function expandAliases(evt) {
            let aliases = self.aliases,
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
         * @param {MUDInputEvent} evt
         */
        function processInput(evt) {
            try {
                let result = false, cmd = false, cmdResult = false;

                if ((cmdResult = executeEditor(evt))) result = cmdResult;
                else if (expandAliases.call(self, evt)) result = true;
                else if (executeHistory.call(self, evt)) result = true;
                else if (executeShellCommand.call(self, evt)) result = true;
                else if (ChatDaemon().cmd(evt.verb, evt.args, evt)) result = true;
                else if ((cmd = CommandResolver().resolve(evt.verb, self.searchPath))) {
                    result = evt.caps.htmlEnabled && typeof cmd.webcmd === 'function' ? cmd.webcmd(evt.args, evt) : cmd.cmd(evt.args, evt);
                }
                else if ((cmdResult = EmoteDaemon().cmd(evt.verb, evt.args, evt))) result = cmdResult;
                if (evt.fromHistory === false) history.push(evt.original);
                var resultType = typeof result;

                if (result === true) {
                    /* command was syncronous and completed successfully */
                    if (!result) self.writeLine(evt.error);
                    return evt.complete(MUDEVENT_STOP, evt);
                }
                else if (resultType === 'string') {
                    /* end of the line */
                    if (evt.verb.length > 0) this.writeLine(evt.error = result);
                    return evt.complete(MUDEVENT_STOP, evt);
                }
                else if (resultType === 'function') {
                    /* command is doing something async */
                    return MUDEVENT_STOP;
                }
                else if (result === MUDEVENT_STOP) {
                    return evt.complete(MUDEVENT_STOP, evt);
                }
                else {
                    /* end of the line */
                    if (evt.verb.length > 0) this.writeLine(evt.error);
                    return evt.complete(MUDEVENT_STOP, evt);
                }
            }
            catch (err) {
                this.writeLine('You encountered an error.');
                if (efuns.wizardp(this)) {
                    this.writeLine(efuns.indent(err.stack));
                }
                return evt.complete(MUDEVENT_STOP, evt);
            }
        }

        $storage.prependListener('kmud.command', (/** @type {MUDInputEvent} */ evt) => {
            return processInput.call(self, evt); // self.preprocessInput(evt, processInput);
        }).on('kmud.exec', (evt) => {
            if (unwrap(evt.newBody).filename === self.filename) {
                _client = evt.client;
                _remoteAddress = _client.remoteAddress;
                self.connect(_client);
            }
            else {
                _client = null;
                _remoteAddress = false;
            }
        });
    }

    getAge(flag) {
        return flag === true ?
            [this.getProperty('age'), this.getProperty('idleAge')] :
            this.getProperty('age', 0);
    }

    get aliases() { return this.getProperty('aliases', {}); }

    get birth() { return this.getProperty('birthday', new Date().getTime()); }

    get commandHistory() {
        return this.getProperty('commandHistory', []);
    }

    connect(client) {
        let self = this;

        client.on('disconnected', e => {
            this.setSymbol(_connected, false);
            this[_client] = null;
        });
        client.on('disconnect', e => {
            this.setSymbol(_connected, false);
            this[_client] = null;
        });

        this.setSymbol(_connected, true);

        var channels = this.getProperty('channels', {}),
            channelList = ChatDaemon().eventAddListener(this.wrapper)
                .map(ch => {
                    if (!(ch in channels)) channels[ch] = true;
                    return ch;
                }),
            deleteChannels = Object.keys(channels)
                .filter(ch => {
                    if (channelList.indexOf(ch) === -1)
                        delete channels[ch];
                });

        this.setProperty('lastLogin', new Date().getTime());
    }

    get channels() {
        return efuns.merge({}, this.getProperty('channels', {}));
    }

    get connected() {
        return this.getSymbol(_connected, false);
    }

    destroy(isReload) {
        if (!isReload) {
            if (this.client) this.client.close();
            this[_connected] = false;
        }
        super.destroy(isReload);
    }

    eventHeartbeat(length, ticks) {
        try {
            this.incrementProperty('age', length, 0);
            if (efuns.queryIdle(this) > 60000)
                this.incrementProperty('idleAge', length, 0);
        }
        catch (e) {
            this.writeLine('Your heart has stopped!');
            this.enableHeartbeat(false);
        }
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
        if (cmd === '!') {
            if (hist.length === 0) {
                this.writeLine('No history, yet');
            }
            else {
                return this.dispatchInput(hist[hist.length - 1], true);
            }
            return true;
        }
        else {
            for (var i = hist.length - 1; i > 0; i--) {
                if (hist[i].startsWith(cmd)) {
                    return this.dispatchInput(hist[i], true);
                }
            }
            var self = this, test = cmd.split(',').filter(function (s, i) {
                var n = parseInt(s);
                if (typeof n === 'number' && n > -1 && hist[n]) {
                    return self.dispatchInput(hist[n], true), true;
                }
                return false;
            });
            if (test.length > 0) return true;

            this.writeLine('History: No match');
            return true;
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
                return true;

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

    getenv(name) {
        var env = this.getProperty('environment', {});
        if (typeof name === 'string') {
            return env[name];
        }
        return env;
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

    movePlayer(target) {
        if (this.moveObject(target)) {
            this.writeLine(this.environment.onGetDescription(this));
        }
    }

    get searchPath() {
        return [
            DIR_CMDS_COMMON,
            DIR_CMDS_ITEMS
        ];
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

    write(msg) {
        if (this.connected && this.client) {
            this.client.write(msg || '');
        }
    }

    writeLine(msg) {
        if (this.connected && this.client) {
            this.client.write(msg + "\n");
        }
    }

    writePrompt(data, cb) {
        if (this.client) {
            this.client.addPrompt(data, cb);
        }
        return this;
    }
}

MUD.export(Interactive);
