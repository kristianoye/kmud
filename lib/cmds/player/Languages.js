MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class Languages extends Command {
    /**
        * 
        * @param {string[]} args
        * @param {CmdLineInfo} cmdline
        */
    cmd(args, cmdline) {
        var tp = thisPlayer,
            langs = tp.languages
                .map(name => Object.extend({ name: name }, tp.getLanguage(name)))
                .sort((a, b) => {
                    if (a.level === b.level) {
                        return (a.name < b.name) ? -1 : 1;
                    }
                    return a.level < b.level ? 1 : -1;
                })
                .map(lang => `You speak ${lang.name} with ${lang.level}% proficiency.`);

        if (langs.length === 0)
            return "You cannot speak any languages!";
        else
            tp.writeLine(langs.join('\n'));
        return true;
    }

    getHelp() {
        return {
            text: `
<p><strong>Syntax:</strong> languages</p>
<p>The <strong>languages</strong> command will display what languages you can read, write, and speak.</p>`,
            see: ['score', 'skills', 'body']
        };
    }
}

MUD.export(Languages);
