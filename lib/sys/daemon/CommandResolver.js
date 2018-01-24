const
    _commands = '_commands',
    _directory = '_directory',
    _directories =  '_directories',
    _path = '_path';

class CommandDirectory {
    constructor(dir) {
        this.commands = { length: 0 };
        this.directory = dir;
    }

    addCommand(cmd, withExt) {
        this.commands[cmd.toLowerCase()] = [cmd, withExt];
        this.commands.length++;
        return this;
    }

    getCommand(cmd) {
        return this.commands[cmd];
    }
}

class CommandResolver extends MUDObject {
    /**
        *
        * @param {MUDCreationContext} ctx
        */
    constructor(ctx) {
        super(ctx.prop(_directories, {}));
        this.defaultSearchPath = [
            '/cmds/items/',
            '/cmds/player/',
            '/cmds/common/'
        ];
    }

    create() {
        this.setProperty(_directories, {});
        this
            .hashCommandDirectory('/cmds/admin')
            .hashCommandDirectory('/cmds/common')
            .hashCommandDirectory('/cmds/items')
            .hashCommandDirectory('/cmds/creator')
            .hashCommandDirectory('/cmds/player')
            .hashCommandDirectory('/sys/cmds/admin')
            .hashCommandDirectory('/sys/cmds/arch')
            .hashCommandDirectory('/sys/cmds/creator')
            .hashCommandDirectory('/sys/cmds/player');
    }

    /**
        * @returns {CommandDirectory[]} Returns all hashed directories.
        */
    get directories() {
        return this.getProperty(_directories);
    }

    get directoryNames() {
        return Object.keys(this.directories);
    }
    /**
        * Scan a directory and index commands.
        * @param {string} dir The directory scan for commands.
        */
    hashCommandDirectory(cmdDir) {
        let self = this,
            dirPath = cmdDir,
            dirs = this.directories;

        if (!dirPath.endsWith('/')) dirPath += '/';
        if (cmdDir.endsWith('/')) cmdDir = cmdDir.slice(0, cmdDir.length - 1);

        efuns.getDir(dirPath, (files, err) => {
            if (Array.isArray(files)) {
                let dir = new CommandDirectory(cmdDir);
                files.forEach((file, i) => {
                    let m = /([a-zA-Z0-9]+)\.js[x]*$/.exec(file);
                    m && m[1] && dir.addCommand(m[1], file);
                });
                if (dir.commands.length > 0) {
                    dirs[cmdDir] = dir;
                }
            }
            else throw err;
        });
        return this;
    }

    resolve(cmdName, searchPath) {
        let dirs = this.directories;
        searchPath = Array.isArray(searchPath) ? searchPath.slice(0) : this.defaultSearchPath;
        for (let i = 0; i < searchPath.length; i++) {
            let dir = dirs[searchPath[i]];
            if (dir) {
                var cmd = dir.getCommand(cmdName);
                if (cmd) {
                    var path = `${dir.directory}/${cmd[0]}`;
                    return efuns.loadObject(path);
                }
            }
        }
        return false;
    }
}

MUD.export(CommandResolver);
