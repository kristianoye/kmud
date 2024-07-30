/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { PLAYER_D } from '@Daemon';
import { LIB_PLAYER, LIB_CREATOR } from '@Base';

export default singleton class GameMaster extends MUDObject {
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
    private async compileVirtualObject(path, args) {
        if (path.startsWith('/sys/data/players/')) {
            let player = await createAsync(LIB_PLAYER);
            await player.loadPlayer(path);
            return player;
        }
        if (path.startsWith('/sys/data/creators/')) {
            let creator = await createAsync(LIB_CREATOR);
            await creator.loadPlayer(path);
            logger.log(`Creator ${creator.name} loaded.`);
            return creator;
        }
        return false;
    }

    /**
     * Called when a new player connection is made to the mud.
     * @param {number} port The port the client connected to
     * @param {string} type The protocol type the client is using
     * @param {false|{ username: string, password: string}} auth Authentication info provided by client
     */
    private async connect(port, type, auth = false) {
        try {
            if (auth !== false) {
                let PlayerDaemon = await efuns.reloadObjectAsync(PLAYER_D);
                return PlayerDaemon().loadPlayer(auth.username, auth, player => {
                    if (player && player().password === auth.password) {
                        console.log(`Loaded ${player().keyId}`);
                        return [player, player().connect(port, type)];
                    }
                });
            }
            else {
                if (type === 'text')
                    return await efuns.cloneObjectAsync('/sys/lib/TextLogin.js');
                else if (type === 'http' || type === 'https')
                    return await efuns.cloneObjectAsync('/sys/lib/HtmlLogin.jsx');
                else
                    throw new Error(`Login not available for client type '${type}'`);
            }
        }
        catch (err) {
            await efuns.fs.appendFileAsync('/log/errors/sys', err.message);
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

    /**
     * Create ACL data for the specified path.
     * @param {string} expr The path expression
     */
    createPermissions(expr) {
        let parts = expr.split('/');

        for (let i = 0; i < parts.length; i++) {
            let foo = parts.slice(0, i).join('/');
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
    private async epilog() {
        /**
         *  @type {string[]}
         */
        let preloads = await efuns.fs.readJsonAsync('/sys/etc/preloads.json');
        if (efuns.featureEnabled('intermud3')) {
            preloads.push('/daemon/I3Router.js');
            preloads.push('/daemon/I3Daemon.js');
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

    /**
     * Driver apply to determine user's home directory.
     * @param {MUDObject | string} user
     */
    getHomePath(user) {
        if (typeof user === 'string')
            return `/realms/${user.toLowerCase()}`;
        else if (typeof user === 'function' || typeof user === 'object') {
            if (efuns.living.isWizard(user.instance))
                return `/realms/${user.instance.name}`;
        }
    }

    /**
     * Check to see if the target is an administrator
     * @param {string | MUDObject} target
     */
    isAdmin(target) {
        if (typeof target === 'string')
            return efuns.security.isGroupMember(`creators\\${target.toLowerCase()}`, "$ADMIN");
        else if (typeof target === 'object')
            return efuns.security.isGroupMember(`creators\\${u.instance.name}`, "$ADMIN");
        else
            return false;
    }

    isArch(target) {
        if (this.isAdmin(target))
            return true;
        if (typeof target === 'string')
            return efuns.security.isGroupMember(`creators\\${target.toLowerCase()}`, "$ASSIST");
        else if (typeof target === 'object')
            return efuns.security.isGroupMember(`creators\\${u.instance.name}`, "$ASSIST");
        else
            return false;
    }

    /**
     * Determine whether the specified value is a wizard.
     * @param {any} player
     * @returns {boolean} True if the target is a wizard.
     */
    isWizard(player) {
        return (player.filename ?? '').startsWith('/sys/data/creators');
    }

    /**
     * Log an error message
     * @param {string} file The file in which the error occurred
     * @param {Error} error The error that occurred
     */
    private async logError(file, error) {
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
            let dt = new Date();

            if (error.constructor.name === 'CompositeError') {
                await efuns.log(filePath, `\n[${dt.toLocaleString()}]\nComposite Error: ${error.message}`);
                for (const err of error.getItems()) {
                    if (err.constructor.name === 'SyntaxError') {
                        await efuns.log(filePath, `\tSyntax Error: ${err.message}`);
                    }
                    else if (err.constructor.name === 'SyntaxWarning') {
                        await efuns.log(filePath, `\tWarning: ${err.message}`);
                    }
                    else {
                        await efuns.log(filePath, `\n[${dt.toLocaleString()}]\n${err.message}\n${err.stack}`);
                    }
                }
            }
            else {
                await efuns.fs.appendFileAsync(filePath,
                    `\n[${dt.toLocaleString()}]\n${error.message}\n${error.stack}\n`);
            }
        }
        catch (x) {
            logger.log(x);
        }
    }

    /**
     * Create an initial ACL for the specified directory
     * @param {string} directoryName
     */
    protected async aclCreateDefault(directoryName) {
        let parts = directoryName.split('/').filter(s => s.length > 0);

        if (parts.length > 1) {
            switch (parts[0]) {
                case 'realms':
                    return {
                        directory: directoryName,
                        description: 'Home directory for ' + parts[1],
                        inherits: false,
                        permissions: [
                            {
                                //  Creator  has full control
                                [`creators\\${parts[1].toLowerCase()}`]: 'FULL',

                                //  Creator objects also have full control
                                [`realms\\${parts[1].toLowerCase()}`]: 'FULL',
                                "$ALL": "NONE"
                            }
                        ]
                    };

                case 'world':
                    return {
                        directory: directoryName,
                        description: `Directory for ${parts[1]} domain`,
                        inherits: false,
                        permissions: [
                            {
                                [`world\\${parts[1].toLowerCase()}`]: 'FULL',
                                "$ALL": "R"
                            }
                        ]
                    };
            }
        }

        return {
            directory: directoryName,
            description: `Directory ${directoryName}`,
            inherits: true,
            permissions: {}
        };
    }

    /**
     * Determines what privs a particular file/object
     * @param {string} filename The file needing a list of privs
     * @returns {string} The list of privs the object should receive
     */
    protected aclGetCredential(filename) {
        let userTest = /\/sys\/data\/(?<userType>players|creators)\/[a-z]{1}\/(?<username>[a-z0-9]+)/,
            userMatch = userTest.exec(filename);

        if (userMatch != null) {
            return {
                IsUser: true,
                IsWizard: userMatch.groups['userType'] === 'creators',
                UserId: userMatch.groups['userType'] + '\\' + userMatch.groups['username']
            };
        }
        let pathParts = filename.split('/').filter(s => s.length > 0);
        switch (pathParts[0]) {
            case 'base':
                return { UserId: 'mudlib\\base' };
            case 'cmds':
                return { UserId: 'mudlib\\cmds' };
            case 'daemon':
                return { UserId: 'mudlib\\daemon' };
            case 'realms':
                if (pathParts.length > 2) {
                    return { UserId: 'realms\\' + pathParts[1].toLowerCase() };
                }
                return { UserId: 'realms' };
            case 'sys':
                return { UserId: 'mudlib\\system' };
            case 'world':
                if (pathParts.length > 2) {
                    return { UserId: 'world\\' + pathParts[1].toUpperCase() };
                }
                return { UserId: 'world' };
            case 'wwwroot':
                return { UserId: 'mudlib\\www' };
            default:
                return { UserId: 'unknown' };
        }
    }

    /**
     * Create a group prefix based on the name of an external group file
     * @param {string} filename
     */
    protected aclGetExternalGroupPrefix(filename) {
        let parts = filename.split('/').filter(s => s.length > 0);

        if (parts.length > 3) {
            if (parts[0] === 'realms')
                return '$REALMS\\' + parts[1].toLowerCase();
            else if (parts[0] === 'world') {
                return '$WORLD\\' + parts[1].toLowerCase();
            }
        }
        return false;
    }

    /**
     * Get the default 'owner' of a file
     * @param {string} filename The name of the file to determine ownership of
     * @param {boolean} isDirectory
     * @returns {string} Returns the owning user ID
     */
    protected getFileOwner(filename, isDirectory) {
        let userTest = /\/sys\/data\/(?<userType>players|creators)\/[a-z]{1}\/(?<username>[a-z0-9]+)/,
            userMatch = userTest.exec(filename);

        if (userMatch != null) {
            return userMatch.groups['userType'] + '\\' + userMatch.groups['username'];
        }
        let pathParts = filename.split('/').filter(s => s.length > 0);
        switch (pathParts[0]) {
            case 'base':
                return 'mudlib\\base';

            case 'cmds':
                return 'mudlib\\cmds';

            case 'daemon':
                return 'mudlib\\daemon';

            case 'realms':
                if (pathParts.length > 2) {
                    return 'creators\\' + pathParts[1].toLowerCase();
                }
                else if (isDirectory === true) {
                    return 'creators\\' + pathParts[1].toLowerCase();
                }
                return 'mudlib\\realms';

            case 'sys':
                return 'mudlib\\system';

            case 'world':
                if (pathParts.length > 2) {
                    return 'world\\' + pathParts[1].toLowerCase();
                }
                return 'mudlib\\world';

            case 'wwwroot':
                return 'mudlib\\www';

            default:
                return 'mudlib';
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

    private async startup() {
    }

    async userExists(username, isWizardCheck, returnFiles=false) {
        let filesToCheck = [],
            fileResults = [],
            exists = false;
        username = efuns.normalizeName(username);

        if (isWizardCheck === true) {
            filesToCheck.push(`/sys/data/creators/${username.charAt(0)}/${username}.json`);
        }
        else if (isWizardCheck === false) {
            filesToCheck.push(`/sys/data/players/${username.charAt(0)}/${username}.json`);
        }
        else {
            filesToCheck.push(`/sys/data/creators/${username.charAt(0)}/${username}.json`);
            filesToCheck.push(`/sys/data/players/${username.charAt(0)}/${username}.json`);
        }
        for (const file of filesToCheck) {
            let saveFile = await efuns.fs.getObjectAsync(file);
            exists |= saveFile.isFile;

            if (returnFiles === true && saveFile.isFile)
                fileResults.push(saveFile);
        }
        return returnFiles && fileResults.length ? fileResults : exists;
    }

    /**
     * Determines whether the caller can destroy the specified object.
     * @param {EFUNProxy} caller The calling object.
     * @param {string} path The path of the object to destruct.
     * @returns {boolean} True if the object can be destructed or false if not.
     */
    validDestruct(caller, path) {
        try {
            let result = true;
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
     * @param {string} expr The path to read
     * @returns {boolean} True if access is granted or false if not.
     */
    async validRead(expr, caller, func) {
        if (typeof caller === 'object') {
            caller = efuns.parsePath(caller.filename).file;
        }
        if (expr.startsWith(caller)) {
            return true;
        }
        return true;
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

    validSecurityGroupChange(caller, method, group) {
        if (!group)
            return false;

        let tp = efuns.thisPlayer(true),
            isAdmin = tp && efuns.adminp(tp),
            isArch = tp && isAdmin || efuns.archp(tp),
            [domain, groupId] = group.id.slice(1).split('\\');

        if (efuns.isForced())
            return false;

        // Only admins can alter system groups
        if (group.id.charAt(0) === '$') {
            if (!isAdmin)
                return false;
        }
        // Only arch+ can alter domain groups
        else if (group.id.charAt(0) === '^') {
            if (!isArch)
                return false;
        }
        else if (group.id.charAt(0) === '~') {
            if (domain.toLowerCase() !== tp.keyId && !isArch)
                return false;
        }
        else
            return false;

        switch (method) {
            //  Members cannot be removed from ALL group
            case 'removeGroupMembers':
                return group.id !== '$ALL';

            case 'addGroupMembers':
            case 'createSecurityGroup':
                return true;

            case 'deleteSecurityGroup':
                //  Groups that cannot be deleted
                return ['$ADMIN', '$ASSIST', '$ALL'].indexOf(group.id) === -1;
        }
        return false;
    }

    /**
     * Should the caller be allowed to shut down the game server?
     * @param {any} caller
     */
    validShutdown(caller) {
        return true;
    }

    async validWrite(path, caller, func) {
        return true;
    }
}
