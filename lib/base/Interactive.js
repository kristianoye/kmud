const
    _connected = Symbol('_connected'),
    _client = Symbol('_client');

include('Base', 'Dirs', 'Daemon');

imports(LIB_LIVING);

var ChatDaemon = efuns.loadObject(DAEMON_CHAT),
    CommandResolver = efuns.loadObject(DAEMON_COMMAND);

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
            /** @type {string[]} */ history = $storage.getProtected('commandHistory', []),
            self = this;

        Object.defineProperties(this, {
            client: {
                get: function () { return _client; }
            },
            connected: {
                get: function () { return _remoteAddress !== false; }
            }
        });

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
                    this.writeLine('History: No match');
                    return true;
                }
                if (index > -1) {
                    var words = history[index].split(/\s+/g);
                    evt.fromHistory = true;
                    evt.verb = words.shift().trim();
                    evt.input = history[index].slice(evt.verb).trim();
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


        function processInput(evt) {
            let result = false, cmdWrapper = false;

            expandAliases.call(self, evt);

            if (executeHistory.call(self, evt)) result = true;
            else if (executeShellCommand.call(self, evt)) result = true;
            else if (ChatDaemon().cmd(evt.verb, evt.args, evt)) result = true;
            else if ((cmdWrapper = CommandResolver().resolve(evt.verb, self.searchPath))) {
                let cmd = unwrap(cmdWrapper);
                result = evt.useHtml && typeof cmd.webcmd === 'function' ? cmd.webcmd(evt.args, evt) : cmd.cmd(evt.args, evt);
            }
            if (evt.fromHistory === false) history.push(evt.original);
            var resultType = typeof result;

            if (result === true) {
                /* command was syncronous and completed successfully */
                if (!result) self.writeLine(evt.error);
                evt.callback.call(evt.client, evt);
                return MUDEVENT_STOP;
            }
            else if (resultType === 'string') {
                /* some other command might work, but if not display this error */
                evt.error = result;
            }
            else if (resultType === 'function') {
                /* command is doing something async */
                return MUDEVENT_STOP;
            }
        }

        $storage.prependListener('kmud.command', (/** @type {MUDInputEvent} */ evt) => {
            return self.preprocessInput(evt, processInput);
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
        return flag ?
            [this.getProperty('age'), this.getProperty('idleAge')] :
            this.getProperty('age', 0);
    }

    get aliases() { return this.getProperty('aliases', {}); }

    get birth() { return this.getProperty('birthday', new Date().getTime()); }

    get commandHistory() {
        return this.getProperty('commandHistory', []);
    }

    connect(client) {
        client.on('disconnected', e => {
            this.setSymbol(_connected, false);
            this[_client] = null;
        });
        client.on('disconnect', e => {
            this.setSymbol(_connected, false);
            this[_client] = null;
        });
        client.addPrompt({ text: '> ' }, function (input) {
            return self.dispatchInput(input);
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
        return Object.extend({}, this.getProperty('channels', {}));
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

    dispatchInput(input, fromHistory) {
        var rawInput = input;
        input = this.expandAliases(input);
        this['_lastCommand'] = new Date().getTime();
        if (/\S+/.test(input)) {
            var i,
                args = input.split(/\s+/g),
                verb = args.shift(),
                h = this.commandHistory;

            if (input.charAt(0) === '!')
                return this.executeHistory(input.substr(1));

            if (!fromHistory) h[h.length++] = input;

            // Remove verb from input
            input = input.replace(/^\S+\s*/, '');
            var cmdline = {
                verb: verb,
                input: input,
                client: this.client,
                raw: rawInput
            };

            if (this.executeShellCommand(verb, args))
                return true;

            if (ChatDaemon().cmd(verb, args, cmdline))
                return true;

            var cmdWrapper = CommandResolver().resolve(verb, this.searchPath),
                cmd = unwrap(cmdWrapper),
                result = false;

            if (cmd) {
                if (this.hasBrowser) {
                    if (typeof cmd.webcmd === 'function') {
                        return cmd.webcmd(args, cmdline);
                    }
                }
                // TODO: Add notify_error() apply?
                result = cmd.cmd(args, cmdline);
                if (typeof result === 'string') {
                    this.writeLine(result);
                    return true;
                }
            }
            var binding = this.getActions(verb);
            if (Array.isArray(binding)) {
                for (var n = 0; n < binding.length; n++) {
                    var action = binding[n]; 
                    result = action.callback.call(this, input);
                    if (result === true) break;
                }
            }
            if (typeof result === 'string')
                this.writeLine(result);
            else if (result === false)
                this.writeLine('What?');
            return true;
        }
        return true;
    }

    eventHeartbeat(length, ticks) {
        try {
            this.incrementProperty('age', length, 0);
            if (this.idleTime > 60000)
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

    executeShellCommand(cmd, args) {
        if (cmd === 'history') {
            var h = this.commandHistory, show = true, i, max, nv;
            for (i = 0, max = args.length; i < max; i++) {
                switch (args[i]) {
                    case '-d':
                        if ((i + 1) >= args.length) {
                            this.writeLine('History: Usage: history -d [offset]');
                            return true;
                        }
                        var deleteList = [];
                        do {
                            if (!(nv = parseInt(args[i+1]))) break;
                            deleteList.pushDistinct(nv);
                            i++;
                        }
                        while (true);
                        deleteList.sort((a, b) => a > b ? -1 : 1).forEach(i => {
                            h.splice(i, 1);
                        });
                        show = false;
                        break;

                    case '-c':
                        h.splice(0, h.length);
                        show = false;
                        break;
                }
            }
            for (i = 0, max = h.length; i < max; i++) {
                if (h[i]) {
                    this.writeLine('  {0}  {1}'.fs(i || '0', h[i]));
                }
            }
            return true;
        }
        return false;
    }

    expandAliases(input) {
        input = (input || '').trim();
        var words = input.split(/\s+/),
            aliases = this.aliases;

        if (words.length > 0) {
            var alias = aliases[words[0]];
            if (alias) {
                if (alias.indexOf('$') > -1) {
                    var output = alias.split(/\s+/);
                    for (var i = 0, m = output.length; i < m; i++) {
                        if (output[i].startsWith('$')) {
                            var tok = output[i].slice(1),
                                num = parseInt(tok);
                            if (tok === '*')
                                output[i] = words.slice(1).filter(s => s.length > 0).join(' ');
                            else if (tok > 0 && tok < words.length) {
                                output[i] = words[tok];
                                words[tok] = '';
                            }
                        }
                    }
                    return output.join(' ').trim();
                } else {
                    input = alias + input.slice(words[0].length);
                }
            }
        }

        return input;
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
            this.writeLine(this.environment.onGetDescription(thisPlayer))
        }
    }

    get searchPath() {
        var sp = [
            DIR_CMDS_COMMON,
            DIR_CMDS_ITEMS,
            DIR_CMDS_PLAYER
        ];
        return sp;
    }

    setClient(client) {
        var self = this;

        efuns.ifPermission('EXEC', () => {
            if (self[_client] !== client) {
                if (self[_client]) {
                    self.writeLine('Somebody else is invading your body!');
                    self.client.close('Remote session was taken by another client');
                }
                this.setSymbol(_client, client);
            }
        });
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

    writeHtml(html) {
        if (this.connected && this.client) {
            this.client.writeHtml(html);
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
