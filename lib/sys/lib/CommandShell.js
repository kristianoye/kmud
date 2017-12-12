var
    ChatDaemon = efuns.loadObject('/daemon/ChatDaemon'),
    CommandResolver = efuns.loadObject('/sys/daemon/CommandResolver');

class CommandShell extends MUDObject {
    /**
        *
        * @param {MUDCreationContext} ctx
        */
    constructor(ctx) {
        super(ctx.prop({
            browser: false,
            client: null,
            commandHistory: { length: 0 },
            directoryStack: ['/'],
            environmentVars: {}
        }));

        if (ctx.hasArg('player')) {

        }
    }

    /**
        * A value indicating whether the client is a web browser (true)
        * @returns {boolean} True if the client is a web browser false if telnet or other.
        */
    get browser() {
        return this.getProperty('browser');
    }

    /**
        * The connected client.
        * @returns {ClientInstance} A reference to the connected client.
        */
    get client() {
        return this.getProperty('client');
    }

    get commandHistory() {
        return this.getProperty('commandHistory');
    }

    get directoryStack() {
        return this.getProperty('directoryStack') || ['/'];
    }

    get environment() {
        return this.getProperty('environmentVars') || {};
    }

    get player() {
        return this.getProperty('player');
    }

    get workingDirectory() {
        var stack = this.directoryStack;
        return stack.length > 0 ? stack[stack.length - 1] : '/';
    }

    set workingDirectory(dir) {
        var stack = this.directoryStack;
        efuns.isDirectory(dir, function (exists) {
            stack[stack.length - 1] = dir;
        });
    }

    dispatchInput(input, fromHistory) {
        var rawInput = input;
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

            if (this.executeShellCommand(verb, args))
                return true;

            if (ChatDaemon().cmd(verb, args, input))
                return true;

            var cmdWrapper = CommandResolver().resolve(verb),
                cmd = unwrap(cmdWrapper);
            if (cmd) {
                if (this.browser) {
                    if (typeof cmd.webcmd === 'function') {
                        return cmd.webcmd(args, {
                            verb: verb,
                            input: input,
                            client: this.client,
                            raw: rawInput
                        });
                    }
                }
                return cmd.cmd(args, {
                    verb: verb,
                    input: input,
                    client: this.client,
                    raw: rawInput
                });
            }
            else {
                this.player.writeLine('What?');
                return -2;
            }
        }
    }

    displayStack() {
        var ds = this.directoryStack, s = [];
        for (var i = ds.length - 1; i > -1; i--) { s.push(ds[i]); }
        this.player.writeLine(s.join(' '));

    }

    executeShellCommand(cmd, args) {
        if (cmd === 'dirs') {
            this.displayStack();
            return true;
        }

        if (cmd === 'history') {
            var h = this.commandHistory
            for (var i = 0; i < h.length; i++) {
                if (h[i]) {
                    this.player.writeLine('  {0}  {1}'.fs(i || '0', h[i]));
                }
            }
            return true;
        }

        if (cmd === 'pushd') {
            var dir = args.pop(), ds = this.directoryStack, s = [];
            if (efuns.isDirectory(dir)) {
                ds[ds.length] = dir;
                this.displayStack();
            }
            else {
                this.player.writeLine('No such directory');
            }
            return true;
        }

        if (cmd === 'popd') {
            var ds = this.directoryStack, s = [];
            if (ds.length < 2) {
                this.player.writeLine('popd: directory stack empty');
                return -2;
            }
            ds.pop(), this.displayStack();
            return true;
        }
        return false;
    }

    executeHistory(cmd) {
        var hist = this.commandHistory;
        if (cmd === '!') {
            if (hist.length === 0) {
                this.player.writeLine('No history, yet');
            }
            else {
                return this.dispatchInput(hist[hist.length - 1], true);
            }
            return true;
        }
        else {
            var n = parseInt(cmd);
            if (n > -1) {
                if (hist[n]) {
                    return this.dispatchInput(hist[n], true);
                }
            }
            else for (var i = hist.length - 1; i > 0; i--) {
                if (hist[i].startsWith(cmd)) {
                    return this.dispatchInput(hist[i], true);
                }
            }
            this.player.writeLine('History: No match');
            return true;
        }
    }
}

MUD.export(CommandShell);
