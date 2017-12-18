const
    _commands = '_commands', // Symbol('_commands'),
    _directory = '_directory', // Symbol('_directory'),
    _directories =  Symbol('_directories'),
    _path = '_path'; // Symbol('_path');

class CommandDirectory {
    constructor(dir) {
        this[_commands] = {};
        this[_directory] = dir;
    }

    /**
        * @returns {string[]} All known commands
        */
    get commands() { return Object.keys(this[_commands]); }

    get directory() { return this[_directory]; }

    addCommand(cmd, withExt) {
        this[_commands][cmd.toLowerCase()] = [cmd, withExt];
        return this;
    }

    getCommand(cmd) {
        return this[_commands][cmd] || undefined;
    }
}

class CommandResolver extends MUDObject {
    /**
        *
        * @param {MUDCreationContext} ctx
        */
    constructor(ctx) {
        super(ctx.
            symbols(_directories, {}));
    }

    create() {
        this
            .hashCommandDirectory('/cmds/admin/')
            .hashCommandDirectory('/cmds/common/')
            .hashCommandDirectory('/cmds/items/')
            .hashCommandDirectory('/cmds/creator/')
            .hashCommandDirectory('/cmds/player/')
            .hashCommandDirectory('/sys/cmds/admin')
            .hashCommandDirectory('/sys/cmds/arch')
            .hashCommandDirectory('/sys/cmds/creator')
            .hashCommandDirectory('/sys/cmds/player');
    }

    /**
        * @returns {CommandDirectory[]} Returns all hashed directories.
        */
    get directories() {
        return this.getSymbol(_directories);
    }

    get directoryNames() {
        return Object.keys(this.directories);
    }
    /**
        * Scan a directory and index commands.
        * @param {string} dir The directory scan for commands.
        */
    hashCommandDirectory(cmdDir) {
        efuns.getDir(cmdDir, (files, err) => {
            var dir = new CommandDirectory(cmdDir);
            files.forEach(function (file, i) {
                var m = /([a-zA-Z0-9]+)\.js[x]*$/.exec(file);
                m && m[1] && dir.addCommand(m[1], file);
            });
            if (dir.commands.length > 0) {
                var path = cmdDir.slice(0, cmdDir.length - 1);
                this.directories[path] = dir;
            }
        });
        return this;
    }

    resolve(cmdName, searchPath) {
        var dirs = this.directories;
        searchPath = searchPath instanceof Array ? searchPath : this.directoryNames;
        for (var i = 0; i < searchPath.length; i++) {
            var dir = dirs[searchPath[i]];
            if (dir) {
                var cmd = dir.getCommand(cmdName);
                if (cmd) {
                    var path = dir.directory + '/' + cmd[0];
                    return efuns.loadObject(path);
                }
            }
        }
        return false;
    }
}

MUD.export(CommandResolver);
