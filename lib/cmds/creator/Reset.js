
include('Base');

imports(LIB_COMMAND);

class Reset extends Command {
    cmd(args) {
        if (args.length === 0 || args[0] === 'here') {
            if (!thisPlayer.environment)
                return 'You are in the void!';
            efuns.write('You reset the room.');
            if (typeof thisPlayer.environment.reset === 'function')
                thisPlayer.environment.reset();
            return true;
        }
    }
}