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
    PERM_DEST = 1 << 3,
    Base = require('Base'),
    Daemon = require('Daemon');

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

function parsePermissions(data) {
    var _result = {};
    Object.keys(data).forEach(key => {
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

class PermissionGroup {
    protected constructor(name) {
        this.name = name;
    }

    get name() {
        return get('GroupName');
    }

    protected set name(value) {
        if (typeof value === 'string')
            set(value);
    }
}

class GameMaster extends MUDObject {
    constructor() {
        super();
        let config = efuns.readConfig('mudlib.master.parameters');

        _accessFile = config.accessFile;
        _groupsFile = config.groupsFile;
        _permsFile = config.permissionsFile;

        let accessIn = efuns.readJsonFileSync(_accessFile);
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

        let groupsIn = efuns.readJsonFileSync(_groupsFile);
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
        _perms = parsePermissions(efuns.readJsonFileSync(_permsFile));
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
    private compileVirtualObject(path, args) {
        if (path.startsWith('/sys/data/players/')) {
            let player = new Base.Player(path);
            player.loadPlayer(path);
            return player;
        }
        if (path.startsWith('/sys/data/creators/')) {
            let creator = new Base.Creator(path);
            creator.loadCreator(path);
            return creator;
        }
        return false;
    }

    /**
     * Called when a new player connection is made to the mud.
     * @param {number} port
     * @param {string} type
     * @param {false|{ username: string, password: string}} auth
     */
    connect(port, type, auth = false) {
        try {
            if (auth !== false) {
                let PlayerDaemon = efuns.reloadObjectSync(Daemon.Player);
                return PlayerDaemon().loadPlayer(auth.username, auth, player => {
                    if (player && player().password === auth.password) {
                        console.log(`Loaded ${player().keyId}`);
                        return [player, player().connect(port, type)];
                    }
                });
            }
            else {
                if (type === 'text')
                    return efuns.cloneObject('/sys/lib/TextLogin');
                else
                    return efuns.cloneObject('/sys/lib/HtmlLogin');
            }
        }
        catch (err) {
            efuns.writeFile('/log/errors/sys', err.message);
        }
        return false;
    }

    convertUnits(units, unitType) {
        units = parseFloat(units);

        if (!unitType)
            return units;

        if (unitType.endsWith('s'))
            unitType = unitType.slice(0, -1);

        switch (unitType.toLowerCase()) {
            case 'cm':
            case 'centemetre':
            case 'centemeter':
                return units * 0.01;

            case 'dkm': 
            case 'decametre':
                return units * 10;

            /* distance -- convert to meters */
            case 'ft':
            case 'feet':
                return units * 0.3048;

            case 'km':
            case 'kilometer':
                return units * 1000;

            case 'm':
                return units * 1.0;

            case 'mile': 
                return units * 1609.34;

            case 'mm':
                return units * 0.001;

            /* weights and masses - standard unit is grams */
            case 'kg':
            case 'kilogram':
            case 'kilo':
                return units * 1000;

            case 'grams': case 'g':
                return units;

            case 'mg':
            case 'miligram':
                return units * (1.0 / 1000);

            case 'ounce':
            case 'oz':
                return units * 28.3495;

            case 'pound':
            case 'lb':
                return units * 453.592;

            case 'stone':
                return units * 6350.28800006585;
                break;

            case 'ton':
                return units * 907184.000009408;

            /* temperatures - standard unit is kelvin */
            case 'fahrenheit':
            case 'f':
                return Math.max(0, (units - 32) * (5.0 / 9.0) + 273.15);

            case 'c':
                return Math.max(0, units + 273.15);

            case 'k':
                return Math.max(0, units);

        }
        return units;
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
        let preloads = efuns.readJsonFileSync('/sys/etc/preloads.json');
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
        let filename = unwrap(arg, o => o.filename) || (arg.filename || arg.fileName || arg);
        if (filename in _permsCache) return _permsCache[filename];
        let ptr = _perms,
            tokens = [],
            result = [],
            fn = filename;
        fn.split('/').forEach((dir, i, arr) => {
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
            name = o ? o.keyId : target;
            var gc = g.filter(gn => gn in _groups && _groups[gn][name] === true);
            return gc.length > 0;
        }
        return false;
    }

    /**
     * Determine whether the specified value is a wizard.
     * @param {any} target
     * @returns {boolean} True if the target is a wizard.
     */
    isWizard(target) {
        return unwrap(target, player => player.filename.startsWith('/sys/data/creators'));
    }

    /**
     * 
     * @param {string} file
     * @param {Error} error
     */
    private logError(file, error) {
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
            efuns.writeFile(filePath,
                `\n[${new Date().toLocaleString()}]\n${error.message}\n${error.stack}\n`);
        }
        catch (x) {
            logger.log(x);
        }
    }

    /**
     * Register an external server
     * @param {{ address: string, port: number, protocol: string, server: any }} spec Information about the server that is starting.
     */
    protected registerServer(spec) {
        let { protocol, server } = spec;

        switch (protocol) {
            case 'http':
                server
                    .setContentRoot('/wwwroot')
                    .addIndexFile('index.html', 'index.htm', 'index.mhtml')
                    .withRoutes(routeTable => {
                        routeTable
                            .addControllerPath(
                                '/wwwroot/controller')
                            .addViewPath(
                                '/wwwroot/views',
                                '/wwwroot/views/shared')
                            .addRoute({
                                url: '{controller}/{action}/{id}',
                                defaults: { controller: 'Home', action: 'Index', id: 0 }
                            });
                    });
                break;
        }
    }

    /**
     * Determines whether the caller can destroy the specified object.
     * @param {EFUNProxy} caller The calling object.
     * @param {string} path The path of the object to destruct.
     * @returns {boolean} True if the object can be destructed or false if not.
     */
    validDestruct(caller, path) {
        try {
            let result = this.getAccess(caller, typeof path === 'string' ? path : path.filename) & PERM_DEST;
            return result;
        }
        catch (e) {
            console.log('Error in validDestruct', e);
        }
        return false;
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
        return this.getAccess(caller, path) & PERM_READ;
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
        return this.getAccess(caller, path) & PERM_WRITE;
    }
}

efuns.exports = new GameMaster();
