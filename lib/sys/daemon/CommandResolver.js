MUD.include('Daemon');

const
    _commands = '_commands',
    _directory = '_directory',
    _directories =  '_directories',
    _path = '_path';

class CommandEntry {
    /**
     * 
     * @param {string} cmd
     * @param {string} withExt
     * @param {MUDObject} bin
     */
    constructor(cmd, withExt, bin) {
        this.cmd = cmd;
        this.withExt = withExt;
        this.bin = bin;
    }
}

class CommandDirectory {
    constructor(dir) {
        this.commands = { length: 0 };
        this.directory = dir;
    }

    addCommand(cmd, withExt, bin) {
        this.commands[cmd] = { cmd, withExt, bin };
        this.commands.length++;
        return this;
    }

    /**
     * 
     * @param {string} cmd
     * @returns {CommandEntry}
     */
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
        this.HelpDaemon = efuns.loadObject(DAEMON_HELP);
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
        * @returns {Object.<string,CommandDirectory>} Returns all hashed directories.
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
            dirs = this.directories,
            hd = this.HelpDaemon();

        if (!dirPath.endsWith('/'))
            dirPath += '/';
        if (cmdDir.endsWith('/'))
            cmdDir = cmdDir.slice(0, cmdDir.length - 1);

        efuns.getDir(dirPath, (files, err) => {
            if (Array.isArray(files)) {
                let dir = new CommandDirectory(cmdDir);

                files.forEach((file, i) => {
                    let m = /([a-zA-Z0-9]+)\.js[x]*$/.exec(file);
                    if (m && m[1]) {
                        let verb = m[1].toLowerCase();
                        try {
                            let cmd = unwrap(efuns.loadObject(`${dirPath}/${m[1]}`));
                            hd.addCommand(cmd, verb);
                            dir.addCommand(verb, file, cmd);
                        }
                        catch (e) {
                            logger.log(e.message);
                        }
                    }
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
                var entry = dir.getCommand(cmdName);
                if (entry) {
                    if (typeof entry.bin === 'object')
                        return entry.bin;
                    let path = `${dir.directory}/${entry[0]}`;
                    return (entry.bin = efuns.loadObject(path));
                }
            }
        }
        return false;
    }

    updateCommand(cmd) {
        unwrap(cmd, o => {
            let path = o.filename.split('/'),
                file = path.pop(),
                dir = path.join('/'),
                dirs = this.directories;
            if (dir in dirs) {
                let cmddir = dirs[dir],
                    cmd = cmddir.getCommand(file.toLowerCase());
                cmd.bin = o;
            }
            this.HelpDaemon().addCommand(o, file.toLowerCase());
        });
    }
}

MUD.export(CommandResolver);
