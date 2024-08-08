/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.callType
 * Date: October 1, 2017
 *
 * Description: MUD eXecution Context (MXC).  Maintains object stack and
 * important "thread" context variables (current player, true player,
 * current object, etc).
 */
const
    CreationContext = require('./CreationContext'),
    MemberModifiers = require("./compiler/MudscriptMemberModifiers"),
    MUDEventEmitter = require('./MUDEventEmitter'),
    uuidv1 = require('uuid/v1'),
    CallOrigin = Object.freeze({
        Unknown: 0,
        Driver: 1 << 0,
        LocalCall: 1 << 1,
        CallOther: 1 << 2,
        SimulEfun: 1 << 3,
        Callout: 1 << 4,
        DriverEfun: 1 << 5,
        FunctionPointer: 1 << 6,
        Functional: 1 << 7,
        Constructor: 1 << 8,
        GetProperty: 1 << 9,
        SetProperty: 1 << 10
    }),
    SignalState = Object.freeze({
        Running: 0,
        None: 0,
        Aborted: 1,
        Suspended: 2
    }),
    events = require('events'),
    parseErrorLine = /\s*at (?<callType>new|async)?\s*(?<callee>[^\b]+) \((?<loc>[^\)]+)\)/;

var
    contextCount = 0,
    /** @type {Object.<string,ExecutionContext>} */ contexts = {},
    /** @type {Object.<number,ExecutionContext>} */ contextsByPID = {},
    nextPID = 1,
    /** @type {ExecutionContext} */
    currentExecution = undefined;

/**
 * Represents a single frame on the MUD call stack
 */
class ExecutionFrame {
    /**
     * Construct a new frame
     * @param {Partial<ExecutionFrame>} frame Information about the new callstack frame
     */
    constructor(frame) {
        /**
         * Is this frame awaiting a result?
         */
        this.awaitCount = 0;

        this.ellapsed = 0;

        /**
         * @type {Error}
         */
        this.error = false;

        /**
         * @type {[Object.<string, [function()] | [function(): any, function(val): void]>]}
         */
        this.parameters = frame.parameters || {};

        /** 
         * The unique UUID of this frame
         * @type {string}
         */
        this.id = uuidv1();

        /** 
         * The context in which this frame is executing 
         * @type {ExecutionContext}
         */
        this.context = frame.context;

        /**
         * The object performing the action 
         * @type {import('./MUDObject')}
         */
        this.object = frame.object;// || frame.context?.thisObject;

        if (this.object) {
            this.className = this.object.constructor.name;
        }
        else if (frame.className) {
            if (typeof frame.className === 'string')
                this.className = frame.className;
            else
                this.className = frame.className.name || 'Unknown';
        }

        if (typeof frame.callHint === 'string') {
            /**
             * A call hint is used to troubleshoot issues with the stack
             * @type {string}
             */
            this.callHint = frame.callHint;
        }

        /**
         * How was this method invoked?
         */
        this.callType = frame.callType || CallOrigin.Unknown;

        /**
         * The method name + extra decorations (e.g. static async [method]) 
         * @type {string}
         */
        this.callString = frame.callstring || frame.method;

        /**
         * The file in which the executing method exists 
         * @type {string}
         */
        this.file = frame.file || frame.context?.thisObject?.filename;

        /** 
         * The name of the method being executed 
         * @type {string}
         */
        this.method = frame.method;

        /**
         * The line number at which the call was made 
         * @type {number}
         */
        this.lineNumber = frame.lineNumber || 0;

        /** More informative than useful, now
         * @type {boolean}
         */
        this.isAsync = frame.isAsync === true;

        /**
         * When was the method put on the stack?
         */
        this.startTime = driver.efuns.ticks;

        /**
         * Unguarded frames short-circuit security and prevent checks against previous objects 
         * @type {boolean}
         */
        this.unguarded = frame.unguarded === true;
    }

    /**
     * Create a branch in the stack
     * @param {number} lineNumber
     * @returns
     */
    branch(lineNumber = 0) {
        return this.context.branch(lineNumber);
    }

    get caller() {
        return this.object || this.file;
    }

    clone() {
        return new ExecutionFrame(this);
    }

    getContext() {
        return this.context;
    }

    /**
     * How did this call originate?
     */
    get origin() {
        let prev = this.context.length > 1 ? this.context.stack[1] : false,
            val = CallOrigin.Unknown;

        if (prev) {
            if (prev.object !== this.object)
                val |= CallOrigin.CallOther;
            else if (prev.object == this.object)
                val |= CallOrigin.LocalCall;

            val |= prev.callType;
        }
        return val;
    }

    /**
     * Pop this frame off the execution stack
     * @param {boolean} yieldBack
     */
    pop(yieldBack = false) {
        this.ellapsed = this.ticks;
        this.context.popFrame(this, yieldBack === true);
    }

    /**
     * The execution cost of this frame in ticks
     * @returns {number}
     */
    get ticks() {
        return driver.efuns.ticks - this.startTimes;
    }

    toString(maskExternalPaths = false) {
        if (this.file) {
            let file = this.file;
            if (maskExternalPaths) {
                if (ExecutionContext.isExternalPath(file)) {
                    file = '[EXTERNAL]';
                }
            }
            if (this.className)
                return `${this.className}.${this.method} [${file}; ${this.lineNumber}]`;
            else
                return `${this.method} [${file}; ${this.lineNumber}]`;
        }
        else
            return `${this.method} [${this.lineNumber}]`;
    }
}

/**
 * Process controller to allow for aborting or suspending processes
 */
class ExecutionSignaller extends MUDEventEmitter {
    constructor() {
        super();

        this.#error = false;
        this.#state = SignalState.Running;
        this.#suspendTime = 0;
    }

    /**
     * Error to throw at first opportunity
     * @type {Error}
     */
    #error;

    /** What state is the signaller in? */
    #state;

    /** The time at which the suspend signal was given */
    #suspendTime;

    /**
     * Send the abort signal
     * @param {string | Error} [reason] A descriptive reason as to why the abort was sent
     */
    abort(reason = false) {
        this.#error = reason instanceof Error ? reason : new Error(reason || 'Execution aborted');
        this.#state = SignalState.Aborted;
        this.emit('abort', this.#error);
    }

    get error() {
        return this.#error;
    }

    isListening(eventName, handler) {
        let listeners = this.rawListeners(eventName),
            index = listeners.indexOf(handler);

        return (index > -1);
    }

    resume() {
        if (this.state === SignalState.Suspended) {
            this.#state = SignalState.Running;
            this.emit('resume', Date().getTime() - this.#suspendTime);
            this.#suspendTime = 0;
        }
    }

    suspend() {
        if (this.state === SignalState.Running) {
            this.#suspendTime = new Date().getTime();
            this.#state = SignalState.Suspended;
            this.emit('suspend');
        }
    }

    onlyOnce(eventName, handler, ...args) {
        if (!this.isListening(eventName, handler))
            this.once(eventName, handler, ...args);
    }

    onlyOne(eventName, handler, ...args) {
        if (!this.isListening(eventName, handler))
            this.on(eventName, handler, ...args);
    }

    get state() {
        return this.#state;
    }
}

/**
 * Maitains execution and object stacks for the MUD.
 */
class ExecutionContext extends MUDEventEmitter {
    /**
     * 
     * @param {ExecutionContext} parent The parent context (if one exists)
     * @param {boolean} createDetached Is this context a standalone thread?
     * @param {{ lineNumber: number, hint: string }} info Why and where was this context created?
     * 
     */
    constructor(parent = false, createDetached = false, info = false) {
        super();

        if (info) {
            this.info = info;
        }
        /** 
         * Storage for custom runtime variables
         * @type {Object.<string,any>} 
         */
        this.customVariables = {};

        /** @type {function[]} */
        this.onComplete = [];
        /** @type {string} */
        this.handleId = uuidv1();
        this.completed = false;

        /** @type {Object.<string,ExecutionContext> & { length: number }} */
        this.children = {};
        this.childCount = 0;

        /** @type {ExecutionSignaller} */
        this.controller = new ExecutionSignaller();

        /** @type {ExecutionFrame[]} */
        this.stack = [];

        /** @type {{ verb: string, args: string[] }[]} */
        this.cmdStack = [];

        /** @type {ExecutionContext} */
        this.parent = undefined;

        /** Was this context ever used? */
        this.used = false;
        /** @type {ExecutionContext[]} */
        this.unusedChildren = [];

        if (parent) {
            /** @type {ExecutionFrame[]} */
            this.stack = parent.stack.slice(0);
            this.shell = parent.shell || false;
            this.branchedAt = parent.stack.length;
            this.alarmTime = parent.alarmTime;
            this.currentVerb = parent.currentVerb || false;
            this.client = parent.client;
            this.cmdStack = parent.cmdStack;

            if (createDetached !== true) {
                this.parent = parent;
                this.parentFrame = parent.stack[0];
                parent.unusedChildren = [this, ...parent.unusedChildren];

                /** @type {ExecutionContext} */
                this.master = parent.master;
                this.pid = parent.pid;

                if (Array.isArray(parent.creationContexts))
                    this.creationContexts = parent.creationContexts.slice(0);
                if (Array.isArray(parent.virtualCreationContexts))
                    this.virtualCreationContexts = parent.virtualCreationContexts.slice(0);
            }
        }
        else {
            this.#alarmTime = Number.MAX_SAFE_INTEGER;// driver.efuns.ticks + 5000;
            this.currentVerb = false;
            this.branchedAt = 0;
            this.pid = nextPID++;

            contextsByPID[this.pid] = this;
        }
        contexts[this.handleId] = this;
        contextCount++;
        ExecutionContext.setCurrentExecution(this);
    }

    /**
     * Add a new constructor context to the LIFO stack
     * @param {CreationContext} creationContext Details of the object being constructed
     * @returns {CreationContext} Returns the newly created context
     */
    addCreationContext(creationContext) {
        if (!this.creationContexts)
            this.creationContexts = [];
        this.creationContexts.unshift(new CreationContext(creationContext));
        return this.creationContexts[0];
    }

    /**
     * Add a custom value
     * @param {string} key
     * @param {any} val
     */
    addCustomVariable(key, val) {
        if (typeof key === 'string' && key.length > 0)
            this.customVariables[key] = val;
        return this;
    }

    /**
     * Add a new constructor context to the LIFO stack
     * @param {CreationContext} creationContext Details of the object being constructed
     * @returns {CreationContext} Returns the newly created context
     */
    addVirtualCreationContext(creationContext) {
        if (!this.virtualCreationContexts)
            this.virtualCreationContexts = [];
        this.virtualCreationContexts.unshift(new CreationContext(creationContext, true));
        return this.virtualCreationContexts[0];
    }

    /** 
     * The time at which to throw an exception
     * @type {nummber}
     */
    #alarmTime;

    /**
     * Check to see if this thread has exceeded the max execution time
     * @returns {ExecutionContext}
     */
    alarm() {
        if (this.alarmTime && efuns.ticks > this.alarmTime) {
            this.emit('complete', 'MAXEXT');
            let err = new Error(`Maxiumum execution time exceeded`);
            err.code = 'MAXECT';
            throw err;
        }
        return this;
    }

    /**
     * The time at which this process must die
     * @returns {number}
     */
    get alarmTime() {
        if (this.master)
            return this.master.alarmTime;
        else
            return this.#alarmTime;
    }

    set alarmTime(n) {
        if (this.master)
            this.master.alarmTime = n;
        else
            this.#alarmTime = n;
    }

    /**
     * Check to see if the current protected or private call should be allowed.
     * @param {typeof import('./MUDObject')} thisObject The current 'this' object in scope (or type if in a static call)
     * @param {number} access Access type (private, protected, etc)
     * @param {string} method The name of the method being accssed
     * @param {string} fileName The file this 
     */
    assertAccess(thisObject, method, access, fileName) {
        let to = this.thisObject || thisObject;
        let friendTypes = []; // TODO: Replace this: thisObject instanceof MUDObject && thisObject.constructor.friendTypes;
        let areFriends = false;

        if (Array.isArray(friendTypes)) {
            for (let i = 0, m = friendTypes.length; i < m; i++) {
                if (this.thisObject instanceof friendTypes[i]) {
                    areFriends = true;
                    break;
                }
            }
        }

        if (!to) // static method?
            throw new Error(`Cannot access ${access} method '${method}'`);

        if (to === thisObject)
            return true;

        if (to === driver || this.thisObject === driver.masterObject)
            return true;

        if (areFriends)
            return true;

        if ((access & MemberModifiers.Private) > 0)
            throw new Error(`Cannot access ${access} method '${method}' in ${thisObject.filename}`);

        else {
            let samePackage = false, sameTypeChain = false;

            if ((access & MemberModifiers.Package) > 0) {
                let parts = driver.efuns.parsePath(this, this.thisObject.baseName);
                samePackage = parts.file === fileName;
                if (parts.file !== fileName)
                    throw new Error(`Cannot access ${access} method '${method}' in ${thisObject.filename}`);
            }
            if ((access & MemberModifiers.Protected) > 0) {
                sameTypeChain = global.MUDVTable.doesInherit(this.thisObject, thisObject.constructor);
            }
            return ((access & MemberModifiers.Protected) > 0 && samePackage) || ((access & MemberModifiers.Protected) && sameTypeChain);
        }
        return true;
    }

    /**
     * Check the state of the context to see if we can proceed
     * @param {boolean} canAwait Indicates whether we can currently pause for a suspended state
     */
    async assertStateAsync(canAwait = false) {
        if (this.controller.state !== SignalState.Running) {
            if (this.controller.state === SignalState.err)
                throw this.controller.error;

            if (canAwait && this.controller.state === SignalState.Suspended) {
                let ellapsed = await this.awaitResume();
                this.alarmTime += ellapsed;
            }
        }
    }

    /**
     * Check the state of the context to see if we can proceed.  Since this is a sync call,
     * we cannot wait for a resume.
     */
    assertStateSync() {
        if (this.controller.state !== SignalState.Running) {
            if (this.controller.state === SignalState.err)
                throw this.controller.error;
        }
    }

    /**
     * Await an asyncronous call and yield back the execution time
     * @param {function(...):any} asyncCode
     */
    async awaitResult(asyncCode) {
        let startTime = new Date().getTime(),
            frame = this.stack[0];

        if (!frame)
            await driver.crashAsync(new Error(`Call stack was empty!`));

        try {
            await this.assertStateAsync(true);
            frame.awaitCount++;
            this.restore();
            let result = await asyncCode();
            this.restore();
            await this.assertStateAsync(true);
            return result;
        }
        catch (err) {
            let cleanError = driver.cleanError(err);
            if (cleanError.file) {
                await driver.logError(this.branch(), cleanError.file, cleanError);
            }
            throw err;
        }
        finally {
            let ellapsed = (new Date().getTime() - startTime);
            this.alarmTime += ellapsed;
            frame.awaitCount--;
            this.restore();
        }
    }

    /**
     * Wait for the context to be resumed
     * @returns {Promise<number}
     */
    awaitResume() {
        return new Promise((resolve, reject) => {
            this.controller.onlyOnce('resume', (ticks) => resolve(ticks));
            this.controller.onlyOnce('abort', () => reject(this.controller.error));
        });
    }

    /**
     * Start a new execution branch on the call stack
     * @param {number | { lineNumber: number, hint: string }} info The line number the call to branch was made from
     * @returns {ExecutionContext} Returns a child context.
     */
    branch(info = 0) {
        const
            lineNumber = info.lineNumber || (typeof info === 'number' ? info : 0);

        let result = new ExecutionContext(this, false, info);
        if (lineNumber > 0) {
            let lastFrame = result.stack[0].clone();
            lastFrame.lineNumber = lineNumber;
            result.stack[0] = lastFrame;
        }
        return result;
    }

    /**
     * Change context settings and return their original values
     * @param {Object.<string,any>} changes
     */
    changeSettings(changes) {
        let original = {};
        for (const [key, val] of Object.entries(changes)) {
            if (key in this) {
                original[key] = this[key];
                this[key] = val;
            }
        }
        return original;
    }

    /**
     * A child context has completed
     * @param {ExecutionContext} child
     */
    childCompleted(child) {
        if (child.handleId in this.children) {
            delete this.children[child.handleId];
            if (--this.childCount === 0) {
                this.complete();
            }
        }
    }

    get command() {
        return this.cmdStack.length && this.cmdStack[0];
    }

    /**
     * Complete execution
     * @returns {ExecutionContext} Reference to this context.
     * @param {boolean} forceCompletion If true then the context is forced to be finish regardless of state
     */
    complete(forceCompletion = false) {
        try {
            if (this.stack.length === this.branchedAt || true === forceCompletion) {
                if (this.childCount > 0) {
                    for (const [id, child] of Object.entries(this.children)) {
                        console.log(`\tExecutionContext: Child context ${id} has not completed`);
                        child.onComplete.push(() => {
                            console.log(`\tExecutionContext: Child context ${id} completed after its parent`);
                        });
                    }
                }
                if (this.unusedChildren.length > 0) {
                    for (const child of this.unusedChildren) {
                        console.log(`\tExecutionContext: Child context ${child.handleId} was never used`);
                        ExecutionContext.deleteContext(child);
                    }
                    this.unusedChildren = [];
                }
                this.completed = true;
                for (let i = 0; i < this.onComplete; i++) {
                    try {
                        let callback = thlsis.onComplete[i];
                        typeof callback === 'function' && callback();
                    }
                    catch (err) {
                        console.log(`Error in context onCompletion: ${err}`);
                    }
                }
            }
        }
        finally {
            if (this.completed) {
                ExecutionContext.deleteContext(this);

                if (this.parent) {
                    this.parent.childCompleted(this);
                }
                process.nextTick(async () => {
                    await this.emit('complete', 'complete', forceCompletion ? 1 : 0);
                });
            }
        }
        return this;
    }

    static get current() {
        return currentExecution;
    }

    static set current(ecc) {
        ExecutionContext.setCurrentExecution(ecc);
    }

    /**
     * Create a new, empty execution context
     * @returns {ExecutionContext}
     */
    static createNewContext() {
        return (driver.executionContext = new ExecutionContext());
    }

    get currentFileName() {
        let frame = this.stack[0];
        return frame.file || false;
    }

    /**
     * Delete an active context
     * @param {ExecutionContext} ecc
     */
    static deleteContext(ecc) {
        if (ecc.handleId in contexts) {
            delete contexts[ecc.handleId];
            contextCount--;
            if (!ecc.parent && ecc.pid > 0) {
                delete contextsByPID[ecc.pid];
            }
        }
    }

    /**
     * Spawn a new child context for an async process like setTimeout or setInterval
     * @returns {ExecutionContext} Returns a child context.
     */
    fork() {
        return new ExecutionContext(this, true);
    }

    /**
     * Get all executing? contexts
     * @returns {Object.<string,ExecutionContext>}
     */
    static getContexts() {
        return Object.assign({}, contexts);
    }

    /**
     * Look up a context by its UUID
     * @param {string} handleId
     * @returns
     */
    static getContextByHandleID(handleId) {
        if (handleId in contexts) {
            return contexts[handleId];
        }
    }

    /**
     * Get a context by its PID
     * @param {number} pid
     * @returns {ExecutionContext}
     */
    static getContextByPID(pid) {
        if (typeof pid === 'number' && pid in contextByPID)
            return contextsByPID[pid];
        return false;
    }

    /**
     * Get a custom variable
     * @param {string} key
     */
    getCustomVariable(key) {
        if (key in this.customVariables)
            return this.customVariables[key];
    }

    /**
     * Get the specified execution frame from the stack
     * @param {number} index The index of the frame to fetch
     */
    getFrame(index) {
        return index > -1 && index < this.length && this.stack[index];
    }

    /**
     * Returns the last frame that was internal to the game.
     */
    getLastGameFrame() {
        let lastFrame = this.stack.lastIndexOf(frame => ExecutionContext.isExternalPath(frame.file));
        return lastFrame > -1 && this.stack[lastFrame]
    }

    /**
     * Get the stack as a string
     * @param {number} startFrame The frame to start with
     * @param {number} endFrame The frame to stop on
     * @param {boolean} maskExternalPaths If true, then external paths will show 'external'
     * @returns {string}
     */
    getStackString(startFrame = 0, stopFrame = undefined, maskExternalPaths = true) {
        return this.stack.slice(startFrame, stopFrame).map(f => f.toString(maskExternalPaths)).join('\n');
    }

    /**
     * Check access to a guarded function.
     * @param {function(ExecutionFrame):boolean} callback Calls the callback for each frame.
     * @param {function(...any): any} [action] An optional action to perform
     * @returns {boolean} Returns true if the operation is permitted or false if it should fail.
     */
    async guarded(callback, action = false, rethrow = false) {
        let isAsync = driver.efuns.isAsync(callback);
        await this.assertStateAsync(isAsync);
        for (let i = 0, max = this.length, c = {}; i < max; i++) {
            let frame = this.getFrame(i);

            if (frame.unguarded === true)
                break;
            else if (!frame.object && !frame.file)
                continue; // Does this ever happen?
            else if (frame.object === driver)
                continue; // The driver always succeeds
            else if (frame.object === driver.masterObject)
                return true; // The master object always succeeds as well
            else if (c[frame.file])
                continue;
            else if (isAsync && (c[frame.file] = await callback(frame)) === false)
                return false;
            else if ((c[frame.file] = callback(frame)) === false)
                return false;
        }
        if (action) {
            try {
                let result = undefined;

                if (driver.efuns.isAsync(action)) {
                    await this.assertStateAsync(true);
                    result = await action();
                    await this.assertStateAsync(true);
                }
                else {
                    this.assertStateSync();
                    result = action();
                    this.assertStateSync();
                }
                return result;
            }
            catch (err) {
                if (rethrow) throw err;
            }
            finally {
                this.restore();
            }
            return false;
        }
        return true;
    }

    get isAwaited() {
        return this.stack.length > 0 && this.stack[0].awaitCount > 0;
    }

    /**
     * Check to see if the specified pat is external; External files should not
     * be considered when performing security checks.
     * 
     * Do we need more?
     * 
     * @param {string} filename
     * @returns {boolean}
     */
    static isExternalPath(filename) {
        if (filename.startsWith(__dirname))
            return true;
        return false;
    }

    get length() {
        return this.stack.length;
    }

    get newContext() {
        if (Array.isArray(this.creationContexts))
            return this.creationContexts[0];
        return undefined;
    }

    set newContext(ctx) {
        if (!Array.isArray(this.creationContexts))
            this.creationContexts = [];
        this.creationContexts[0] = ctx;
        return ctx;
    }

    get player() {
        return this.getThisPlayer();
    }

    /**
     * Pops a MUD frame off the stack
     * @param {string | ExecutionFrame} method
     * @param {boolean} yieldBack If true, then the call duration is yielded back to the alarm time
     */
    pop(method, yieldBack = false) {
        let lastFrame = this.stack.shift();

        if (!lastFrame || lastFrame.callString !== method) {
            if (lastFrame && lastFrame !== method) {
                console.log(`\tExecutionContext: Out of sync; Expected ${method} but found ${lastFrame.callString}`);
            }
            else
                console.log(`\tExecutionContext: Out of sync... no frames left!`);
        }

        if (true === yieldBack) {
            if (this.alarmTime < Number.MAX_SAFE_INTEGER)
                this.alarmTime += lastFrame.ellapsed;
        }

        if (this.stack.length === this.branchedAt) {
            this.complete();
        }
        else
            this.assertStateSync();

        return lastFrame;
    }

    popCommand() {
        return this.cmdStack.length && this.cmdStack.shift();
    }

    popCurrentFrame() {
        let frame = this.stack[0];
        return this.pop(frame.callString);
    }

    popCreationContext(arg = false) {
        if (Array.isArray(this.creationContexts)) {
            let ctx = arg ? this.creationContexts.findIndex(c => c === arg) : this.creationContexts.shift();
            if (typeof ctx === 'number') {
                ctx = this.creationContexts.splice(ctx, 1);
            }
            if (this.parent?.creationContexts !== null) {
                this.parent.popCreationContext(ctx);
            }
            if (this.creationContexts.length === 0)
                delete this.creationContexts;
            return ctx;
        }
        delete this.storage;
        return undefined;
    }

    /**
     * Pop a frame object off the stack
     * @param {ExecutionFrame} frame
     * @param {boolean} yieldBack
     */
    popFrame(frame, yieldBack = false) {
        if (true === yieldBack) {
            if (this.alarmTime < Number.MAX_SAFE_INTEGER)
                this.alarmTime += lastFrame.ellapsed;
        }
        if (frame !== this.stack[0]) {
            if (this.stack.length === 0) {
                //  Crasher?
                console.log('\tExecutionContext: Cannot pop frame off an empty stack!');
            }
            else {
                console.log(`\tExecutionContext: Out of sync; Expected ${frame.method} but found ${this.stack[0].method}`);
                let index = this.stack.findIndex(f => f === frame);
                if (index === -1) {
                    //  Crash?
                    console.log(`\tExecutionContext: CRITICAL ERROR: FRAME NOT FOUND IN STACK: ${frame.method}`);
                }
                else {
                    this.stack = this.stack.slice(0, index);
                }
            }
        }
        else
            this.stack.shift();

        if (this.stack.length <= this.branchedAt) {
            this.complete();
        }
        else
            this.assertStateSync();

        return frame;
    }

    popVirtualCreationContext(arg = false) {
        if (Array.isArray(this.virtualCreationContexts)) {
            let ctx = arg ? this.virtualCreationContexts.findIndex(c => c === arg) : this.virtualCreationContexts.shift();
            if (typeof ctx === 'number') {
                ctx = this.virtualCreationContexts.splice(ctx, 1);
            }
            if (this.parent?.virtualCreationContexts !== null) {
                this.parent.popVirtualCreationContext(ctx);
            }
            if (this.virtualCreationContexts.length === 0)
                delete this.virtualCreationContexts;
            return ctx;
        }
        return undefined;
    }

    /**
     * Returns the previous object
     */
    get previousObject() {
        let prev = this.previousObjects;
        return prev.length > 1 && prev[1];
    }

    /**
     * Returns the previous objects off the stack
     * @type {typeof import('./MUDObject')[]}
     */
    get previousObjects() {
        let stack = this.stack;
        return stack
            .filter(f => typeof f.object === 'object')
            .slice(0)
            .map(f => f.object);
    }

    /**
     * Push a new frame onto the stack
     * @param {any} object
     * @param {string} method
     * @param {string} file
     * @param {boolean} isAsync
     * @param {number} lineNumber
     * @param {string} callString
     * @param {boolean} [isUnguarded]
     * @returns {ExecutionContext}
     */
    push(object, method, file, isAsync, lineNumber, callString, isUnguarded, callType = 0) {
        let newFrame = new ExecutionFrame({ context: this, object, file, method, lineNumber, callString, isAsync, isUnguarded, callType });
        return this.pushActual(newFrame).context;
    }

    /**
     * Actually push the frame to the stack
     * @param {ExecutionFrame} frame
     */
    pushActual(frame) {
        this.stack.unshift(frame);
        currentExecution = this;

        if (!this.used) {
            this.used = true;

            //  Once a frame is used, only then is it registered with the parent
            if (this.parent) {
                let index = this.parent.unusedChildren.findIndex(this, c => c === this);

                this.parent.children[this.handleId] = this;
                this.parent.childCount++;

                this.parent.unusedChildren.splice(index, 1);
            }
        }
        return frame;
    }

    /**
     * Push a command
     * @param {{ verb: string, args: string[] }} cmd
     */
    pushCommand(cmd) {
        this.cmdStack.unshift(cmd);
    }

    /**
     * Push a new frame onto the stack
     * @param {typeof import('./MUDObject')} object
     * @param {string} method
     * @param {string} file
     * @param {boolean} isAsync
     * @param {number} lineNumber
     * @param {string} callString
     * @param {boolean} [isUnguarded]
     * @returns {ExecutionFrame}
     */
    pushFrame(object, method, file, isAsync = false, lineNumber = 0, callString = false, isUnguarded = false, callType = 0) {
        this.push(object, method, file, isAsync, lineNumber, callString, isAsync, isUnguarded, callType);
        return this.stack[0];
    }

    /**
     * Shortcut for pushing partial frames to stack
     * @param {Partial<ExecutionFrame>} frameInfo
     */
    pushFrameObject(frameInfo) {
        if (typeof frameInfo !== 'object')
            driver.crash(new Error('CRASH: pushFrameObject() received invalid parameter'));
        else if (typeof frameInfo.method !== 'string')
            driver.crash(new Error('CRASH: pushFrameObject() received invalid parameter'));
        let newFrame = new ExecutionFrame({ context: this, ...frameInfo, object: (frameInfo.object || this.thisObject) });
        this.pushActual(newFrame);
        return newFrame;
    }

    pushNewScope() {
        return this;
    }

    /**
     * Push a new frame based on the NodeJS callstack
     * THIS IS SUPER SLOW (23x slower than pushFrameObject); Avoid use if possible
     * @param {Partial<ExecutionFrame>} partialInfo
     * @returns
     */
    pushFromStack(partialInfo = {}) {
        let stack = __stack,
            frame = stack[1];

        if (frame) {
            let info = Object.assign({
                object: undefined,
                file: frame.getFileName(),
                method: frame.getMethodName() || frame.getFunctionName(),
                lineNumber: frame.getLineNumber(),
                isAsync: false,
                unguarded: false,
                callType: 0
            }, partialInfo)
            let newFrame = new ExecutionFrame({
                context: this,
                ...info,
                callString: info.callString || info.method
            });
            this.pushActual(newFrame);
            return newFrame;
        }
        throw new Error('Could not determine frame information from stack');
    }

    /**
     * Remove a custom variable
     * @param {string} id
     */
    removeCustomVariable(id) {
        if (typeof id === 'string' && id in this.customVariables)
            delete this.customVariables[id];
    }

    /**
     * Remove a frame out of order based on its ID
     * @param {string} frameId The frame's UUID
     */
    removeFrameById(frameId) {
        let index = this.stack.findIndex(frame => frame.id === frameId);
        if (index > -1) {
            let result = this.stack.splice(index, 1);
            return result.length > 0;
        }
        return false;
    }

    /**
     * Restore this context to the active context in the driver
     * @returns {ExecutionContext}
     */
    restore() {
        ExecutionContext.setCurrentExecution(this);
        return this;
    }

    /**
     * Resume the thread/context
     * @returns {ExecutionContext}
     */
    resume() {
        this.controller.resume();
        return this;
    }

    /**
     * Start a new execution context/stack
     * @param {Partial<ExecutionFrame>} initialFrame
     */
    static startNewContext(initialFrame = false) {
        let ecc = new ExecutionContext();
        if (initialFrame) {
            let frame = ecc.pushFrameObject(initialFrame);
            return [ecc, frame];
        }
        return (currentExecution = ecc);
    }

    get state() {
        return this.controller.state;
    }

    /**
     * (Try and...) Suspend the thread/context
     * @returns {ExecutionContext}
     */
    suspend() {
        this.controller.suspend();
        return this;
    }

    /**
     * Returns the current object
     * @type {typeof import('./MUDObject')}
     */
    get thisObject() {
        for (let i = 0, m = this.stack.length; i < m; i++) {
            let ob = this.stack[i].object;

            if (typeof ob === 'object')
                return ob;

            // NEVER expose the driver directly to the game, use master instead
            if (ob === driver)
                // The only exception is when loading the masterObject itself
                return driver.masterObject || driver;
        }
        return false;
    }

    #thisPlayer;
    #truePlayer;

    getThisPlayer(truePlayer = false, getBoth = false) {
        if (this.parent)
            return this.parent.getThisPlayer(truePlayer, getBoth);
        else if (!getBoth)
            return truePlayer ? this.#truePlayer : this.#thisPlayer;
        else
            return { thisPlayer: this.#thisPlayer, truePlayer: this.#truePlayer };
    }

    getTruePlayer() {
        if (this.parent)
            return this.parent.getThisPlayer(true);
        else
            return this.#truePlayer;
    }

    get truePlayer() {
        if (this.parent)
            return this.getTruePlayer();
        else
            return this.#truePlayer || this.#thisPlayer;
    }

    /**
     * Get the current execution
     * @param {boolean} createIfMissing Create a new context if none is running
     * @returns {ExecutionContext} The current execution context 
     */
    static getCurrentExecution(createIfMissing = false) {
        if (!currentExecution) {
            ExecutionContext.setCurrentExecution(new ExecutionContext());
        }
        return currentExecution;
    }

    /**
     * Change active context
     * @param {ExecutionContext} context The new context
     * @returns The previous context
     */
    static setCurrentExecution(context) {
        let previous = currentExecution;
        driver.executionContext = currentExecution = context;
        return previous;
    }

    /**
     * Set the active player and return the previous active player
     * @param {any} player
     * @returns
     */
    setThisPlayer(player, truePlayer = true, returnPreviousTruePlayer = false) {
        if (this.parent)
            return this.parent.setThisPlayer(player);
        else {
            let { thisPlayer: previous, truePlayer: previousTruePlayer } = this.getThisPlayer(true, true);

            this.#thisPlayer = player;

            if (truePlayer) {
                if (player === true)
                    this.#truePlayer = player;
                else
                    this.#truePlayer = player;
            }

            if (returnPreviousTruePlayer)
                return [previous, previousTruePlayer];
            else
                return previous;
        }
    }

    /**
     * Try and push a frame on to the stack if an ExecutionContext was passed
     * 
     * @param {IArguments} argsIn The raw arguments passed to the original function
     * @param {Partial<ExecutionFrame>} info Details about the method call location
     * @param {boolean} useCurrentIfNotPresent tryPushFrame will push a frame on the current context if (1) this is true, (2) no context was present in the arguments
     * @param {boolean} throwErrorIfNoContext If this method tries to use the current context and none is set, then throw an error
     * @returns {[ExecutionFrame?, ...any]}
     */
    static tryPushFrame(argsIn, info, useCurrentIfNotPresent = false, throwErrorIfNoContext = true) {
        /** @type {any[]} */
        let args = Array.prototype.slice.apply(argsIn);

        if (args[0] instanceof ExecutionContext) {
            /** @type {ExecutionContext} */
            const ecc = args.shift();
            return [ecc.pushFrameObject(info), ...args];
        }
        else {
            let frameResult = undefined;

            if (useCurrentIfNotPresent) {
                const ecc = currentExecution;
                if (ecc) {
                    frameResult = ecc.pushFrameObject(info);
                }
                else if (throwErrorIfNoContext)
                    throw new Error(`There is no active execution context for tryPushFrame(file: ${info.file}, method: ${info.method})`)
            }

            if (typeof args[0] === 'undefined') {
                args.shift();
                return [frameResult, ...args];
            }
            else {
                return [frameResult, ...args];
            }
        }
    }

    validSyncCall(filename, lineNumber, expr) {
        let ecc = ExecutionContext.getCurrentExecution(),
            frame = ecc && ecc.stack[0] || false;

        let result = expr();
        if (driver.efuns.isPromise(this, result)) {
            if (frame)
                throw new Error(`${frame.file}.${frame.method} [Line ${lineNumber}]; Call to must be awaited; e.g. await ${expr}`);
            else
                throw new Error(`All asyncronous method calls must be awaited`);
        }
        return result;
    }

    get virtualContext() {
        if (!this.virtualCreationContexts)
            return false;
        else
            return this.virtualCreationContexts[0];
    }

    /**
     * Wait for the completion of the context
     * @returns {Promise<string>} Returns the state of the context
     */
    async waitComplete() {
        return new Promise(resolve => {
            this.on('complete', (state) => resolve(state));
        });
    }

    /**
     * Adds a listener to the complete queue
     * @param {function(ExecutionContext):void} callback The callback to fire when execution is complete.
     */
    whenCompleted(callback) {
        this.onComplete.push(callback);
        return this;
    }

    /**
     * Start a new context and pass that context to a callback
     * @param {Partial<ExecutionFrame>} props The initial stack frame information
     * @param {function(ExecutionContext): any} callback The callback to execute
     */
    static async withNewContext(props, callback) {
        let [ecc, frame] = ExecutionContext.startNewContext(props);
        try {
            let result = await callback(ecc);
            return result;
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Perform an object with a particular object as the current / thisObject
     * @param {MUDObject} obj
     * @param {string} method
     * @param {any} callback
     * @param {any} isAsync
     * @param {any} rethrow
     * @returns
     */
    async withObject(obj, method, callback, isAsync = false, rethrow = true) {
        let frame = this.pushFrameObject({ method, object: obj, isAsync: true, callType: CallOrigin.Driver });
        try {
            let result = undefined;

            this.push(obj, method, obj.filename, isAsync, 0);
            if (callback.toString().startsWith('async'))
                result = await callback();
            else
                result = callback();

            return result;
        }
        catch (ex) {
            if (rethrow)
                throw ex;
            else
                console.log(`Error in ExecutionContext.withObject(): ${ex}\n${ex.stack}`);
        }
        finally {
            frame.pop();
        }
    }

    /**
     * Execute an action with an alternate thisPlayer
     * @param {MUDStorage} storage The player that should be "thisPlayer"
     * @param {function(import('./MUDObject'), ExecutionContext): any} callback The action to execute
     * @param {boolean} restoreOldPlayer Restore the previous player 
     */
    async withPlayerAsync(storage, callback, restoreOldPlayer = true, methodName = false, catchErrors = true) {
        let player = false;

        if (storage instanceof MUDObject)
            storage = driver.storage.get(player = storage);
        else
            player = storage.owner;

        let ecc = this,
            oldPlayer = this.setThisPlayer(player, true),
            oldClient = this.client,
            oldStore = this.storage,
            oldShell = this.shell;

        if (methodName)
            ecc.push(player, methodName, player.filename, true);

        try {
            this.client = storage.component || this.client;
            this.shell = storage.shell || this.shell;
            this.storage = storage || this.storage;

            return await callback(player, this);
        }
        catch (err) {
            if (catchErrors === false) throw err;
        }
        finally {
            if (methodName)
                ecc.pop(methodName);
            if (restoreOldPlayer) {
                if (oldPlayer)
                    this.setThisPlayer(oldPlayer, true);
                if (oldClient) this.client = oldClient;
                if (oldStore) this.storage = oldStore;
                if (oldShell) this.shell = oldShell;
            }
        }
    }
}

module.exports = { ExecutionContext, ExecutionFrame, CallOrigin, ExecutionSignaller };

