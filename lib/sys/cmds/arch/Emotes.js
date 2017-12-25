
const
    Command = require('../../../base/Command'),
    EmoteDaemon = efuns.loadObject('/daemon/EmoteDaemon');

class EmotesCommand extends Command {
    /**
     * Manager command for the emote system.  Allows user to add/delete/modify emotes and adverbs.
     * @param {string[]} args
     */
    cmd(args) {
        let params = [], targetType = false;
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
                        efuns.write(`Added emote '${params[0]}'`);
                    }
                    else {
                        EmoteDaemon().addAdverbs(...params);
                        efuns.write(`Added adverb(s) ${params.map(s => `'${s}'`).join(', ')}`);
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
                            result = EmoteDaemon().getAdverbs(filter);
                        else
                            result = EmoteDaemon().getEmotes(filter);

                        thisPlayer.write(result.join('\n'));
                    }
                    break;

                case 'remove':
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

module.exports = EmotesCommand;
