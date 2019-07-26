/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Daemon = require('Daemon'),
    Command = require(Base.Command);
    EmoteDaemon = efuns.loadObjectSync(Daemon.Emote);

class EmotesCommand extends Command {
    /**
     * 
     * @param {string} cmdline Raw command line
     * @param {MUDInputEvent} evt The input event
     */
    cmd(cmdline, evt) {
        let params = [], targetType = false, args = evt.args;

        if (!args.length)
            return 'Usage: emotes[options]';

        for (let i = 0, max = args.length; i < max; i++) {
            let arg = args[i].startsWith('--') ? args[i].slice(2) :
                args[i].startsWith('-') ? args[i].slice(1) :
                    args[i].startsWith('/') ? args.slice(1) : args[i];

            switch (arg.toLowerCase()) {
                case 'add':
                    if (++i === max)
                        return `Usage: emotes add [adverb|emote] [emote rule]`;
                    else if (args[i].match(/^adverb[s]*$/i))
                        targetType = 'adverb';
                    else if (args[i].match(/^emote[s]*/i))
                        targetType = 'emote';
                    else
                        return `Usage: emotes add [add|emote] [params...] (type ${args[i]} not recognized)`;

                    while (++i < max && !args[i].match(/^[-\/]{1,2}/)) {
                        params.push(args[i]);
                    }
                    if (params.length === 0)
                        return `Usage: emotes add ${targetType} [params...]`;
                    if (targetType === 'emote') {
                        if (params.length === 1) params.push('');
                        EmoteDaemon().addEmoteRule(params[0], params.slice(1).join(' '));
                        writeLine(`Added emote '${params[0]}'`);
                    }
                    else {
                        EmoteDaemon().addAdverbs(...params);
                        writeLine(`Added adverb(s) ${params.map(s => `'${s}'`).join(', ')}`);
                    }
                    params = [];
                    break;

                case 'list':
                    if (++i === max)
                        return 'Usage: emotes list [emotes|adverbs]';
                    else if (!args[i].match(/^(?:adverb|emote)[s]*/i))
                        return `Usage: emotes list [emotes|adverbs] (type ${args[i]} not recognized)`;
                    else {
                        targetType = args[i].toLowerCase();
                        let filter = ++i < max && args[i].toLowerCase() === 'like' ? args[++i] || null : false,
                            result = [];
                        if (filter === null)
                            return `Usage: emotes list ${targetType} LIKE [pattern]`;
                        else if (filter) {
                            if (filter.endsWith('*') && !filter.startsWith('^'))
                                filter = '^' + filter.slice(0, filter.length - 1);
                            filter = new RegExp(filter, 'i');
                        }

                        if (targetType.startsWith('adverb'))
                            result = EmoteDaemon().getAdverbs(filter).sort();
                        else
                            result = EmoteDaemon().getEmotes(filter);

                        thisPlayer().write(efuns.columnText(result));
                    }
                    break;

                case 'remove':
                case 'delete': 
                    if (++i === max)
                        return `Usage: emotes ${args[i - 1]} [emote|adverb] [list...]`;
                    else if (!args[i].match(/^(?:adverb|emote)[s]*/i))
                        return `Usage: emotes remove [emote|adverb] [list...]`;
                    else if (++i === max)
                        return `Usage: emotes ${args[i-2]} ${args[i-1]} [list...]`;
                    else {
                        targetType = args[i-1].toLowerCase();
                        if (targetType === 'adverbs') {
                            let list = EmoteDaemon().getAdverbs();
                            args.forEach((a) => {
                                let n = list.indexOf(a);
                                if (n > -1) {
                                    list.splice(n, 1);
                                    thisPlayer().write(`Adverb '${a}' removed.`);
                                }
                            });
                        }
                        else {
                            let emotes = EmoteDaemon().emotes;
                            args.forEach((a) => {
                                if (a in emotes) {
                                    delete emotes[a];
                                    thisPlayer().write(`Emote '${a}' removed.`);
                                }
                            });
                        }
                    }
                    break;

                case 'update':
                    break;

                default:
                    return `Unknown emotes switch: ${args[i]}`;
            }
        }
        return true;
    }
}

module.exports = new EmotesCommand();
