
const
    Dialog = require('./src/Dialog');

class TestApp extends Dialog.ConsoleApp {
    setup() {
        this
            .add({
                text: 'Configure Mudlib', char: 'c', control: new Dialog.MainMenu({ text: 'MUD Config', prompt: 'MUD Option' })
                    .add({
                        text: 'Return to Main Menu', char: 'm', callback: function () {
                            Dialog.writeLine('Exit MUD Configuration');
                            return Dialog.DlgResult.OK;
                        }
                    })

            })
            .add({
                text: 'Setup MUD', char: 's', callback: function () {
                    Dialog.writeLine('Save config and exit.');
                    return Dialog.DlgResult.OK;
                }
            })
            .add({
                text: 'Exit Setup', char: 'x', callback: function () {
                    Dialog.writeLine('Quit without saving.');
                    return Dialog.DlgResult.Exit;
                }
            });

        return this;
    }
}

module.exports = new TestApp({
    text: 'This is a test application.  This is only a test.',
    prompt: 'Selection?',
    help: 'Yeah you aren\'t going to get much help here.'
});

