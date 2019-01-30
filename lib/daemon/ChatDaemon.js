/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    CH_SEND = 1,
    CH_RECEIVE = 2;

class ChatChannel {
    constructor(name, display, userCheck) {
        this.display = display;
        this.history = [];
        this.listeners = [];
        this.name = name;
        this.checkUser = userCheck || function () { return CH_RECEIVE; };
    }

    broadcast(msg, sender, isEmote) {
        var displayName = '', invis = false;
        this.history.push({
            time: new Date().getTime(),
            message: msg
        });
        if (efuns.playerp(sender)) {
            displayName = !sender.isVisible() ? 'Somebody' : sender.displayName;
            invis = true;
        }
        else if (typeof sender === 'string')
            displayName = sender;
        else if (typeof sender === 'object')
            displayName = sender.displayName;

        this.listeners.forEach(wp => {
            var p = unwrap(wp), dn = displayName;
            if (!p) return;
            if (invis && efuns.archp(p)) {
                dn = '[' + sender.displayName + ']';
            }
            if (p.isListening(this.name)) {
                if (p.hasBrowser) {
                    p.eventSend({
                        channelName: this.name,
                        channelDisplay: this.display,
                        eventTime: new Date().getTime(),
                        eventType: 'chatMessage',
                        eventData: msg,
                        eventEmote: isEmote || false,
                        eventPlayer: dn
                    });
                }
                else {
                    var line = isEmote ?
                        `${this.display} ${dn} ${msg}` :
                        `${dn} ${this.display} ${msg}`;
                    p.writeLine(line.trim());
                }
            }
        });
    }

    /**
        * 
        * @param {string[]} args The user's command broken into words.
        * @param {CmdLineInfo} cmdline Raw command line data.
        * @param {boolean} isEmote True if this is an emote.
        */
    cmd(args, cmdline, isEmote) {
        var tp = thisPlayer,
            listening = true,
            perms = this.checkUser(tp);

        if (!perms) return false;

        if (args.length === 0) {
            listening = !tp.isListening(this.name);

            tp.setListening(this.name, listening);
            tp.writeLine(`You are ${(listening ? 'now' : 'no longer')} listening to ${this.display}`);
            return true;
        }
        switch (args[0].toLowerCase()) {
            case "/last": case "-last":
                this.history.forEach(h => {
                    if (tp.hasBrowser) {
                        tp.eventSend({
                            eventTime: new Date().getTime(),
                            eventType: 'chatMessage',
                            eventData: new Date().getTime() + ': ' + h.message,
                            eventPlayer: tp.name
                        });
                    }
                    else {
                        tp.writeLine(h.message);
                    }
                });
                if (this.history.length === 0)
                    tp.writeLine('There is no chat history available for ' + this.display);
                return true;

            case "/off": case "-off":
                listening = false;

            case "/on": case "-on":
                tp.setListening(this.name, listening);
                tp.writeLine(`You are ${(listening ? 'now' : 'no longer')} listening to ${this.display}`);
                return true;

            case "/toggle": case "-toggle":
                return this.cmd([], cmdline, false);

            case "/who": case "-who":
                var list = this.listeners.map(wp => {
                    var p = unwrap(wp);
                    if (!p.isListening(this.name))
                        return '';
                    if (!p.isVisible()) {
                        if (efuns.archp(tp))
                            return '(' + p.displayName + ')';
                        else if (efuns.wizardp(tp))
                            return '(Someone)';
                        else return '';
                    }
                    return p.displayName;
                }).filter(s => s.length > 0);

                if (list.length === 0)
                    tp.writeLine('No one is listening to ' + this.display);
                else
                    tp.writeLine(`People listening to ${this.display}: ${list.join(', ')}`);
                return true;

            default:
                if (perms === CH_RECEIVE) {
                    tp.writeLine('You cannot send messages on ' + this.display);
                    return true;
                }
                this.broadcast(cmdline.input, tp, isEmote);;
                return true;
        }
    }

    eventAddListener(tp) {
        var result = this.checkUser(tp);
        if (result > 0) {
            this.listeners.pushDistinct(tp);
            return true;
        }
        return false;
    }

    eventRemoveListener(tp) {
        var n = this.listeners.indexOf(tp);
        if (n > -1) {
            this.listeners.splice(n, 1);
            return this.name;
        }
        return false;
    }
}

class ChatDaemon extends MUDObject {
    /**
        *
        * @param {MUDCreationContext} ctx
        */
    constructor(ctx) {
        super(ctx.prop({
            channels: {}
        }));

        this.addChannel('admin', '%^MAGENTA%^[[%^BOLD%^admin%^RESET%^%^MAGENTA%^]]%^RESET%^%^RESET%^', p => {
            return unwrap(p, player => {
                return efuns.adminp(player) ? CH_SEND | CH_RECEIVE : 0;
            });
        });
        this.addChannel('announce', '** ANNOUNCEMENT **', p => {
            return unwrap(p, player => {
                return efuns.archp(player) ? CH_SEND | CH_RECEIVE : CH_RECEIVE;
            });
        });
        this.addChannel('arch', '%^MAGENTA%^[arch]%^RESET%^', p => {
            return unwrap(p, player => {
                return efuns.archp(player) ? CH_SEND | CH_RECEIVE : 0;
            });
        });
        this.addChannel('newbie', '[%^GREEN%^newbie%^RESET%^]', p => {
            return unwrap(p, player => {
                if (efuns.wizardp(player)) return CH_SEND | CH_RECEIVE;
                else if (player.getLevel() < 10) return CH_SEND | CH_RECEIVE;
                else return 0;
            });
        });
        this.addChannel('wiz', '%^BLUE%^[%^RESET%^%^RED%^wiz%^RESET%^%^BLUE%^]%^RESET%^', p => {
            return unwrap(p, player => {
                return efuns.wizardp(player) ? CH_SEND | CH_RECEIVE : 0;
            });
        });
    }

    create() {
        efuns.players().forEach(p => {
            this.eventAddListener(p);
        });
    }

    addChannel(name, display, userTest) {
        var channels = this.getProperty('channels', {}),
            oldChannel = channels[name] || false,
            newChannel = new ChatChannel(name, display, userTest);

        if (oldChannel) {
            newChannel.listeners = oldChannel.listeners;
            newChannel.history = oldChannel.history;
        }
        channels[name] = newChannel;
        return this;
    }

    broadcast(channel, text) {
        var ch = this.getChannel(channel);
        if (ch) { ch.broadcast(text, '', true); }
    }

    get channels() {
        var channels = this.getProperty('channels', {});
        return Object.keys(channels);
    }

    /**
        * Attempt to execute a chat command
        * @param {String} verb The channel to communicate on.
        * @param {String[]} args The command line broken into words
        * @param {String} cmdline The raw command text
        */
    cmd(verb, args, cmdline) {
        var isEmote = false,
            pn = thisPlayer.getName();

        if (verb.endsWith(':')) {
            verb = verb.substr(0, verb.length - 1);
            isEmote = true;
        }
        if (verb === 'last') {
            if (args.length === 0) 
                return 'Usage: last [channel]';
            verb = args[0];
            args.unshift('-last');
        }
        if (verb === "lines") {
            return this.displayChannels(thisPlayer);
        }
        var channel = this.getChannel(verb);
        return channel ? channel.cmd(args, cmdline, isEmote) : false;
    }

    displayChannels(tp) {
        var channels = tp.channels;
        var lines = Object.keys(channels)
            .sort((a, b) => a < b ? -1 : 1)
            .map(a => {
                var ch = this.getChannel(a);
                return 'You ' + (channels[a] ? 'are' : 'are not') +
                    ' listening to ' + (ch.display || a) + '.';
            });
        tp.writeLine(lines.join('\n'));
        return true;
    }

    /**
        * 
        * @param {String} name The name of the channel to fetch.
        * @returns {ChatChannel|boolean} The channel requested or false if no such channel exists.
        */
    getChannel(name) {
        var ch = this.getProperty('channels', {});
        return ch[name] || false;
    }

    eventRemoveListener(tp) {
        return this.channels.map(ch => {
            return this.getChannel(ch).eventRemoveListener(tp);
        }).filter(r => r !== false);
    }

    eventAddListener(tp) {
        return this.channels.filter(ch => {
            return this.getChannel(ch).eventAddListener(tp);
        });
    }
}

module.exports = { ChatChannel, ChatDaemon };

