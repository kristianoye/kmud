/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Module contains data storage for in-game objects.
 */
const
    ActionBinder = require('./ActionBinder'),
    events = require('events'),
    ClientComponent = require('./ClientComponent'),
    ClientCaps = require('./network/ClientCaps'),
    MUDStorageFlags = require('./MUDStorageFlags'),
    CommandShellOptions = require('./CommandShellOptions'),
    { ExecutionContext, CallOrigin } = require('./ExecutionContext'),
    maxCommandExecutionTime = driver.config.driver.maxCommandExecutionTime,
    defaultResetInterval = driver.config.mudlib.objectResetInterval;

/**
 * Storage for MUD Objects.  In-game objects do not hold their data directly.
 * The storage object provides public, protected, and private data as well as
 * a signal mechanism between the driver and the in-game object for important
 * events like heartbeats and connection status (to protect against fake calls)
 */
class MUDStorage extends events.EventEmitter {
    /**
     * Construct a storage object.
     * @param {MUDObject} owner The owner of the storage object.
     */
    constructor(owner, $credential) {
        super();

        this.canHeartbeat = true;
        this.component = false;
        this.clientCaps = ClientCaps.DefaultCaps;

        this.$credential = $credential;

        /** @type {MUDObject} The current environment */
        this.$environment = null;

        this.filename = typeof owner === 'object' ?
            owner.filename : typeof owner === 'string' && owner;

        this.flags = 0;

        /** 
         * A collection of objects contained within this object
         * @type {MUDObject[]}} 
         */
        this.$inventory = [];

        /** @type {number|false} */
        this.heartbeatIndex = false;
        this.interactiveIndex = false;
        this.livingIndex = false;
        this.playerIndex = false;
        this.wizardIndex = false;

        /** The time at which this object's client did something */
        this.lastActivity = 0;

        /** @type {number} */
        this.nextReset = 0;

        /** @type {Object.<string,any>} */
        this.properties = {};

        this.resetInterval = defaultResetInterval;
    }

    /** 
     * Get currently bound actions
     * @type {ActionBinder}
     */
    get actionBinder() {
        if (this.living) {
            if (!this.actions) {
                this.actions = new ActionBinder();
            }
            return this.actions;
        }
        return false;
    }

    async eventClientCaps(evt) {
        await ExecutionContext.withNewContext({ file: __filename, method: 'eventClientCaps', isAsync: true, callType: CallOrigin.Driver }, async ecc => {
            await ecc.withPlayerAsync(this, async player => {
                if (typeof player.setEnv !== 'function')
                    return;

                switch (evt.type) {
                    case 'terminalType':
                        player.setEnv(ecc.branch(), 'TERM', evt.data);
                        break;

                    case 'windowSize':
                        player.setEnv(ecc.branch(), { COLUMNS: evt.data.width, LINES: evt.data.height });
                        break;
                }
            });
        });
    }

    /**
     * Execute a command from the shell.
     * @param {ExecutionContext} ecc The current callstack
     * @param {ParsedCommand} clientCommand
     */
    async eventCommand(ecc, clientCommand) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'eventCommand', isAsync: true, callType: CallOrigin.Driver });
        try {
            let cmd = {
                verb: clientCommand.verb,
                args: clientCommand.args.map(a => a.hasOwnProperty('value') ? a.value : a),
                text: clientCommand.text,
                stdout: clientCommand.stdout || this.shell.console,
                stderr: clientCommand.stderr || this.shell.console,
                stdin: clientCommand.stdin || false,
                objin: clientCommand.objin || false,
                objout: clientCommand.objout || false,
                env: Object.assign({},
                    clientCommand.options.environment || {},
                    clientCommand.options.variables || {})
            };

            let originalContextSettings = ecc.changeSettings({ alarmTime: Number.MAX_SAFE_INTEGER /* efuns.ticks + maxCommandExecutionTime */ });
            let result = false;
            try {
                ecc.pushCommand(cmd);
                result = await this.owner.executeCommand(ecc, cmd);
                if (result !== true && this.actions) {

                    let actionResult = await this.actions.tryAction(cmd);
                    if (typeof actionResult === 'boolean' || typeof actionResult === 'string')
                        result = actionResult;
                }
                if (typeof result === 'string')
                    driver.efuns.errorLine(ecc, result);
                return result;
            }
            catch (err) {
                result = err;
            }
            finally {
                ecc.popCommand();
                ecc.changeSettings(originalContextSettings);
            }
            return result;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Destroys the object.
     * @param {ExecutionContext} ecc The current callstack
     */
    eventDestroy(ecc, ...args) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'eventDestroy', callType: CallOrigin.driver });
        try {
            if (!this.destroyed) {
                let filename = this.owner.trueName || this.owner.filename;

                let parts = efuns.parsePath(filename),
                    module = driver.cache.get(parts.file);

                this.heartbeat = false;

                if (this.component)
                    this.eventExec(ExecutionContext.startNewContext(), false, ...args);

                if (this.environment) {
                    let store = driver.storage.get(this.environment);
                    store && store.removeInventory(this.owner);
                }

                if (this.player) this.player = false;
                if (this.living) this.living = false;
                if (this.wizard) this.wizard = false;

                this.owner.removeAllListeners && this.owner.removeAllListeners();

                this.destroyed = true;

                if (this.shell) {
                    this.shell.destroy();
                    this.shell = undefined;
                }

                this.destroyed = module.destroyInstance(this.owner);
                if (typeof this.owner.eventDestroy === 'function') {
                    try {
                        this.owner.eventDestroy(frame.context);
                    }
                    catch (x) {

                    }
                }
                driver.storage.delete(this.owner);
                this.owner = false;

                return true;
            }
            return false;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Associate a component with this store and its related object.
     * @param {ExecutionContext} ecc The current callstack
     * @param {ClientComponent} component The client bound to this store and in-game object.
     */
    async eventExec(ecc, component, ...args) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'eventExec', isAsync: true, callType: CallOrigin.DriverEfun });
        try {
            if (component instanceof ClientComponent) {
                //  If the client has an old body, the client needs to be dissassociated with it
                if (component.body) {
                    let store = driver.storage.get(component.body);

                    if (store) {
                        await driver.driverCallAsync('disconnect', /** @param {ExecutionContext} context */ async context => {
                            await context.withPlayerAsync(store, async (player, ecc) => {
                                if (typeof store.clientCaps.off === 'function' && store.clientCapEventHandlerId) {
                                    store.clientCaps.off('kmud', store.clientCapEventHandlerId);
                                }
                                store.connected = false;
                                store.interactive = false;
                                store.connected = false;
                                store.lastActivity = 0;
                                store.shell = false;
                                await player.disconnect(context.branch());
                                store.component = false;
                                store.clientCaps = ClientCaps.DefaultCaps;
                            }, false);
                        });

                        component.shell.abortInputs();
                    }
                    else
                        return false;
                }

                this.connected = true;
                this.interactive = true;
                this.lastActivity = efuns.ticks;

                this.shell = component.shell;
                this.component = component;

                component.shell.playerRef = component.body = this.owner.wrapper;
                component.shell.storage = component.storage = this;

                ecc.setThisPlayer(this.owner.instance, true);

                this.clientCaps = component.caps || ClientCaps.DefaultCaps;

                if (typeof this.clientCaps.on === 'function') {
                    this.clientCapEventHandlerId = this.clientCaps.on('kmud', async (...args) => await this.eventClientCaps(...args));
                }

                //  Linkdeath
                component.once('disconnected', () => {
                    driver.driverCallAsync('disconnect', async ecc => {
                        await ecc.withPlayerAsync(this, async (player, ctx) => {
                            await player.disconnect(ctx.branch());
                        });
                    });
                });

                //  Connect to the new body
                await ExecutionContext.withNewContext({ object: this.owner.instance, method: 'eventExec', isAsync: true, callType: CallOrigin.Driver }, async ecc => {
                    return await ecc.withPlayerAsync(this, async (player, ecc) => {
                        let shellSettings = typeof player.getShellSettings === 'function' ? await player.getShellSettings(ecc.branch(), false, {}) : false;
                        this.shell.update(shellSettings || {});

                        await player.connect(ecc.branch(), this.connectedPort, this.remoteAddress, ...args);

                        if (shellSettings.variables && shellSettings.variables.SHELLRC) {
                            await this.shell.executeResourceFile(ecc.branch(), shellSettings.variables.SHELLRC);
                        }

                        this.canHeartbeat = typeof player.eventHeartbeat === 'function';
                    }, false, 'connect');
                });
                return true;
            }
            else {
                if (this.connected)
                    await driver.driverCallAsync('disconnect', async context => {
                        await context.withPlayerAsync(this, async (player, ecc) => {
                            if (this.shell) this.shell.flushAll();
                            let component = this.component;
                            this.connected = false;

                            //if (this.component)
                            //    this.component.populateContext(true, context);

                            try {
                                await player.disconnect(ecc.branch({ lineNumber: 305, hint: 'player.disconnect' }), ...args);
                            }
                            finally {
                                component && component.localDisconnect();
                            }
                        });
                    });
                if (this.component)
                    this.component.body = false;
                this.component = false;
                this.clientCaps = ClientCaps.DefaultCaps;
            }
            return true;
        }
        catch (err) {
            logger.log('Error in eventExec: ', err);
        }
        finally {
            frame.pop();
        }
        return false;
    }

    /**
     * Pass the heartbeat on to the in-game object.
     * @param {ExecutionContext} ecc The current callstack
     * @param {number} total
     * @param {number} ticks
     */
    async eventHeartbeat(ecc, total, ticks) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'eventHeartbeat', callType: CallOrigin.Driver });
        try {
            if (this.lastActivity) {
                if (this.idleTime > this.maxIdleTime) {
                    this.heartbeat = false;
                    return this.eventExec(frame.context, 'You have been idle for too long.');
                }
            }
            else if (this.canHeartbeat) {
                try {
                    //  Do not attempt any heartbeats until this one is complete.
                    this.canHeartbeat = false;
                    await this.owner?.instance?.eventHeartbeat(frame.context, total, ticks);
                }
                finally {
                    this.canHeartbeat = true;
                }
            }
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Initialize the storage object.
     * @param {ExecutionContext} ecc
     * @param {MUDObject} ownerObject
     */
    async eventInitialize(ecc, ownerObject) {
        let frame = ecc.pushFrameObject({ object: ownerObject, method: 'eventInitialize', file: ownerObject.fullPath, isAsync: true, callType: CallOrigin.Driver });
        try {
            if (ownerObject instanceof MUDObject) {
                this.owner = ownerObject;
                return true;
            }
            return false;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Reset the object
     * @param {ExecutionContext} ecc The current callstack
     * @returns
     */
    async eventReset(ecc) {
        let frame = ecc.pushFrameObject({ object: this.owner, method: 'eventReset', isAsync: true, callType: CallOrigin.LocalCall });
        try {
            this.nextReset = driver.efuns.ticks + this.resetInterval;
            await this.owner.reset(ecc.branch());
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Restore the storage object.  Is this used?
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} data
     */
    async eventRestore(ecc, data) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'eventRestore', isAsync: true, callType: CallOrigin.Driver });
        try {
            if (data) {
                let owner = this.owner.instance;

                //  Restore inventory
                data.inventory = data.inventory || [];
                for (let i = 0; i < data.inventory.length; i++) {
                    try {
                        let item = await driver.efuns.restoreObjectAsync(frame.branch(), data.inventory[i]);
                        await item.moveObjectAsync(frame.branch(), owner);
                    }
                    catch (e) {
                        this.shell?.stderr?.writeLine(`* Failed to load object ${data.inventory[i].$type}`);
                    }
                }

                let restoreData = async (hive, key, value) => {
                    try {
                        let type = driver.efuns.objectType(frame.branch(), value);

                        if (['string', 'boolean', 'number'].indexOf(type) > -1) {
                            return hive ? hive[key] = value : value;
                        }
                        else if (type === 'array') {
                            let output = [];
                            for (let i = 0; i < value.length; i++) {
                                output[i] = await restoreData(false, false, value[i]);
                            }
                            return hive ? hive[key] = output : output;
                        }
                        else if (type === 'object') {
                            if (value.$type) {
                                try {
                                    let result = await efuns.restoreObjectAsync(value);
                                    return hive ? hive[key] = result : result;
                                }
                                catch (err) {
                                    console.log(`Error in MUDStorage.eventRestore: ${err.message}`);
                                }
                            }
                            else {
                                let keys = Object.keys(value),
                                    isNewHive = hive ? false : (hive = {}, true);
                                for (let i = 0; i < keys.length; i++) {
                                    let key = keys[i];
                                    hive[key] = await restoreData(false, false, value[keys[i]]);
                                }
                            }
                            return hive;
                        }
                    }
                    catch (err) {
                        logger.log('error in eventRestore(): ', err);
                    }
                }
                if (typeof data.properties === 'object') {
                    let props = Object.keys(data.properties || {});
                    for (let i = 0; i < props.length; i++) {
                        let propName = props[i];

                        if (['instanceId', 'filename'].indexOf(propName) > -1)
                            continue;
                        else if (typeof propName === 'string' && !propName.startsWith('$')) {
                            this.properties[propName] = await restoreData({}, propName, data.properties[propName]);
                        }
                    }
                }
                if (typeof this.owner.applyRestore === 'function') {
                    this.owner.applyRestore(frame.branch());
                }
                return owner;
            }
            return false;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Sends an event back to the client component.
     * @param {MUDEvent} event
     */
    eventSend(event) {
        if (this.shell)
            return this.shell.eventSend(event, this.connected);
        return false;
    }

    /**
     * Is the object connected to an interactive session
     */
    get connected() {
        return this.hasFlag(MUDStorageFlags.PROP_CONNECTED);
    }

    set connected(flag) {
        return this.flag(MUDStorageFlags.PROP_CONNECTED, flag);
    }

    get connectedPort() {
        if (this.shell) {
            return this.shell.connectedPort || -1;
        }
        return -1;
    }

    get destroyed() {
        return this.hasFlag(MUDStorageFlags.PROP_DESTRUCTED);
    }

    set destroyed(value) {
        if (value) this.flag(MUDStorageFlags.PROP_DESTRUCTED, true);
    }

    get environment() {
        return unwrap(this.$environment);
    }

    set environment(value) {
        this.$environment = wrapper(value);
    }

    /** Get a copy of the group assignments */
    get groups() {
        return this.$credential.groupNames;
    }

    get heartbeat() {
        return this.hasFlag(MUDStorageFlags.PROP_HEARTBEAT);
    }

    set heartbeat(flag) {
        this.flag(MUDStorageFlags.PROP_HEARTBEAT, flag);
    }

    get interactive() {
        return this.hasFlag(MUDStorageFlags.PROP_INTERACTIVE);
    }

    set interactive(flag) {
        return this.flag(MUDStorageFlags.PROP_INTERACTIVE, flag);
    }

    get inventory() {
        return this.$inventory
            .map(i => unwrap(i))
            .filter(o => o instanceof MUDObject);
    }

    /** @param {MUDObject[]} list */
    set inventory(list) {
        this.$inventory = list
            .filter(o => o instanceof MUDObject)
            .map(o => wrapper(o));
    }

    get maxIdleTime() {
        return this.owner && this.owner.maxIdleTime || 0;
    }

    get living() {
        return this.hasFlag(MUDStorageFlags.PROP_LIVING);
    }

    set living(flag) {
        if (typeof flag === 'string') {
            this.livingName = flag;
        }
        this.flag(MUDStorageFlags.PROP_LIVING, flag !== false);
    }

    #owner;

    get owner() {
        return this.#owner;
    }

    set owner(ownerObject) {
        this.#owner = ownerObject;
    }

    get player() {
        return this.hasFlag(MUDStorageFlags.PROP_ISPLAYER);
    }

    set player(flag) {
        if (typeof flag === 'string') {
            this.playerName = flag;
        }
        this.flag(MUDStorageFlags.PROP_ISPLAYER, flag !== false);
    }

    get remoteAddress() {
        if (this.connected && this.shell) {
            return this.shell.remoteAddress;
        }
        return false;
    }

    getSafeCredential() {
        let result = {
            userId: this.$credential.userId,
            groups: this.$credential.groupIds
        };
        return result;
    }

    /**
     * Set a property value within an object.
     */
    set(definingType, propertyName, value) {
        let baseName = definingType.prototype.baseName;
        if (baseName !== 'MUDObject') {
            let collection = this.properties[baseName];
            if (!collection) {
                collection = this.properties[baseName] = {};
            }
            //  Do not store direct references to objects.
            if (value instanceof MUDObject) {
                value = value.wrapper;
            }
            collection[propertyName] = value;
            return true;
        }
    }

    get thisObject() {
        return this.owner.instance;
    }

    get wizard() {
        return this.hasFlag(MUDStorageFlags.PROP_WIZARD);
    }

    set wizard(flag) {
        this.flag(MUDStorageFlags.PROP_WIZARD, flag === true);
    }

    /**
     * Check to see if the object has a certain flag enabled.
     * @param {number} flag One or more flags to check.
     * @returns {boolean} True if the flag is set.
     */
    hasFlag(flag) {
        return (this.flags & flag) > 0;
    }

    /**
     * Indicates how long this object has been active.
     * @returns {number} Returns the object's idle time in miliseconds.
     */
    get idleTime() {
        if (this.lastActivity > 0)
            return (efuns.ticks - this.lastActivity);
        else
            return 0;
    }

    /**
     * Get storage
     * @param {any} definingType
     * @param {any} propertyName
     * @param {any} initialValue
     */
    get(definingType, propertyName, initialValue) {
        let baseName = definingType.prototype.baseName;
        let collection = this.properties[baseName];
        if (!collection) {
            collection = this.properties[baseName] = {};
        }
        if (propertyName in collection === false) {
            if (typeof initialValue === 'undefined')
                return initialValue;
            collection[propertyName] = initialValue;
        }
        let result = collection[propertyName];
        if (typeof result === 'function')
            return unwrap(result) || result;
        return result;
    }

    /**
     * Toggle/set a flag
     * @param {any} flag
     * @param {any} setFlag
     */
    flag(flag, setFlag = true) {
        let andFlag = setFlag ? flag : ~flag;

        if ((this.flag & andFlag) !== this.flag) {
            switch (flag) {
                case MUDStorageFlags.PROP_CONNECTED:
                case MUDStorageFlags.PROP_EDITING:
                case MUDStorageFlags.PROP_IDLE:
                case MUDStorageFlags.PROP_INPUT:
                case MUDStorageFlags.PROP_DESTRUCTED:
                    break;

                case MUDStorageFlags.PROP_HEARTBEAT:
                    if (this.owner && typeof this.owner.eventHeartbeat === 'function') {
                        driver.setHeartbeat(this, setFlag);
                    }
                    break;

                case MUDStorageFlags.PROP_INTERACTIVE:
                    driver.setInteractive(this, setFlag);
                    break;

                case MUDStorageFlags.PROP_LIVING:
                    driver.setLiving(this, setFlag);
                    break;

                case MUDStorageFlags.PROP_ISPLAYER:
                    driver.setPlayer(this, setFlag);
                    break;

                case MUDStorageFlags.PROP_WIZARD:
                    driver.setWizard(this, setFlag);
                    break;

                default:
                    throw new Error(`Attempted to set meaningless bit flag: ${flag}`);
            }
            if (setFlag)
                this.flags |= flag;
            else
                this.flags &= ~flag;
        }
    }

    /**
     * @returns {ClientCaps} Returns the client capabilities.
     */
    getClientCaps() {
        return this.clientCaps;
    }

    /**
     * 
     * @param {ExecutionContext} ecc The current callstack
     * @param {string} verb
     * @param {CommandShellOptions} opts
     * @returns {CommandShellOptions}
     */
    async getShellSettings(ecc, verb, opts) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'getShellSettings', isAsync: true, callType: CallOrigin.Driver });
        try {
            return await frame.context.withPlayerAsync(this, async player => {
                if (player && typeof player.getShellSettings === 'function') {
                    let result = await player.getShellSettings(frame.branch(), verb, opts);
                    return result;
                }
                else
                    return {};
            }, false);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Re-associate a new object instance with an existing storage object.
     * @param {MUDObject} owner The new owner of this storage
     * @param {object} ctx The context from the reload
     * @returns {MUDStorage} Returns existing storage object. 
     */
    reload(owner, ctx) {
        if (this.owner !== owner) {
            this.emit('kmud.reload');
            this.removeAllListeners();
            this.owner = owner;
            this.filename = owner ? owner.filename : '';
        }
        return this.merge(ctx);
    }

    addInventory(item) {
        let wrapped = item.wrapper,
            itemStore = driver.storage.get(item);

        //  Just in case...
        itemStore.leaveEnvironment();
        this.$inventory.push(wrapped);
        itemStore.environment = wrapper(this.owner);

        return true;
    }

    leaveEnvironment() {
        let env = this.environment.instance;

        if (env) {
            let store = driver.storage.get(env);

            if (store && store.removeInventory(this.owner)) {
                let actionBinder = this.actionBinder;
                if (actionBinder) {
                    actionBinder.clear();
                }
            }
        }
        return true;
    }

    removeInventory(item) {
        let index = this.$inventory.findIndex(o => item.objectId === o.objectId);
        let result = index > -1 ? this.$inventory.splice(index, 1) : false;

        for (const item of this.$inventory) {
            let store = driver.storage.get(item.instance);
            if (store && store.living)
                store.actionBinder.unbindActions(item);
        }
        return !!result;
    }

    /**
     * Removes a symbol from the storage.
     * @param {string} prop The property to remove
     */
    removeSymbol(prop) {
        delete this.symbols[prop];
        return this;
    }
}

class MUDStorageContainer {
    constructor() {
        /** @type {Object.<string,MUDStorage>} */
        this.storage = {};
    }

    /**
     * @param {MUDObject} ob
     */
    create(ob) {
        return this.storage[ob.filename] = new MUDStorage(ob);
    }

    /**
     * Create a new storage object if needed
     * @param {ExecutionContext} ecc The current callstack
     * @param {any} objectId
     * @param {any} filename
     * @returns
     */
    createForId(ecc, objectId, filename) {
        let frame = ecc.pushFrameObject({ file: __filename, method: 'createForId', callType: CallOrigin.Driver });
        try {
            //  If this is a reload, then the storage should already exist
            if (objectId in this.storage) {
                return this.storage[objectId];
            }
            let $credential;

            if (driver.masterObject)
                $credential = driver.securityManager.getCredential(frame.branch(), filename);
            return this.storage[objectId] = new MUDStorage(filename, $credential);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Delete an object's data from storage.
     * @param {MUDObject} ob
     */
    delete(ob) {
        if (ob) {
            if (typeof ob === 'string') {
                if (ob in this.storage) {
                    delete this.storage[ob];
                    return true;
                }
                else {
                    let store = this.storage[ob];
                    if (store)
                        delete this.storage[ob];
                    return !!store;
                }
            }
            let objectId = ob.objectId;
            if (objectId in this.storage) {
                delete this.storage[objectId];
                return true;
            }
        }
        return false;
    }

    /**
     * Fetch storage for the specified argument.
     * @param {MUDObject} ob The file to fetch storage for.
     * @returns {MUDStorage} The storage object for the item or false.
     */
    get(ob) {
        let objectId = ob && ob.objectId;
        if (!objectId) {
            let ecc = ExecutionContext.getCurrentExecution(),
                ctx = ecc.newContext;
            if (ctx) {
                filename = ctx.filename + (ctx.instanceId > 0 ? `#${ctx.instanceId}` : '');
            }
        }
        let result = this.storage[objectId];
        return result;
    }
}

/**
 * @param {GameServer} driver
 * @returns {MUDStorageContainer}
 */
MUDStorage.configureForRuntime = function (driver) {
    let manager = new MUDStorageContainer();

    driver.storage = manager;
};

module.exports = MUDStorage;

