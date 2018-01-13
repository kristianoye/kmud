
const
    Command = require('../../base/Command');

class SayCommand extends Command {
    cmd(args, cmdline) {
        let verb = cmdline.input.endsWith('?') ? 'ask' : 'say';

        efuns.write(`You ${verb}, "%^RED%^${cmdline.input}%^RESET%^"`);
        efuns.message('thirdPerson', `${thisPlayer.displayName} ${efuns.pluralize(verb)}, "%^RED%^${cmdline.input}%^RESET%^"`,
            thisPlayer.environment.inventory, [thisPlayer]);
        return true;
    }

    help() {
        return [
            'Usage: say <message>',
            '--------------------',
            'Sends a message to players in the same room as yourself.'
        ].join('\n');
    }
}

module.exports = SayCommand;
