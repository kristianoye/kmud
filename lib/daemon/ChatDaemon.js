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
    //    this.history = [];
    //    this.listeners = [];
    //    this.name = name;
    //    this.checkUser = userCheck || function () {
    //        return CH_RECEIVE;
    //    };
    }

    private set display(val) {
        if (typeof val === 'string')
            set(val);
    }

    get display() { return get(); }

    broadcast(message, sender, isEmote) {
        let displayName = 'BROADCAST',
            invis = false;

        if (efuns.playerp(sender)) {
            invis = !sender.visible;
            displayName = invis ? 'Somebody' : sender.displayName;
        }
        else if (typeof sender === 'string')
            displayName = sender;
        else if (typeof sender === 'object')
            displayName = sender.displayName;

        let entry = {
            message,
            displayName,
            invis,
            isEmote,
            time: new Date().getTime()
        };

        this.listeners.forEach(user => this.eventTransmit(user, entry));
        this.history.push(entry);
    }

    /**
        * 
        * @param {string[]} args The user's command broken into words.
        * @param {boolean} isEmote True if this is an emote.
        */
    cmd(verb, args, evt, isEmote = false) {
        let tp = thisPlayer(),
            listening = true,
            perms = this.checkUser(tp);

        if (!perms)
            return errorLine(`You do not have access to ${this.display}`);

        if (args.length === 0) {
            listening = !tp.isListening(this.name);

            tp.setListening(this.name, listening);
            writeLine(`You are ${(listening ? 'now' : 'no longer')} listening to ${this.display}`);
            return true;
        }
        switch (args[0].toLowerCase()) {
            case "/last": case "-last":
                this.history.forEach(h => this.eventTransmit(tp, h, true));
                if (this.history.length === 0)
                    writeLine('There is no chat history available for ' + this.display);
                return true;

            case "/off": case "-off":
                listening = false;

            case "/on": case "-on":
                tp.setListening(this.name, listening);
                writeLine(`You are ${(listening ? 'now' : 'no longer')} listening to ${this.display}`);
                return true;

            case "/toggle": case "-toggle":
                return this.cmd([evt], evt.args, evt, isEmote);

            case "/who": case "-who":
                let list = this.listeners.map(wp => {
                    let p = unwrap(wp);
                    if (!p.isListening(this.name))
                        return '';
                    if (!p.visible) {
                        if (efuns.archp(tp))
                            return '(' + p.displayName + ')';
                        else if (efuns.wizardp(tp))
                            return '(Someone)';
                        else return '';
                    }
                    return p.displayName;
                }).filter(s => s.length > 0);

                if (list.length === 0)
                    return writeLine('No one is listening to ' + this.display);
                else
                    return writeLine(`There are ${list.length} people listening to ${this.display}:\n\t${list.join(', ')}`);

            default:
                if (perms === CH_RECEIVE) {
                    writeLine('You cannot send messages on ' + this.display);
                    return true;
                }
                this.broadcast(evt.text, tp, isEmote);;
                return true;
        }
    }

    eventAddListener(tp) {
        let result = this.checkUser(tp);
        if (result > 0) {
            let inChannel = this.listeners.filter(u => u() === tp).length > 0;
            if (!inChannel)
                this.listeners.pushDistinct(wrapper(tp));
            return true;
        }
        return false;
    }

    eventRemoveListener(tp) {
        let n = this.listeners.indexOf(w => unwrap(w, u => u.keyId === tp.keyId));
        if (n > -1) {
            this.listeners.splice(n, 1);
            return this.name;
        }
        return false;
    }

    /**
     * Send a message to a channel recipient.
     * @param {{ displayName: string, message: string, invis: boolean, time: number, isEmote: boolean }} msg THe message to transmit
     */
    eventTransmit(user, msg, showTime = false) {
        unwrap(user, u => {
            let dn = msg.invis ? 'Somebody' : msg.displayName;
            if (msg.invis && efuns.archp(u))
                dn = `[${msg.displayName}]`;

            if (u.isListening(this.name) || showTime) {
                if (u.hasBrowser) {
                    u.eventSend({
                        type: 'chatMessage',
                        data: {
                            channel: this.name,
                            channelDisplay: this.display,
                            timestamp: new Date().getTime(),
                            message: msg.message,
                            isEmote: msg.isEmote || false,
                            sender: dn
                        }
                    });
                }
                else {
                    if (showTime) {
                        let tms = new Date(msg.time).toISOString(), line = msg.isEmote ?
                            `[${tms}] ${this.display} ${dn} ${msg.message}` :
                            `[${tms}] ${dn} ${this.display} ${msg.message}`;
                        u.receiveMessage('channel', line);
                    }
                    else {
                        let line = msg.isEmote ?
                            `${this.display} ${dn} ${msg.message}` :
                            `${dn} ${this.display} ${msg.message}`;
                        u.receiveMessage('channel', line);
                    }
                }
            }
        });
    }
}

class ChatDaemon extends MUDObject {
    private async create() {
        await this.addChannel('admin', '%^MAGENTA%^[[%^BOLD%^admin%^RESET%^%^MAGENTA%^]]%^RESET%^%^RESET%^', p => {
            return unwrap(p, player => {
                return efuns.adminp(player) ? CH_SEND | CH_RECEIVE : 0;
            });
        });
        await this.addChannel('announce', '** ANNOUNCEMENT **', p => {
            return unwrap(p, player => {
                return efuns.archp(player) ? CH_SEND | CH_RECEIVE : CH_RECEIVE;
            });
        });
        await this.addChannel('arch', '%^MAGENTA%^[arch]%^RESET%^', p => {
            return unwrap(p, player => {
                return efuns.archp(player) ? CH_SEND | CH_RECEIVE : 0;
            });
        });
        await this.addChannel('newbie', '[%^GREEN%^newbie%^RESET%^]', p => {
            return unwrap(p, player => {
                if (efuns.wizardp(player)) return CH_SEND | CH_RECEIVE;
                else if (player.getLevel() < 10) return CH_SEND | CH_RECEIVE;
                else return 0;
            });
        });
        await this.addChannel('wiz', '%^BLUE%^[%^RESET%^%^RED%^wiz%^RESET%^%^BLUE%^]%^RESET%^', p => {
            return unwrap(p, player => {
                return efuns.wizardp(player) ? CH_SEND | CH_RECEIVE : 0;
            });
        });
        efuns.living.players().forEach(p => {
            let channels = p.channels;
            Object.keys(channels).forEach(ch => {
                let channel = this.getChannel(ch);
                channel.eventAddListener(p);
            });
        });
    }

    /**
     * 
     * @param {string} string The name of the channel (verb form)
     * @param {string} display The colorized version of the channel name
     * @param {function(MUDObject):number} userTest The test used to see if a user can listen/use the channel
     */
    async addChannel(name, display, userTest) {
        let channels = this.channels,
            oldChannel = channels[name] || false,
            newChannel = await createAsync(ChatChannel, name, display, userTest);

        if (oldChannel) {
            newChannel.listeners = oldChannel.listeners;
            newChannel.history = oldChannel.history;
        }
        channels[name] = newChannel;
        return this;
    }

    broadcast(channel, text) {
        let ch = this.getChannel(channel);
        if (ch) { ch.broadcast(text, '', true); }
    }

    /** @type {Object.<string,ChatChannel>} */
    get channels() {
        return get({});
    }

    get channelNames() {
        return Object.keys(this.channels);
    }

    /**
        * Attempt to execute a chat command
        * @param {String} verb The channel to communicate on.
        * @param {String[]} args The command line broken into words
        * @param {String} evt The raw command text
        */
    cmd(verb, args, evt) {
        let isEmote = false,
            pn = thisPlayer().displayName;

        if (verb.endsWith(':')) {
            verb = verb.substr(0, verb.length - 1);
            isEmote = true;
        }
        else if (args[0] === ':') {
            isEmote = true;
            evt.args.shift();
            evt.text = evt.text.slice(evt.text.indexOf(':') + 1).trim();
        }
        else if (verb.endsWith('emote')) {
            verb = verb.slice(0, verb.length - 5);
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
        let channel = this.getChannel(verb);
        return channel ? channel.cmd(verb, evt.args, evt, isEmote) : false;
    }

    displayChannels(tp) {
        let channels = tp.channels;
        let lines = Object.keys(channels)
            .sort((a, b) => a < b ? -1 : 1)
            .map(a => {
                let ch = this.getChannel(a);
                return 'You ' + (channels[a] ? 'are' : 'are not') +
                    ' listening to ' + (ch.display || a) + '.';
            });
        return writeLine(lines.join('\n'));
    }

    /**
        * 
        * @param {String} name The name of the channel to fetch.
        * @returns {ChatChannel|boolean} The channel requested or false if no such channel exists.
        */
    getChannel(name) {
        let ch = this.channels;
        return ch[name] || false;
    }

    eventRemoveListener(tp) {
        return this.channels.map(ch => {
            return this.getChannel(ch).eventRemoveListener(tp);
        }).filter(r => r !== false);
    }

    eventAddListener(tp) {
        return this.channelNames.filter(ch => {
            return this.getChannel(ch).eventAddListener(tp);
        });
    }
}

module.exports = {
    ChatChannel,
    ChatDaemon: await createAsync(ChatDaemon)
};

