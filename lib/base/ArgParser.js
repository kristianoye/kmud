/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * Utility class for parsing command line options
 */

/**
 * @typedef {Object} ParameterArg
 * @property {string[]} [choices] Acceptable values for this parameter
 * @property {string} defaultFriendly Friendly version of defaultValue to display to user in help
 * @property {string} defaultValue The default value if the parameter is not explicitly set
 * @property {string} displayName The name to display in the help text
 * @property {number} index
 * @property {boolean} isArray Is this an array?
 * @property {number} [maxCount] The maximum number of items if an array
 * @property {number} [minCount] The mininum number of items if an array
 * @property {string} name The name of the parameter
 * @property {boolean} optional Is the argument optional?
 * @property {string[]} [options] Valid settings for this parameter
 * @property {boolean} required Is the argument required?  Inverse of optional
 */

class ArgSwitch extends SimpleObject {
    /**
     * Create a command flag
     * @param {ArgParser} owner
     * @param {Partial<ArgSwitch>} opt
     */
    create(owner, opt) {
        /**
         * Perform an action
         * @type {function(string):boolean}
         */
        this.action = opt.action;

        /**
         * The name of the bitflag variable if applicable
         * @type {string}
         */
        this.bitflag = opt.bitflag;

        /** @type {number} */
        this.clears = opt.clears;

        /** @type {string} */
        this.copyTo = opt.copyTo;

        this.defaultValue = opt.defaultValue;

        /** @type {string} */
        this.description = opt.description || '[No description]';

        /** @type {string} */
        this.longSwitch = opt.longSwitch && opt.longSwitch.trim();

        /** @type {string} */
        this.name = opt.name || 'unknown';

        this.owner = owner;

        /** @type {ParameterArg[]}*/
        this.parameters = [];

        this.parameterCount = 0;

        /** @type {boolean} */
        this.required = opt.required === true;

        /** @type {number} */
        this.sets = opt.sets;

        /** @type {string} */
        this.shortSwitch = opt.shortSwitch && opt.shortSwitch.trim();

        /** @type {string[]} */
        this.switches = opt.switches;

        if (typeof opt.switches === 'string') {
            this.switches = opt.switches.split(',').map(s => s.trim());
        }
        if (!Array.isArray(this.switches))
            this.switches = [];

        this.switches.forEach(flag => this.addSwitch(flag));

        /**
         * Transform a parameter to an output value
         * @type {function(string,string,number):boolean | string}
         */
        this.transform = opt.transform;

        /**
         * Validate a parameter
         * @type {function(string,string,number):boolean | string}
         */
        this.validator = opt.validator;

        /**
         * Vadlid options for this arg
         * @type {string[]}
         */
        this.validValues = opt.validValues;

        if ((this.sets || this.clears) && !this.bitflag)
            this.bitflag = 'bitflags';
    }

    /**
     * Add a switch/option
     * @param {string} flag
     * @returns
     */
    addSwitch(flag) {
        let n = flag.search(/\s/),
            f = n > -1 ? flag.slice(0, n + 1) : flag

        if (f.startsWith('--'))
            this.longSwitch = f.trim();
        else if (f.charAt(0) === '-' && f.length === 2)
            this.shortSwitch = f.trim();

        let variables = ArgSwitch.parseVariables(flag, this.parameterCount);

        /**
         * @type {Object.<string,ParameterArg>}
         */
        this.parameterHash = {};

        for (const parm of variables) {
            if (!this.hasParameter(parm.name)) {
                this.parameters.push(parm);
                this.parameterHash[parm.name] = parm;
                this.parameterCount++;
            }
        }
        return this;
    }

    /**
     * Set the valid inputs for this arg
     * @param {string} varname
     * @param {...string} values
     * @returns
     */
    choices(varname, ...values) {
        if (varname in this.parameterHash)
            this.parameterHash[varname].choices = values;
        return this;
    }

    default(varname, val, desc) {
        if (varname in this.parameterHash) {
            this.parameterHash[varname].defaultValue = val;
            this.parameterHash[varname].defaultFriendly = desc || val;
        }
        return this;
    }

    getHelpString(optionWidth) {
        let parts = [], result = '';

        result += `\t{0:-${optionWidth}}\n\t\t{1}`.fs('%^BOLD%^' + this.getSwitchString() + '%^RESET%^', this.description);

        for (const parm of this.parameters) {
            if (parm.defaultFriendly) {
                parts.push(`${parm.displayName} defaults to ${parm.defaultFriendly}`);
            }
            else if (parm.defaultValue) {
                parts.push(`${parm.displayName} defaults to ${parm.defaultValue}`);
            }
            if (parm.choices) {
                let vals = parm.choices.map(s => `"${s}"`).join(', ');
                parts.push(`choices for ${parm.displayName}: ${vals}`)
            }
        }
        if (parts.length > 0)
            result += ' (' + parts.join(', ') + ')';

        return result + '\n';
    }

    getSwitchString() {
        let parts = [], result = '';

        if (this.shortSwitch)
            parts.push(this.shortSwitch);
        if (this.longSwitch)
            parts.push(this.longSwitch);

        result += parts.join(', ');

        for (const p of this.parameters) {
            result += ` <${p.name}>`;
        }
        return result;
    }

    hasParameter(name) {
        return name in this.parameterHash;
    }

    hasSwitch(name) {
        return (this.longSwitch === name || this.shortSwitch === name);
    }

    /**
     * Parse command line data and set results
     * @param {string} verb
     * @param {string[]} args
     * @param {Object.<string,any>} result
     * @returns {number}
     */
    async parse(verb, args, result) {
        let switchUsed = args.shift();
        /** @type {string[]} */
        let arrayBuffer = [],
            arrayBufferAvailableCount = 0;

        /**
         * 
         * @param {string} s
         * @returns
         */
        let isSwitch = (s) => {
            return s.charAt(0) === '-' || s.charAt(0) === '/';
        };
        let transform = async (name, val, index) => {
            if (typeof this.transform === 'function') {
                return await this.transform(name, val, index);
            }
            return val;
        };
        let validate = async (name, val, index) => {
            if (typeof this.validator === 'function') {
                return await this.validator(name, val, index);
            }
            return true;
        };
        let inc = 0;

        if (this.sets) {
            result[this.bitflag] |= this.sets;
        }

        if (this.clears) {
            result[this.bitflag] &= ~this.clears;
        }

        if (this.parameterCount === 0 && !this.bitflag)
            result[this.name] = true;

        for (let i = 0; i < this.parameterCount; i++) {
            let parm = this.parameters[i];

            if (parm.isArray) {
                let nextSwitch = args.findIndex(isSwitch),
                    chunk = args.slice(0, nextSwitch > -1 ? nextSwitch : undefined);

                if (parm.minCount && chunk.length < parm.minCount)
                    return `${verb}: ${switchUsed}: Argument ${parm.name} requires at least ${parm.minCount} values`;
                if (parm.maxCount && chunk.length > parm.maxCount)
                    arrayBuffer = result[parm.name] = chunk.slice(0, parm.maxCount);
                else
                    arrayBuffer = result[parm.name] = chunk.slice(0);

                let argsUsed = result[parm.name].length;

                arrayBufferAvailableCount = argsUsed - (parm.minCount || 0);
                inc += argsUsed;
                args.splice(0, argsUsed);
            }
            else if (args.length > 0) {
                result[parm.name] = await transform(parm.name, args.shift(), parm.index);
                inc++;
            }
            else if (arrayBuffer.length && arrayBufferAvailableCount > 0) {
                result[parm.name] = await transform(parm.name, arrayBuffer.pop(), parm.index);
                arrayBufferAvailableCount--;
            }
            else if (parm.required) {
                if (parm.defaultValue)
                    result[parm.name] = await transform(parm.name, parm.defaultValue, parm.index);
                else
                    return `${verb}: ${switchUsed}: Argument ${parm.name} is required to have a value`;
            }
            else {
                if (parm.defaultValue)
                    result[parm.name] = await transform(parm.name, parm.defaultValue, parm.index);
                else {
                    result[parm.name] = undefined;
                    continue;
                }
            }
            if (parm.choices && parm.choices.length > 0) {
                if (parm.choices.indexOf(result[parm.name]) === -1) {
                    let validOptions = parm.choices.map(s => `"${s}"`).join(', ');
                    return `${verb}: ${switchUsed}: '${result[parm.name]}' is not valid for argument ${parm.name}; Options are: ${validOptions}`;
                }
            }
        }

        for (let parm of this.parameters) {
            if (parm.isArray) {
                result[parm.name] = await transform(parm.name, result[parm.name], parm.index);
            }
            let test = await validate(parm.name, result[parm.name], parm.index);
            if (test !== true) {
                if (test === false)
                    return `${verb}: ${switchUsed}: '${result[parm.name]}' is not valid for argument ${parm.name}`;
                else
                    return test;
            }
        }

        if (typeof this.action === 'function') {
            let actionResult = await this.action(verb, result);
            if (typeof actionResult === 'string' || typeof actionResult === 'boolean')
                return actionResult;
        }

        if (this.copyTo) {
            let copyList = this.copyTo.split(',').map(s => s.trim());
            for (const copyItem of copyList) {
                let [target, source] = copyItem.split('=');

                result[target] = result[source];
                result['__meta__'][`isset:${target}`] = typeof result[target] !== 'undefined';
            }
        }

        return inc;
    }

    /**
     * 
     * @param {string} text
     * @param {number} pos
     * @returns {ParameterArg[]}
     */
    static parseVariables(text, pos = 0) {
        let re = /\<(?<varname>[a-zA-Z_][a-zA-Z0-9_\(\)]+(?:\.\.\.)?)((:(?<defaultValue>[^>\?\|]+))?(\|(?<choices>[a-zA-Z0-9\|\s]+))?(?<optional>\?)?\>)/g,
            m = re.exec(text);
        /** @type {ParameterArg[]} */
        let results = [];

        while (m) {
            let { varname, defaultValue, choices, optional } = m.groups,
                isVarargs = varname.endsWith('...'),
                displayName = `<${varname}${(optional ? '?' : '')}>`;

            if (isVarargs)
                varname = varname.slice(0, -3);

            results.push({
                name: varname.replace(/[^a-zA-Z0-9_]/g, '').trim(),
                choices: choices && choices.split('|').map(s => s.trim()),
                defaultFriendly: defaultValue,
                defaultValue: defaultValue || (isVarargs ? [] : undefined),
                displayName,
                index: pos++,
                minCount: !optional ? 1 : 0,
                isArray: isVarargs,
                optional: !!optional,
                required: !optional,
                validValues: false
            });
            m = re.exec(text);
        }
        return results;
    }

    /**
     * Prepare a command result
     * @param {Object.<string,any>} result
     */
    prepareResult(result) {
        for (const p of this.parameters) {
            result[p.name] = p.defaultValue;
        }
        if (this.bitflag && this.bitflag in result === false) {
            result[this.bitflag] = 0;
        }
        return result;
    }

    setAction(action) {
        this.action = action;
        return this;
    }

    setTransform(func) {
        this.transform = func;
        return this;
    }

    setValidator(func) {
        this.validator = func;
        return this;
    }
}

export default class ArgParser extends SimpleObject {
    /**
     * 
     * @param {Partial<ArgParser>} optionsIn
     */
    create(optionsIn) {
        /**
         * @type {Partial<ArgParser>}
         */
        let config = Object.assign({
            author: [],
            description: '[No description]',
            longSwitches: {},
            shortSwitches: {},
            verbs: [],
            version: '1.0'
        }, optionsIn);

        /** @type {{ name: string, defaultDescription: string, defaultValue: any, isArray: boolean, required: boolean }[]} */
        this.arguments = config.arguments || [];

        /** @type {Object.<string,function(any, string[])>} */
        this.fillers = {};

        /**
         * The people who created the command 
         * @type {string[]} 
         */
        this.author = config.author;

        /**
         * @type {string}
         */
        this.bitflag = config.bitflag || 'bitflags';

        /**
         * @type {string}
         */
        this.copyright = '';

        /**
         * The name of the variable that will hold unassigned parameters
         */
        this.defaultBucket = config.defaultBucket || 'extraParameters';

        /** @type {string} */
        this.description = config.description || '[No description]';

        /** @type {string} */
        this.filename = config.filename;
        if (!this.filename) {
            let po = efuns.previousObject(),
                fn = po && po.fullPath || undefined;
            this.filename = fn;
        }

        /** @type {string} */
        this.helpText = '';

        /** @type {Object.<string,ArgSwitch>} */
        this.longSwitches = config.longSwitches;

        /** @type {Object.<string,ArgSwitch>} */
        this.shortSwitches = config.shortSwitches;

        /**
         *  All switches 
         * @type {ArgSwitch[]}
         */
        this.switches = [];

        /** @type {string[]} */
        this.verbs = config.verbs;

        /** @type {string[]} */
        this.version = config.version;
    }

    /**
     * Add arguments to the command
     * @param {string} arg The arg text to parse
     * @returns
     */
    addArgument(arg) {
        let variables = ArgSwitch.parseVariables(arg),
            hasOptional = false,
            hasVarargs = false;

        if (variables.length === 0) {
            throw new Error(`Invalid argument name: ${arg}`);
        }
        for (const parm of this.arguments) {
            hasVarargs |= parm.isArray;
            hasOptional |= !parm.required;
        }
        for (const parm of variables) {
            if (!parm.required && hasVarargs) {
                throw new Error(`Argument '${parm.name}' must be required since it follows an ellipsis`);
            }
            else if (parm.required && hasOptional) {
                throw new Error(`Argument '${parm.name}' cannot be required if it follows an optional argument`);
            }
            hasVarargs |= parm.isArray;
            hasOptional |= !parm.required;
            this.arguments.push(parm);
        }

        return this;
    }

    addFiller(argName, callback) {
        if (this.getArgument(argName)) {
            this.fillers[argName] = callback;
        }
        else
            throw new Error(`Command does not take agument named ${argName}`);
        return this;
    }

    /**
     * Add an option switch
     * @param {ArgSwitch | string} optData
     * @param {string} description
     * @param {any} defaultValue
     * @returns
     */
    addOption(optData, description = undefined, defaultValue = undefined) {
        if (typeof optData === 'string') {
            optData = { switches: optData };
            if (typeof description === 'string')
                optData.description = description;
            else if (typeof description === 'object')
                optData = Object.assign(optData, description);
            if (typeof defaultValue === 'string')
                optData.defaultValue = defaultValue;
            else if (typeof defaultValue === 'object')
                optData = Object.assign(optData, defaultValue);
        }

        optData.bitflag = optData.bitflag || this.bitflag;

        let opt = new ArgSwitch(this, optData),
            checkExisting = this.switches.forEach(s => {
                if (opt.shortSwitch && s.shortSwitch === opt.shortSwitch)
                    throw new Error(`Switch ${opt.shortSwitch} is already defined!`);
                else if (opt.longSwitch && s.longSwitch === opt.longSwitch)
                    throw new Error(`Switch ${opt.longSwitch} is already defined!`);
            });

        this.switches.push(opt);

        if (opt.longSwitch)
            this.longSwitches[opt.longSwitch] = opt;
        if (opt.shortSwitch)
            this.shortSwitches[opt.shortSwitch] = opt;
        return this;
    }

    buildHelp() {
        let helpText = '', argText = '';

        for (const arg of this.arguments) {
            argText += ' ' + arg.displayName;
        }

        for (const verb of this.verbs) {
            helpText += `Usage: ${verb}`;
            if (this.switches.length > 0)
                helpText += ' [options]...';
            if (argText.length > 0)
                helpText += argText;
            helpText += '\n';
        }


        helpText += '\n\n';

        if (this.description)
            helpText += this.description + '\n\n';

        if (this.switches.length > 0) {
            let longest = 0;

            helpText += 'Options:' + '\n\n';

            for (const arg of this.switches) {
                longest = Math.max(longest, arg.getSwitchString().length);
            }
            longest += 2;
            for (const arg of this.switches) {
                helpText += arg.getHelpString(longest) + '\n';
            }
        }
        return helpText;
    }

    /**
     * Finish the command building process
     * @returns
     */
    complete() {
        let verOpt = new ArgSwitch(this, { name: 'version', description: 'Show program version information' }),
            helpOpt = new ArgSwitch(this, { name: 'help', description: 'Show this helpful text' }),
            addVersion = false,
            addHelp = false;

        for (const name of ['--version', '-V', '/V']) {
            if (!this.findSwitch(name)) {
                verOpt.addSwitch(name);
                addVersion = true;
            }
        }

        if (addVersion) {
            this.addOption(verOpt.setAction(() => this.showVersion(efuns.currentVerb)));
        }

        for (const name of ['--help', '-H', '/?']) {
            if (!this.findSwitch(name)) {
                helpOpt.addSwitch(name);
                addHelp = true;
            }
        }

        if (addHelp) {
            this.addOption(helpOpt.setAction(() => writeLine(this.helpText)));
        }

        this.helpText = this.buildHelp();
        this.completed = true;

        return this;
    }

    findSwitch(name) {
        let result = this.switches.find(s => {
            return (s.longSwitch === name || s.shortSwitch === name);
        });

        return result || false;
    }

    getArgument(argName) {
        return this.arguments.find(a => a.name === argName);
    }


    /**
     * Parse the command line arguments and return the final result or an error
     * @param {{ verb: string, args: string[] }} data
     * @param {boolean} ignoreUnknownSwitches
     */
    async parse(data, ignoreUnknownSwitches = false) {
        if (!data) {
            data = efuns.currentCommand;
        }
        if (!this.completed) {
            this.complete();
        }
        let result = this.prepareResult({ __meta__: {} }),
            argBuffer = [],
            verb = data.verb,
            args = data.args.slice(0);

        for (let i = 0; i < args.length; i++) {
            let argText = args[i];

            if (argText.startsWith('--')) {
                let n = argText.indexOf('=');
                if (n > -1) {
                    let arg = argText.slice(n + 1);

                    args[i] = argText = argText.slice(0, n);
                    args.splice(i + 1, 0, arg);
                }
                let arg = this.longSwitches[argText];

                if (arg) {
                    let parseResult = await arg.parse(verb, args.slice(i), result);
                    if (typeof parseResult !== 'number')
                        return parseResult;
                    else
                        i += parseResult;
                }
                else {
                    if (ignoreUnknownSwitches)
                        continue;
                    else
                        return `${verb}: Unknown switch: ${arg}`;
                }
            }
            else if (argText.charAt(0) === '-') {
                let flags = argText.slice(1).split('').map(s => `${argText.charAt(0)}${s}`);

                for (const flag of flags) {
                    let arg = this.shortSwitches[flag];
                    if (arg) {
                        let parseResult = await arg.parse(verb, args.slice(i), result);
                        if (typeof parseResult !== 'number')
                            return parseResult;
                        else
                            i += parseResult;
                    }
                    else {
                        if (ignoreUnknownSwitches)
                            continue;
                        else
                            return `${verb}: Unknown switch: ${arg}`;
                    }
                }
            }
            else
                argBuffer.push(argText);
        }
        let transform = async (name, val, index) => {
            if (typeof this.transform === 'function') {
                return await this.transform(name, val, index);
            }
            return val;
        };
        let validate = async (name, val, index) => {
            if (typeof this.validator === 'function') {
                return await this.validator(name, val, index);
            }
            return true;
        };
        if (this.arguments.length > 0) {
            let arrayBuffer = [],
                arrayBufferAvailableCount = 0;

            for (let i = 0; i < this.arguments.length; i++) {
                let parm = this.arguments[i],
                    isSet = result['__meta__'][`isset:${parm.name}`] === true,
                    filler = this.fillers[parm.name];

                if (typeof filler === 'function') {
                    let fillerResult = await filler(parm.defaultValue, argBuffer.slice(0));
                    if (typeof fillerResult !== 'undefined') {
                        result[parm.name] = fillerResult;
                        isSet = true;
                    }
                }

                if (isSet)
                    continue;
                else if (parm.isArray) {
                    let chunk = argBuffer;

                    if (parm.minCount && chunk.length < parm.minCount)
                        return `${verb}: Argument ${parm.name} requires at least ${parm.minCount} values`;
                    if (parm.maxCount && chunk.length > parm.maxCount)
                        arrayBuffer = result[parm.name] = chunk.slice(0, parm.maxCount);
                    else
                        arrayBuffer = result[parm.name] = chunk.slice(0);

                    let argsUsed = result[parm.name].length;

                    arrayBufferAvailableCount = argsUsed - (parm.minCount || 0);
                    inc += argsUsed;
                    argBuffer.splice(0, argsUsed);
                }
                else if (argBuffer.length > 0) {
                    result[parm.name] = await transform(parm.name, argBuffer.shift(), parm.index);
                    inc++;
                }
                else if (arrayBuffer.length && arrayBufferAvailableCount > 0) {
                    result[parm.name] = await transform(parm.name, arrayBuffer.pop(), parm.index);
                    arrayBufferAvailableCount--;
                }
                else if (parm.required) {
                    if (parm.defaultValue)
                        result[parm.name] = await transform(parm.name, parm.defaultValue, parm.index);
                    else
                        return `${verb}: Argument ${parm.name} is required to have a value`;
                }
                else {
                    if (parm.defaultValue)
                        result[parm.name] = await transform(parm.name, parm.defaultValue, parm.index);
                    else {
                        result[parm.name] = undefined;
                        continue;
                    }
                }
            }
        }
        delete result['__meta__'];

        result.hasFlag = (bits) => {
            let allBits = result[this.bitflag] || 0;
            return (allBits & bits) > 0;
        };
        result.hasFlags = (bits) => {
            let allBits = result[this.bitflag] || 0;
            return (allBits & bits) === bits;
        };
        result.notFlags = (bits) => {
            let allBits = result[this.bitflag] || 0;
            return (allBits & bits) === 0;
        };
        return result;
    }

    /**
     * Prepare a result object
     * @param {Object.<string,any>} result
     * @returns
     */
    prepareResult(result = {}) {
        for (const opt of this.switches) {
            opt.prepareResult(result);
        }
        for (const arg of this.arguments) {
            result[arg.name] = arg.defaultValue || (arg.isArray ? [] : undefined);
        }
        return result;
    }

    /**
     * Set the author(s)
     * @param {...string} auth The author(s)
     * @returns
     */
    setAuthor(...auth) {
        if (Array.isArray(auth))
            this.author = auth.filter(s => typeof s === 'string' && s.length > 0)
        return this;
    }

    /**
     * Sets the name of the bitflag variable in the result
     * @param {string} name
     * @returns
     */
    setBitflagBucketName(name) {
        this.bitflag = name;
        return this;
    }

    setCopyright(text) {
        if (typeof text === 'string')
            this.copyright = text;
        return this;
    }

    /**
     * Set the name of the variable that stores values not associated with an option
     * @param {string} name
     * @returns
     */
    setDefaultBucket(name) {
        this.defaultBucket = name;
        return this;
    }

    /**
     * Set the command description
     * @param {string} desc
     * @returns
     */
    setDescription(desc) {
        this.description = desc;
        return this;
    }

    setVerb(...name) {
        if (Array.isArray(name))
            this.verbs = name.filter(s => typeof s === 'string' && s.length > 0)
        return this;
    }

    setVersion(ver) {
        if (typeof ver === 'string' && ver.length)
            this.version = ver;
        return this;
    }

    showVersion(verb) {
        let text = efuns.eol + `${verb} ${this.version}` + efuns.eol;
        if (this.copyright) {
            text += efuns.eol + this.copyright;
        }
        if (this.author && this.author.length > 0) {
            text += efuns.eol + efuns.eol + `Written by ${this.author.join(', ')}`;
        }
        return writeLine(text);
    }

    /**
     * Execute a callback with the specified switch
     * @param {string} name
     * @param {function(ArgSwitch):void} func
     * @returns
     */
    with(name, func) {
        let parm = this.switches.find(s => s.name === name);
        if (parm) {
            func(parm);
        }
        return this;
    }
}