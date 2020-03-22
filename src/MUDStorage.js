/**
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 *
 * Description: Module contains data storage for in-game objects.
 */
const
    MUDEventEmitter = require('./MUDEventEmitter'),
    ClientComponent = require('./ClientComponent'),
    ClientCaps = require('./network/ClientCaps');

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

        /** @type {MUDObject} The current environment */
        this.$environment = null;

        this.filename = typeof owner === 'object' ?
            owner.filename : typeof owner === 'string' && owner;

        this.flags = 0;

        /** @type {MUDObject[]}} All of the inventory contained with the object */
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

        /** @type {MUDObject} The owner of the storage objects */
        this.owner = owner;

        /** @type {Object.<string,any>} */
        this.properties = {};
    }

    /**
     * Set a property value within an object.
     */
    set(definingType, propertyName, value) {
        let baseName = definingType.prototype.baseName;
        let collection = this.properties[baseName];
        if (!collection) {
            collection = this.properties[baseName] = {};
        }
        //  Do not store direct references to objects.
        if (value instanceof MUDObject) {
            value = wrap(value);
        }
        collection[propertyName] = value;
        return true;
    }

    /**
     * Execute a command from the shell.
     * @param {any} rawcmd
     */
    async eventCommand(rawcmd) {
        return await driver.driverCallAsync('executeCommand', async (context) => {
            let cmd = {
                verb: rawcmd.verb.value,
                args: rawcmd.args.map(a => a.hasOwnProperty('value') ? a.value : a),
                text: rawcmd.text
            };

            return await context.withPlayerAsync(this, async (player) => {
                let result = false;
                try {
                    result = await player.executeCommand(cmd);
                    return result;
                }
                catch (err) {
                    result = err;
                }
                return result;
            }, false);
        }, this.filename, true);
    }

    /**
     * Destroys the object.
     */
    eventDestroy(...args) {
        if (!this.destroyed) {
            let parts = efuns.parsePath(this.owner.filename),
                module = driver.cache.get(parts.file);

            this.heartbeat = false;

            if (this.component)
                this.eventExec(false, ...args);

            if (this.environment)
                this.owner.emit('kmud.item.removed', this.environment);

            if (this.player) this.player = false;

            this.owner.removeAllListeners && this.owner.removeAllListeners();
            driver.storage.delete(this.owner);

            this.owner = false;
            this.destroyed = true;

            if (this.shell) {
                this.shell.destroy();
                this.shell = undefined;
            }

            return this.destroyed = module.destroyInstance(parts);
        }
        return false;
    }

    /**
     * Associate a component with this store and its related object.
     * @param {ClientComponent} component The client bound to this store and in-game object.
     */
    eventExec(component, ...args) {
        try {
            if (component instanceof ClientComponent) {
                let streams = false;

                //  If the client has an old body, the client needs to be dissassociated with it
                if (component.body) {
                    let store = driver.storage.get(component.body);
                    if (store) {
                        driver.driverCall('disconnect', context => {
                            store.connected = false;
                            store.interactive = false;
                            store.connected = false;
                            store.lastActivity = 0;
                            store.shell = false;
                            context.withPlayer(store, player => player.disconnect());
                            store.component = false;
                            store.clientCaps = ClientCaps.DefaultCaps;
                        });
                    }
                    else
                        return false;
                }

                this.connected = true;
                this.interactive = true;
                this.lastActivity = efuns.ticks;

                this.shell = component.shell;
                this.component = component;

                component.shell.playerRef = component.body = wrapper(this.owner);
                component.shell.storage = component.storage = this;


                this.clientCaps = component.caps || ClientCaps.DefaultCaps;

                //  Linkdeath
                component.once('disconnected', () => {
                    driver.driverCall('disconnect', ecc => {
                        ecc.withPlayer(this, player => {
                            player.disconnect()
                        });
                    });
                });

                //  Connect to the new body
                driver.driverCall('connect', context => {
                    let shellSettings = context.withPlayer(this, player => player.connect(...args), false);
                    this.shell.update(shellSettings);
                    context.whenCompleted(() => {
                        this.shell.renderPrompt();
                    });
                });
                return true;
            }
            else {
                if (this.connected)
                    driver.driverCall('disconnect', context => {
                        if (this.shell) this.shell.flushAll();
                        let component = this.component;
                        this.connected = false;

                        //if (this.component)
                        //    this.component.populateContext(true, context);

                        try {
                            context.withPlayer(this, player => player.disconnect(...args));
                        }
                        finally {
                            component && component.localDisconnect();
                        }
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
                        if (this.shell)
                            this.shell.renderPrompt(false);
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
     * Restore the storage object.  Is this used?
     * TODO: Make all this async... sigh
     * @param {any} data
     */
    eventRestore(data) {
        if (data) {
            let owner = unwrap(this.owner);

            if (typeof owner.migrateData === 'function') {
                owner.migrateData(data);
                return owner;
            }

            return driver.driverCall('restoreObject', () => {
                //  Restore inventory
                data.inventory = data.inventory || [];
                for (let i = 0; i < data.inventory.length; i++) {
                    try {
                        let item = efuns.restoreObject(data.inventory[i]);
                        item.moveObject(owner);
                    }
                    catch (e) {
                        this.shell.stderr.writeLine(`* Failed to load object ${data.inventory[i].$type}`);
                    }
                }

                let restoreData = (hive, key, value) => {
                    try {
                        let type = typeof value;

                        if (['string', 'boolean', 'number'].indexOf(type) > -1) {
                            return hive ? hive[key] = value : value;
                        }
                        else if (Array.isArray(value)) {
                            if (hive)
                                return hive[key] = value.map(v => restoreData(false, false, v));
                            else
                                return value.map(v => restoreData(false, false, v));
                        }
                        else if (type === 'object') {
                            let $type = value['$type'];
                            if ($type) {
                                try {
                                    if (hive)
                                        return hive[key] = efuns.restoreObject(value);
                                    else
                                        return efuns.restoreObject(value);
                                }
                                catch (err) {
                                }
                            }
                            else if (!hive) {
                                hive = {};
                                Object.keys(value).forEach(key => {
                                    restoreData(hive, key, value);
                                });
                                return hive;
                            }
                            else {
                                if (key in hive === false)
                                    hive = hive[key] = {};
                                else
                                    hive = hive[key];

                                Object.keys(value).forEach(key => {
                                    restoreData(hive, key, value[key])
                                });
                                return hive;
                            }
                        }
                    }
                    catch (err) {
                        logger.log('error in eventRestore(): ', err);
                    }
                }
                if (typeof this.owner.applyRestore === 'function') {
                    this.owner.applyRestore();
                }
                if (!data.properties)
                    logger.log('error: restored data has no properties');
                else
                    Object.keys(data.properties).forEach(filename => {
                        if (this.properties.hasOwnProperty(filename) === false)
                            this.properties[filename] = {};
                        else if (typeof this.properties[filename] !== 'object')
                            throw new Error(`Unable to restore object; Unexpected value for key ${filename}`);
                        restoreData(this.properties, filename, data.properties[filename]);
                    });
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

    get connected() {
        return this.hasFlag(MUDStorage.PROP_CONNECTED);
    }

    set connected(flag) {
        return this.flag(MUDStorage.PROP_CONNECTED, flag);
    }

    get destroyed() {
        return this.hasFlag(MUDStorage.PROP_DESTRUCTED);
    }

    set destroyed(value) {
        if (value) this.flag(MUDStorage.PROP_DESTRUCTED, true);
    }

    get environment() {
        return unwrap(this.$environment);
    }

    set environment(value) {
        this.$environment = wrapper(value);
    }

    get heartbeat() {
        return this.hasFlag(MUDStorage.PROP_HEARTBEAT);
    }

    set heartbeat(flag) {
        this.flag(MUDStorage.PROP_HEARTBEAT, flag);
    }

    get interactive() {
        return this.hasFlag(MUDStorage.PROP_INTERACTIVE);
    }

    set interactive(flag) {
        return this.flag(MUDStorage.PROP_INTERACTIVE, flag);
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
        return this.hasFlag(MUDStorage.PROP_LIVING);
    }

    set living(flag) {
        if (typeof flag === 'string') {
            this.livingName = flag;
        }
        this.flag(MUDStorage.PROP_LIVING, flag !== false);
    }

    get player() {
        return this.hasFlag(MUDStorage.PROP_ISPLAYER);
    }

    set player(flag) {
        if (typeof flag === 'string') {
            this.playerName = flag;
        }
        this.flag(MUDStorage.PROP_ISPLAYER, flag !== false);
    }

    get thisObject() {
        return unwrap(this.owner);
    }

    get wizard() {
        return this.hasFlag(MUDStorage.PROP_WIZARD);
    }

    set wizard(flag) {
        this.flag(MUDStorage.PROP_WIZARD, flag === true);
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
                case MUDStorage.PROP_CONNECTED:
                case MUDStorage.PROP_EDITING:
                case MUDStorage.PROP_IDLE:
                case MUDStorage.PROP_INPUT:
                case MUDStorage.PROP_DESTRUCTED:
                    break;

                case MUDStorage.PROP_HEARTBEAT:
                    if (this.owner && typeof this.owner.heartbeat === 'function') {
                        driver.setHeartbeat(this, setFlag);
                    }
                    break;

                case MUDStorage.PROP_INTERACTIVE:
                    driver.setInteractive(this, setFlag);
                    break;

                case MUDStorage.PROP_LIVING:
                    driver.setLiving(this, setFlag);
                    break;

                case MUDStorage.PROP_ISPLAYER:
                    driver.setPlayer(this, setFlag);
                    break;

                case MUDStorage.PROP_WIZARD:
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
     * Re-associate a new object instance with an existing storage object.
     * @param {MUDObject} owner The new owner of this storage
     * @param {MUDCreationContext} ctx The context from the reload
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
        let wrapped = wrapper(item),
            itemStore = driver.storage.get(item);

        //  Just in case...
        itemStore.leaveEnvironment();
        this.$inventory.push(wrapped);
        itemStore.environment = wrapper(this.owner);

        return true;
    }

    leaveEnvironment() {
        unwrap(this.environment, env => {
            let store = driver.storage.get(env);
            store && store.removeInventory(this);
        })
    }

    removeInventory(item) {
        this.inventory
            .map((ow, i) => {
                if (ow.filename === item.filename) return i;
            })
            .reverse().forEach(i => {
                this.$inventory.splice(i, 1);
            });
        return true;
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

    createForId(filename) {
        return this.storage[filename] = new MUDStorage(filename);
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
        return unwrap(ob, item => {
            let instanceId = item._propKeyId;
            if (instanceId in this.storage) {
                delete this.storage[instanceId];
                return true;
            }
            return false;
        });
    }

    /**
     * Fetch storage for the specified argument.
     * @param {MUDObject} ob The file to fetch storage for.
     * @returns {MUDStorage} The storage object for the item or false.
     */
    get(ob) {
        return unwrap(ob, target => {
            return this.storage[target.filename];
        });
    }

    /**
     * Re-assocate the storage with the new instance reference.
     * @param {MUDObject} item
     * @param {MUDCreationContext} ctx
     */
    reload(item, ctx) {
        return unwrap(item, ob => this.storage[ob.filename].reload(item, ctx));
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

/** Indicates the object is interactive */
MUDStorage.PROP_INTERACTIVE = 1 << 0;

/** Indicates the object is connected (not linkdead) */
MUDStorage.PROP_CONNECTED = 1 << 1;

/** Indicates the object is living and can execute commands */
MUDStorage.PROP_LIVING = 1 << 2;

/** Indicates the object has wizard permissions */
MUDStorage.PROP_WIZARD = 1 << 3;

/** Indicates the interactive object is idle */
MUDStorage.PROP_IDLE = 1 << 4;

/** Indicates the object is in edit mode */
MUDStorage.PROP_EDITING = 1 << 5;

/** Indicates the object is in input mode */
MUDStorage.PROP_INPUT = 1 << 6;

/** Indicates the object has a heartbeat */
MUDStorage.PROP_HEARTBEAT = 1 << 7;

/** Indicates the object is (or was) a player */
MUDStorage.PROP_ISPLAYER = 1 << 8;

/** Indicates the object has been destroyed */
MUDStorage.PROP_DESTRUCTED = 1 << 9;

module.exports = MUDStorage;

