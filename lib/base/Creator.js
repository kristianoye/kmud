include('Daemon', 'Base');

imports(LIB_PLAYER);

class Creator extends Player {
    /**
     * 
     * @param {MUDCreationContext} ctx
     */
    constructor(ctx) {
        super(ctx);

        function dispatchInput(input, fromHistory, callback) {

        }

        ctx.$storage.prependListener('kmud.input', evt => {
            console.log('Creator: ' + evt.command);
            evt.callback();
            return 1 << 20;
        });
    }

    connect(client) {
        super.connect(client);
        client.eventSend({
            eventType: 'kmud.enableWizard',
            eventData: this.displayName + '@' + efuns.mudName()
        });
        client.on('kmud', (data) => {
            switch (data.eventType) {
                case 'wizShell.edit':

                    break;

                case 'wizShell.getDir':
                    this.eventSend({
                        eventType: data.eventResponse,
                        eventData: ((dir) => {
                            return efuns.getDir(dir, 1).map(fd => {
                                var entry = {
                                    id: dir + fd[0] + (fd[1] === -2 ? '/' : ''),
                                    text: fd[0],
                                    children: fd[1] === -2
                                };
                                if (data.eventData.syncCwd) {
                                    this.workingDirectory = dir;
                                }
                                if (fd[1] > -1) {
                                    var n = fd[0].lastIndexOf('.') + 1,
                                        ext = n ? fd[0].slice(n) : false;

                                    switch (ext) {
                                        case 'css':
                                        case 'html':
                                        case 'js':
                                        case 'json':
                                        case 'ts':
                                        case 'txt':
                                            entry.icon = 'fs-ext-' + ext;
                                            break;

                                        case 'ico':
                                        case 'png':
                                        case 'jpg':
                                        case 'gif':
                                            entry.icon = 'fs-ext-image';
                                            break;

                                        default:
                                            entry.icon = 'fs-ext-unknown';
                                            break;
                                    }
                                }
                                return entry;
                            });
                        })(data.eventData.directory)
                    });
                    break;

                case 'wizShell.save':
                    try {
                        efuns.writeFile(data.eventData.filename, data.eventData.content);
                    }
                    catch (e) {

                    }
                    break;
            }
        });
        this.enableHeartbeat(true);
    }

    dispatchInput(input, fromHistory) {
        if (thisPlayer !== this) {
            console.log('Illegal force attempt');
            return;
        }
        return super.dispatchInput(input, fromHistory);
    }

    save(callback) {
        var PlayerDaemon = efuns.loadObject(DAEMON_PLAYER);
        PlayerDaemon().saveCreator(this, callback);
    }

    get directoryStack() {
        return this.getProperty('directoryStack') || ['/'];
    }

    displayStack() {
        var ds = this.directoryStack, s = [];
        for (var i = ds.length - 1; i > -1; i--) { s.push(ds[i]); }
        this.writeLine(s.join(' '));
        this.setProperty('directoryStack', ds);
    }

    executeShellCommand(cmd, args) {
        if (cmd === 'dirs') {
            this.displayStack();
            return true;
        }
        if (cmd === 'pushd') {
            var dir = args.pop(), ds = this.directoryStack, s = [];
            if (efuns.isDirectory(dir)) {
                ds[ds.length] = dir;
                this.displayStack();
            }
            else {
                this.writeLine('No such directory');
            }
            return true;
        }

        if (cmd === 'popd') {
            var ds = this.directoryStack, s = [];
            if (ds.length < 2) {
                this.writeLine('popd: directory stack empty');
                return -2;
            }
            ds.pop(), this.displayStack();
            return true;
        }

        if (cmd === 'pwd') {
            var ds = this.directoryStack, dir = ds.slice(0).pop();
            thisPlayer.writeLine(dir);
            return true;
        }
        return super.executeShellCommand(cmd, args);
    }

    get searchPath() {
        var sp = this['_searchPath'];

        if (typeof sp === 'undefined') {
            sp = super.searchPath;

            if (efuns.adminp(this)) {
                sp.push('/cmds/admin');
                sp.push('/sys/cmds/admin');
            }
            if (efuns.archp(this)) {
                sp.push('/cmds/arch');
                sp.push('/sys/cmds/arch');
            }
            sp.push('/cmds/creator');
            sp.push('/sys/cmds/creator');
            var personalDir = '/realms/{0}/cmds'.fs(this.primaryName);

            if (efuns.isDirectory(personalDir))
                sp.push(personalDir);

            this['_searchPath'] = sp;
        }
        return sp;
    }

    get workingDirectory() {
        var stack = this.directoryStack;
        return stack.length > 0 ? stack[stack.length - 1] : '/';
    }

    set workingDirectory(dir) {
        var stack = this.directoryStack;
        if (efuns.isDirectory(dir)) {
            stack[stack.length - 1] = dir;
            this.setProperty('directoryStack', stack);
        }
    }
}

MUD.export(Creator);
