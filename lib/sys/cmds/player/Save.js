MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class SaveCommand extends Command {
    /**
     * 
     * @param {string[]} args
     * @param {MUDInputEvent} evt
     */
    cmd(args, evt) {
        thisPlayer.save(function (success) {
            write(success ? 'Saved successfully.' : 'Save failed');
            return evt.complete();
        });
        return evt.complete;
    }
}

module.exports = SaveCommand;

