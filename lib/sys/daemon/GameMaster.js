/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    PERM_NONE = 0,
    PERM_READ = 1,
    PERM_WRITE = 1 << 1,
    PERM_LOAD = 1 << 2,
    PERM_DEST = 1 << 3;

const
    AclValues = {
        ALL: 1 | 1 << 1 | 1 << 2 | 1 << 3 | 1 << 4 | 1 << 5 | 1 << 6 | 1 << 9 | 1 << 10,
        NONE: 0,
        READ: 1,
        WRITE: 1 << 1,
        DELETE: 1 << 2,
        CREATE: 1 << 3,
        LOAD: 1 << 4,
        CLONE: 1 << 4,
        UNLOAD: 1 << 5,
        DEST: 1 << 5,
        GRANT: 1 << 6 | 1 << 9,
        NOLOAD: 1 << 7,
        NOINHERIT: 1 << 8,
        GETPERMS: 1 << 9,
        LISTDIR: 1 << 10,
        LIST: 1 << 10
    };

var _access = {},
    _driver = null,
    _groups = {},
    _perms = null,
    _accessFile = null,
    _groupsFile = null,
    _permsCache = {},
    _permsFile = null,
    _resolver = null,
    _aclDefs = {},
    _aclSort = [];

class GameMaster extends MUDObject {
    constructor() {
        super();
        let config = efuns.readConfig('mudlib.master.parameters');

        _accessFile = config.accessFile;
        _groupsFile = config.groupsFile;
        _permsFile = config.permissionsFile;

        function parsePermissions(data) {
            var _result = {};
            Object.keys(data).forEach((key, i) => {
                var cur = _result;
                key.split('/').forEach((dir, j, arr) => {
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

        let accessIn = efuns.readJsonFile(_accessFile);
        Object.keys(accessIn).forEach(a => {
            let e = _access[a] = {};
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

        //ctx.$storage.on('kmud', evt => {
        //    switch (evt.eventType) {
        //        case 'runOnce':
        //            evt.eventData.forEach(cmd => {
        //                switch (cmd.eventType) {
        //                    case 'createAdmin':
        //                        let playerDaemon = efuns.loadObject('/sys/daemon/PlayerDaemon')
        //                        if (playerDaemon)
        //                            playerDaemon().createAdmin(cmd);
        //                        break;
        //                }
        //            });
        //            break;
        //    }
        //});

        efuns.log('startup', `${efuns.mudName()} started at ${(new Date().toUTCString())}`);
    }

    addToGroup(group, name) {
        let prev = efuns.previousObject();
        if (typeof _groups[group] === 'object') {
            _groups[group][name] = true;
            return true;
        }
        return false;
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
     * @param {string} path The virtual path to compile.
     * @returns {MUDObject|false} The compiled object.
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
     * Called when a new player connection is made to the mud.
     * @param {number} port
     */
    connect(port) {
        try {
            return efuns.cloneObject('/sys/lib/Login');
        }
        catch (err) {
            efuns.writeFile('/log/errors/sys', err.message);
        }
        return false;
    }

    loadAclData(data) {
        if (efuns.gameState() < 3) {
            _aclDefs = data;
            _aclSort = Object.keys(_aclDefs)
                .sort((a, b) => a.length > b.length ? -1 : 1)
                .map(s => {
                    return {
                        path: s,
                        regex: s.indexOf('(') === -1 ? false : new RegExp(s)
                    };
                });
        }
    }

    /**
     * 
     * @param {string} id
     * @param {string} p
     * @param {string[]} match
     */
    createAclString(id, p, match) {
        if (match) {
            id = id.replace('$1', match[1]);
        }
        let access = 0;
        p.split(/\s+/).forEach(w => access |= AclValues[w.toUpperCase()]);
        return [id, access];
    }

    /**
     * 
     * @param {any} filename
     */
    createPermissions(filename) {
        
        for (let i = 0, max = _aclSort.length; i < max; i++) {
            let item = _aclSort[i];

            if (!item.regex) {
                if (filename.startsWith(item.path)) {
                    let result = {},
                        perms = _aclDefs[item.path];
                    Object.keys(perms).forEach(id => {
                        let [finalId, perm] = this.createAclString(id, perms[id], null);
                        result[finalId] = perm;
                    });
                    return result;
                }
            }
            else {
                let match = item.regex.exec(filename);
                if (match) {
                    let result = {},
                        perms = _aclDefs[item.path];
                    Object.keys(perms).forEach(id => {
                        let [finalId, perm] = this.createAclString(id, perms[id], match);
                        result[finalId] = perm;
                    });
                    return result;
                }
            }
        }
    }

    domainFile(filename) {
        let parts = filename.split('/');
        if (parts[1] === 'world') {
            return parts[2];
        }
        return false;
    }

    /**
     * MudOS COMPAT
     * @returns {string[]} A list of files to preload.
     */
    epilog() {
        /**
         *  @type {string[]}
         */
        let preloads = efuns.readJsonFile('/sys/etc/preloads.json');
        if (efuns.featureEnabled('intermud3')) {
            preloads.push('/daemon/I3Router');
            preloads.push('/daemon/I3Daemon');
        }
        return preloads;
    }

    /**
     * MudOS COMPAT
     * @param {any} error
     * @param {any} caught
     */
    errorHandler(error, caught) {
        efuns.write('You encountered an error:');
        if (efuns.wizardp(thisPlayer)) {
            efuns.write(error.error);
            efuns.write(error.stack);
        }
    }

    getAccess(caller, path) {
        let ap = this.getPermissions(caller),
            p = path.split('/'),
            l = p.length;
        if (ap.indexOf('SYSTEM') > -1)
            return PERM_READ | PERM_WRITE | PERM_LOAD;
        else if (p[1] === 'realms' && ap.indexOf(p[2]) > -1)
            return PERM_READ | PERM_WRITE | PERM_LOAD;
        while (l) {
            let c = '/' + p.slice(1).join('/'),
                a = _access[c];
            if (a) { 
                let perms = a['*'] || PERM_NONE,
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

    getGroups() {
        return _groups;
    }

    getPermissions(arg) {
        let filename = unwrap(arg, o => o.filename) || (arg.filename || arg.fileName);
        if (filename in _permsCache) return _permsCache[filename];
        let ptr = _perms,
            tokens = [],
            result = [],
            fn = filename;
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
        return _permsCache[filename] = result;
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
     * Determine whether the specified value is a wizard.
     * @param {any} target
     * @returns {boolean} True if the target is a wizard.
     */
    isWizard(target) {
        return unwrap(target, player => player.filename.startsWith('/v/sys/data/creators'));
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
            logger.log(x);
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

    validRequire(caller, moduleName) {

    }

    validShutdown(caller) {
        return true;
    }

    validWrite(path, caller, func) {
        return this.getAccess(caller, this.normalizePath(path)) & PERM_WRITE;
    }
}

efuns.exports = new GameMaster();
