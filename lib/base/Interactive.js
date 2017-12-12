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
    }

    getAge(flag) {
        return flag ?
            [this.getProperty('age'), this.getProperty('idleAge')] :
            this.getProperty('age', 0);
    }

    get aliases() { return this.getProperty('aliases', {}); }

    get birth() { return this.getProperty('birthday', new Date().getTime()); }

    get client() { return this.getSymbol(_client); }

    get commandHistory() {
        return this.getProperty('commandHistory', []);
    }

    connect() {
        var self = this, client = this.client;
        if (client) {
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
