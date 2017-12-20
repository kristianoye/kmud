include('Base');

imports(LIB_COMMAND);

class Password extends Command
{
    /**
        * 
        * @param {string[]} args
        * @param {MUDInputEvent} cmdline
        */
    cmd(args, cmdline) {
        throw new Error('Random runtime error');
    }
}


MUD.exports = Password;
