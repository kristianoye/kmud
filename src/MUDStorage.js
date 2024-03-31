/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Module contains data storage for in-game objects.
 */
const
    ActionBinder = require('./ActionBinder'),
    MUDEventEmitter = require('./MUDEventEmitter'),
    ClientComponent = require('./ClientComponent'),
    ClientCaps = require('./network/ClientCaps'),
    MUDStorageFlags = require('./MUDStorageFlags'),
    CommandShellOptions = require('./CommandShellOptions'),
    maxCommandExecutionTime = driver.config.driver.maxCommandExecutionTime;

/**
 * Storage for MUD Objects.  In-game objects do not hold their data directly.
 * The storage object provides public, protected, and private data as well as
 * a signal mechanism between the driver and the in-game object for important
 * events like heartbeats and connection status (to protect against fake calls)
 */
class MUDStorage extends MUDEventEmitter {
    /**
     * Construct a storage object.
     * @param {MUDObject} owner The owner of the storage object.
     */
    constructor(owner) {
        super();

        this.component = false;
        this.clientCaps = ClientCaps.DefaultCaps;

        if (driver.masterObject)
            this.$credential = driver.securityManager.getCredential(owner);

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

    /**
     * Execute a command from the shell.
     * @param {ParsedCommand} clientCommand
     */
    async eventCommand(clientCommand) {
        return await driver.driverCallAsync('executeCommand', async (context) => {
            let cmd = {
                verb: clientCommand.verb,
                args: clientCommand.args.map(a => a.hasOwnProperty('value') ? a.value : a),
                text: clientCommand.text,
                stdout: clientCommand.stdout || this.shell.console,
                stderr: clientCommand.stderr || this.shell.console,
                stdin: clientCommand.stdin || false,
                env: Object.assign({},
                    clientCommand.options.environment || {},
                    clientCommand.options.variables || {})
            };

            let originalContextSettings = context.changeSettings({ alarmTime: efuns.ticks + maxCommandExecutionTime });

            return await context.withPlayerAsync(this, async (player) => {
                let result = false;
                try {
                    context.pushCommand(cmd);
                    result = await player.executeCommand(cmd);
                    if (result !== true && this.actions) {
                        let actionResult = await this.actions.tryAction(cmd);
                        if (typeof actionResult === 'boolean' || typeof actionResult === 'string')
                            result = actionResult;
                    }
                    if (typeof result === 'string')
                        driver.efuns.errorLine(result);
                    return result;
                }
                catch (err) {
                    result = err;
                }
                finally {
                    context.popCommand();
                    context.changeSettings(originalContextSettings);
                }
                return result;
            }, false, 'eventCommand');
        }, this.filename, true);
    }

    /**
     * Destroys the object.
     */
    eventDestroy(...args) {
        if (!this.destroyed) {
            let filename = this.owner.trueName || this.owner.filename;

            let parts = efuns.parsePath(filename),
                module = driver.cache.get(parts.file);

            this.heartbeat = false;

            if (this.component)
                this.eventExec(false, ...args);

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
                    this.owner.eventDestroy();
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

    /**
     * Associate a component with this store and its related object.
     * @param {ClientComponent} component The client bound to this store and in-game object.
     */
    async eventExec(component, ...args) {
        try {
            if (component instanceof ClientComponent) {
                //  If the client has an old body, the client needs to be dissassociated with it
                if (component.body) {
                    let store = driver.storage.get(component.body);

                    if (store) {
                        await driver.driverCallAsync('disconnect', async context => {
                            await context.withPlayerAsync(store, async player => {
                                await driver.driverCallAsync('disconnect', async () => {
                                    store.connected = false;
                                    store.interactive = false;
                                    store.connected = false;
                                    store.lastActivity = 0;
                                    store.shell = false;
                                    await player.disconnect();
                                    store.component = false;
                                    store.clientCaps = ClientCaps.DefaultCaps;
                                });
                            });
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


                this.clientCaps = component.caps || ClientCaps.DefaultCaps;

                //  Linkdeath
                component.once('disconnected', () => {
                    driver.driverCallAsync('disconnect', async ecc => {
                        await ecc.withPlayerAsync(this, async player => {
                            await player.disconnect()
                        });
                    });
                });

                //  Connect to the new body
                await driver.driverCallAsync('connect', async context => {
                    return await context.withPlayerAsync(this, async player => {
                        return await driver.driverCallAsync('connect', async () => {
                            let shellSettings = typeof player.getShellSettings === 'function' ? await player.getShellSettings(false, {}) : false;
                            this.shell.update(shellSettings || {});
                            if (shellSettings.variables && shellSettings.variables.SHELLRC) {
                                await this.shell.executeResourceFile(shellSettings.variables.SHELLRC);
                            }
                            await player.connect(...args);
                        });
                    }, false);
                });
                return true;
            }
            else {
                if (this.connected)
                    await driver.driverCallAsync('disconnect', async context => {
                        await context.withPlayerAsync(this, async player => {
                            await driver.driverCallAsync('disconnect', async () => {
                                if (this.shell) this.shell.flushAll();
                                let component = this.component;
                                this.connected = false;

                                //if (this.component)
                                //    this.component.populateContext(true, context);

                                try {
                                    await player.disconnect(...args);
                                }
                                finally {
                                    component && component.localDisconnect();
                                }
                            });
                        });
                    });
                if (this.component) this.component.body = false;
                this.component = false;
                this.clientCaps = ClientCaps.DefaultCaps;
            }
            return true;
        }
        catch (err) {
            logger.log('Error in setClient: ', err);
        }
        finally {
            setTimeout(() => {
                driver.driverCall('setClient', ecc => {
                    ecc.whenCompleted(() => {
                        // if (this.shell) this.shell.renderPrompt(false);
                    });
                });
            }, 100);
        }
        return false;
    }

    /**
     * Pass the heartbeat on to the in-game object.
     * @param {number} total
     * @param {number} ticks
     */
    eventHeartbeat(total, ticks) {
        if (this.lastActivity) {
            if (this.idleTime > this.maxIdleTime) {
                this.heartbeat = false;
                return this.eventExec(false, 'You have been idle for too long.');
            }
        }
        this.owner.heartbeat(total, ticks);
    }

    /**
     * Initialize the storage object.
     * @param {MUDObject} ownerObject
     */
    async eventInitialize(ownerObject) {
        if (ownerObject instanceof MUDObject) {
            this.owner = ownerObject;

            //  Special case
            if (driver.masterObject != null) {
                this.$credential = await driver.securityManager.getCredential(ownerObject.filename);
            }
            else
                throw new Error('CRASH: Master object has not been created!');
            return true;
        }
        return false;
    }

    /**
     * Restore the storage object.  Is this used?
     * @param {any} data
     */
    async eventRestore(data) {
        if (data) {
            let owner = this.owner.instance;

            if (typeof owner.migrateData === 'function') {
                owner.migrateData(data);
                return owner;
            }

            return await driver.driverCallAsync('eventRestore', async () => {
                //  Restore inventory
                data.inventory = data.inventory || [];
                for (let i = 0; i < data.inventory.length; i++) {
                    try {
                        let item = await driver.efuns.restoreObjectAsync(data.inventory[i]);
                        await item.moveObjectAsync(owner);
                    }
                    catch (e) {
                        this.shell.stderr.writeLine(`* Failed to load object ${data.inventory[i].$type}`);
                    }
                }

                let restoreData = async (hive, key, value) => {
                    try {
                        let type = driver.efuns.objectType(value);

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
                    this.owner.applyRestore();
                }
                return owner;
            });
        }
        return false;
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
                    if (this.owner && typeof this.owner.heartbeat === 'function') {
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
        return this.protected['$clientCaps'] || false;
    }

    /**
     * 
     * @param {string} verb
     * @param {CommandShellOptions} opts
     * @returns {CommandShellOptions}
     */
    async getShellSettings(verb, opts) {
        return await driver.driverCallAsync('getShellSettings', async context => {
            return await context.withPlayerAsync(this, async player => {
                if (player && typeof player.getShellSettings === 'function')
                    return await player.getShellSettings(verb, opts);
                else
                    return {};
            }, false);
        });
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

    createForId(objectId, filename) {
        //  If this is a reload, then the storage should already exist
        if (objectId in this.storage) {
            return this.storage[objectId];
        }
        return this.storage[objectId] = new MUDStorage(filename);
    }

    /**
     * Delete an object's data from storage.
     * @param {MUDObject} ob
     */
    delete(ob) {
        if (typeof ob === 'string') {
            let store = this.storage[ob];
            if (store) delete this.storage[ob];
            return !!store;
        }
        let objectId = ob.objectId;
        if (objectId in this.storage) {
            delete this.storage[objectId];
            return true;
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
            let ecc = driver.getExecution(),
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

