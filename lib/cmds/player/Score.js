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
            text: `
<p><strong>Syntax:</strong> score</p>
<p>The <strong>score</strong> command will display your characters attributes and current status.</p>`,
            see: ['skills', 'body', 'languages']
        };
    }

}

MUD.export(Score);
