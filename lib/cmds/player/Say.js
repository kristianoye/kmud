MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class say extends Command {
    cmd(args, cmdline) {
        thisPlayer.writeLine('You say: "{0}{1}{2}"'.fs('%^RED%^', cmdline.input, '%^RESET%^'));
        thisPlayer.tellEnvironment('{0} says "%^RED%^%^BOLD%^{1}%^RESET%^"'.fs(thisPlayer.displayName, cmdline.input));
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

MUD.export(Say);
