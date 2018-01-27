MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class Score extends Command {
    cmd() {
        return 'Command not implemented';
    }

    webcmd() {
        thisPlayer.writeLine('You score!');
        return true;
    }

    getHelp() {
        return {
            type: 'command',
            category: 'Commands > Player Commands > Status Commands',
            description: `
                <p><strong>Syntax:</strong> score</p>
                <p>The <strong>score</strong> command will display your characters attributes and current status.</p>`,
            seeAlso: ['skills', 'body', 'languages']
        };
    }

}

MUD.export(Score);
