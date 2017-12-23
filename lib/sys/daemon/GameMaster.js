const
    PERM_NONE = 0,
    PERM_READ = 1,
    PERM_WRITE = 1 << 1,
    PERM_LOAD = 1 << 2,
    PERM_DEST = 1 << 3;

var _access = {},
    _driver = null,
    _groups = {},
    _perms = null,
    _accessFile = null,
    _groupsFile = null,
    _permsFile = null,
    _resolver = null;

MUD.isSingleton(true);
MUD.allowProxy = false;

class GameMaster extends MUDObject {
    /**
        * @param {MUDCreationContext} ctx
        */
    constructor(ctx) {
        super(ctx);
        console.log('GameMaster constuctor called');
        if (!ctx.isReload) {
            _accessFile = ctx.takeArg('accessFile');
            _groupsFile = ctx.takeArg('groupsFile');
            _permsFile = ctx.takeArg('permissionsFile');
            _resolver = ctx.takeArg('resolver');
        }

        function parsePermissions(data) {
            var _result = {};
            Object.keys(data).forEach(function (key, i) {
                var cur = _result;
                key.split('/').forEach(function (dir, j, arr) {
                    if (dir.length) {
                        cur = cur[dir] = (cur[dir] || {});
                    }
                    if (dir === '__g')
                        throw new Error('Illegal directory name');
                    if ((j + 1) === arr.length) {
                        cur['__g'] = data[key];
                    }
                });
            });
            return _result;
        }

        var accessIn = efuns.readJsonFile(_accessFile);
        Object.keys(accessIn).forEach(a => {
            var e = _access[a] = {};
            Object.keys(accessIn[a]).forEach(g => {
                var p = accessIn[a][g], r = PERM_NONE;
                if (p.indexOf('r') > -1) r |= PERM_READ;
                if (p.indexOf('w') > -1) r |= PERM_WRITE;
                if (p.indexOf('l') > -1) r |= PERM_LOAD;
                if (p.indexOf('d') > -1) r |= PERM_DEST;
                e[g] = r;
            });
        });

        var groupsIn = efuns.readJsonFile(_groupsFile);
        Object.keys(groupsIn).forEach(g => {
            _groups[g] = {};
            groupsIn[g].forEach(n => {
                if (n.charAt(0) === '$') {
                    if (!_groups[n]) throw new Error('No such permission group: ' + n);
                    Object.keys(_groups[n]).forEach(gm => _groups[g][gm] = true);
                }
                else
                    _groups[g][n] = true;
            });
        });
        _perms = parsePermissions(efuns.readJsonFile(_permsFile));

        ctx.$storage.on('kmud', evt => {
            switch (evt.eventType) {
                case 'runOnce':
                    evt.eventData.forEach(cmd => {
                        switch (cmd.eventType) {
                            case 'createAdmin':
                                efuns.loadObject('/sys/daemon/PlayerDaemon')
                                    .createPlayer(cmd);
                                break;
                        }
                    });
                    break;
            }
        });
    }

    authorFile(filename) {
        let parts = filename.split('/');
        if (parts[1] === 'realms') {
            return parts[2];
        }
        return false;
    }

    /**
        * Called when a virtual object is compiled in order to determine
        * how that object should be created.

        * @param {any} path
        */
    compileVirtualObject(path) {
        if (path.startsWith('/v/sys/data/players/')) {
            return {
                baseName: '/base/Player',
                singleton: true
            };
        }
        if (path.startsWith('/v/sys/data/creators/')) {
            return {
                baseName: '/base/Creator',
                singleton: true
            };
        }
        return false;
    }

    /**
     * MudOS COMPAT
     */
    epilog() {
        return efuns.readJsonFile('/sys/etc/preloads.json');
    }

    /**
     * MudOS COMPAT
     * @param {any} error
     * @param {any} caught
     */
    errorHandler(error, caught) {
        if (efuns.wizardp(MUDData.ThisPlayer)) {
            efuns.write('You encountered an error:');
            efuns.write(error.message);
            efuns.write(error.stack);
        }
    }

    getAccess(caller, path) {
        var ap = caller.permissions,
            p = path.split('/'),
            l = p.length;
        while (l) {
            var c = '/' + p.slice(1).join('/'),
                a = _access[c];
            if (a) { 
                var perms = a['*'] || PERM_NONE,
                    ep = ap.map(_ => perms |= (a[_] || PERM_NONE));
                return perms;
            }
            p.pop();
            l--;
        }
        return PERM_NONE;
    }

    getAccessText(caller, path) {
        var p = this.getAccess(caller, path), r = '';
        r += (p & PERM_READ) === PERM_READ ? 'r' : '-';
        r += (p & PERM_WRITE) === PERM_WRITE ? 'w' : '-';
        return r;
    }

    getPermissions(filename) {
        var ptr = _perms, tokens = [], result = [], fn = filename;
        fn.split('/').forEach(function (dir, i, arr) {

            if (ptr && dir.length > 0) {
                if (ptr["$char"]) {
                    if (!/[a-zA-Z0-9]{1}/.test(dir)) return;
                    tokens.push(dir);
                    ptr = ptr["$char"];
                }
                else if (ptr["$word"]) {
                    if (!/[a-zA-Z0-9_]+/.test(dir)) return;
                    tokens.push(dir);
                    ptr = ptr["$word"];
                }
                else {
                    ptr = ptr[dir] || false;
                }
                if (ptr && Array.isArray(ptr['__g'])) {
                    var np = ptr['__g'].map(function (s, n) {
                        return String.prototype.fs.apply(s, tokens) + '';
                    });
                    result.push(...np);
                }
            }
        });

        Object.keys(_groups).forEach(function (name, i) {
            /** @type {Array<String>} */
            var group = _groups[name];
            result.forEach((perm, j) => {
                if (group[perm] === true) result.push(name);
            });
        });
        return result;
    }

    /**
     * Determines whether the specified user permission is in one
     * of the specified group names.
     * @param {MUDObject|string} target The target user
     * @param {...string[]} group One or more groups to check.
     * @returns {boolean} True if the user is in at least one of the specified groups.
     */
    inGroup(target, group) {
        var o = unwrap(target), name,
            g = Array.isArray(group) ? group.map(gn => `$${gn}`) :
                [].slice.call(arguments, 1).map(gn => `$${gn}`);
        if (o || typeof target === 'string') {
            name = o ? o.name : target;
            var gc = g.filter(gn => gn in _groups && _groups[gn][name] === true);
            return gc.length > 0;
        }
        return false;
    }

    /**
        * Called to determine whether an object is considered 'virtual'
        * A virtual object has its own, unique in-game file path but the
        * source code is contained within a module of a different name.
        *
        * @param {any} path
        */
    isVirtualPath(path) {
        return path.startsWith('/v/');
    }

    /**
     * 
     * @param {string} file
     * @param {Error} error
     */
    logError(file, error) {
        let parts = file.split('/').filter(s => s.length),
            filePath;

        switch (parts[0]) {
            case 'realms':
                filePath = `/realms/${parts[1]}/errors`;
                break;
            case 'world':
                filePath = `/world/${parts[1]}/errors`;
                break;
            default:
                filePath = `/log/errors/${parts[0]}`;
                break;
        }
        try {
            efuns.writeFile(filePath, `\n[${new Date().toLocaleString()}]\n${error.message}\n${error.stack}\n`);
        }
        catch (x) {
            console.log(x);
        }
    }

    /**
     * 
     * @param {any} path
     */
    normalizePath(path) {
        return this.isVirtualPath(path) ? path.slice(2) : path;
    }

    /**
     * Determines whether the caller can destroy the specified object.
     * @param {EFUNProxy} caller The calling object.
     * @param {string} path The path of the object to destruct.
     * @returns {boolean} True if the object can be destructed or false if not.
     */
    validDestruct(caller, path) {
        return this.getAccess(caller, this.normalizePath(path)) & PERM_DEST;
    }

    /**
        * Returns true if the body switch should be allowed.
        * @param {any} perms
        * @param {MUDObject} oldBody
        * @param {MUDObject} newBody
        * @returns {boolean} True if the exec can take place false if not
        */
    validExec(perms, oldBody, newBody) {
        return true;
    }

    /**
     * Determines whether the calling context should have read access to the specified file.
     * @param {EFUNProxy} caller
     * @param {string} path The path to read
     * @returns {boolean} True if access is granted or false if not.
     */
    validRead(path, caller, func) {
        return this.getAccess(caller, this.normalizePath(path)) & PERM_READ;
    }

    validReadConfig(caller, key) {
        if (key.startsWith('driver.'))
            return false;
        else if (key.startsWith('mud.'))
            return true;

        else
            return true;
    }

    validShutdown(caller) {
        return true;
    }

    /**
     * Determine whether the calling context should have write access to the specified file.
     * @param {EFUNProxy} caller
     * @param {string} path The path to write to
     * @returns {boolean} True if access is granted or false if not.
     */
    validWrite(path, caller, func) {
        return this.getAccess(caller, this.normalizePath(path)) & PERM_WRITE;
    }
}

MUD.export(GameMaster);
