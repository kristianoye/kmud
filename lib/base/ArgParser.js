/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 * 
 * Utility class for parsing command line options
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

        this.defaultValue = opt.defaultValue;

        /** @type {string} */
        this.description = opt.description || '[No description]';

        /** @type {string} */
        this.dosSwitch = opt.dosSwitch;

        /** @type {string} */
        this.longSwitch = opt.longSwitch;

        /** @type {string} */
        this.name = opt.name || opt.switches.join(', ');

        this.owner = owner;

        /** @type {ParameterArg[]}*/
        this.parameters = [];

        this.parameterCount = 0;

        /** @type {boolean} */
        this.required = opt.required === true;

        /** @type {number} */
        this.sets = opt.sets;

        /** @type {string} */
        this.shortSwitch = opt.shortSwitch;

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
            this.longSwitch = f;
        else if (f.charAt(0) === '-' && f.length === 2)
            this.shortSwitch = f;
        else if (f.charAt(0) === '/' && f.length === 2)
            this.dosSwitch = f;

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
            this.parameterHash[varname] = values;
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

        result += `{0:-${optionWidth}}{1}`.fs(this.getSwitchString(), this.description);

        if (this.defaultValue) {
            parts.push(`default: "${this.defaultValue}"`);
        }
        if (Array.isArray(this.validValues) && this.validValues.length) {
            let vals = this.validValues.map(s => `"${s}"`).join(', ');
            parts.push(`choices: ${vals}`)
        }
        if (parts.length > 0)
            result += ' (' + parts.join(', ') + ')';

        return result;
    }

    getSwitchString() {
        let parts = [], result = '';

        if (this.shortSwitch)
            parts.push(this.shortSwitch);
        if (this.longSwitch)
            parts.push(this.longSwitch);
        if (this.dosSwitch)
            parts.push(this.dosSwitch);

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
        return (this.longSwitch === name || this.dosSwitch === name || this.shortSwitch === name);
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

        return inc;
    }

    /**
     * 
     * @param {string} text
     * @param {number} pos
     * @returns{ParameterArg[]}
     */
    static parseVariables(text, pos = 0) {
        let re = /\<(?<varname>(?:\.\.\.)?[a-zA-Z_][a-zA-Z0-9_]+)((:(?<defaultValue>[^>]+))?\>(?<optional>\?)?)/g,
            m = re.exec(text);
        /** @type {ParameterArg[]} */
        let results = [];

        while (m) {
            let { varname, defaultValue, optional } = m.groups,
                isVarargs = varname.startsWith('...');

            if (isVarargs)
                varname = varname.slice(3);

            results.push({
                name: varname,
                defaultFriendly: defaultValue,
                defaultValue: defaultValue || isVarargs ? [] : undefined,
                index: pos++,
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
            dosSwitches: {},
            longSwitches: {},
            shortSwitches: {},
            verbs: [],
            version: '1.0'
        }, optionsIn);

        /** @type {{ name: string, defaultDescription: string, defaultValue: any, isArray: boolean, required: boolean }[]} */
        this.arguments = config.arguments || [];

        /**
         * The people who created the command 
         * @type {string[]} 
         */
        this.author = config.author;

        /**
         * Temprary storage for unused argumennts
         * @type {string[]}
         */
        this.bucket = [];

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

        /** @type {Object.<string,ArgSwitch>} */
        this.dosSwitches = config.dosSwitches;

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
        let opt = new ArgSwitch(this, optData),
            checkExisting = this.switches.forEach(s => {
                if (opt.shortSwitch && s.shortSwitch === opt.shortSwitch)
                    throw new Error(`Switch ${opt.shortSwitch} is already defined!`);
                else if (opt.longSwitch && s.longSwitch === opt.longSwitch)
                    throw new Error(`Switch ${opt.longSwitch} is already defined!`);
                else if (opt.dosSwitch && s.dosSwitch === opt.dosSwitch)
                    throw new Error(`Switch ${opt.longSwitch} is already defined!`);
            });

        this.switches.push(opt);

        if (opt.dosSwitch)
            this.dosSwitches[opt.dosSwitch] = opt;
        if (opt.longSwitch)
            this.longSwitches[opt.longSwitch] = opt;
        if (opt.shortSwitch)
            this.shortSwitches[opt.shortSwitch] = opt;
        return this;
    }

    buildHelp() {
        let helpText = '';

        for (const verb of this.verbs) {
            helpText += `Usage: ${verb} `;
            if (this.switches.length > 0)
                helpText += '[options]... ';
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

        return this;
    }

    findSwitch(name) {
        let result = this.switches.find(s => {
            return (s.longSwitch === name || s.dosSwitch === name || s.shortSwitch === name);
        });

        return result || false;
    }

    /**
     * Parse the command line arguments and return the final result or an error
     * @param {{ verb: string, args: string[] }} data
     * @param {boolean} ignoreUnknownSwitches
     */
    async parse(data, ignoreUnknownSwitches=false) {
        let result = this.prepareResult({}),
            argBuffer = [],
            verb = data.verb;

        for (let i = 0, m = data.args.length; i < m; i++) {
            let argText = data.args[i];

            if (argText.startsWith('--')) {
                let arg = this.longSwitches[argText]
                if (arg) {
                    let parseResult = await arg.parse(data.verb, data.args.slice(i), result);
                    if (typeof parseResult !== 'number')
                        return parseResult;
                    else
                        i += parseResult;
                }
                else {
                    if (ignoreUnknownSwitches)
                        continue;
                    else
                        return `${data.verb}: Unknown switch: ${arg}`;
                }
            }
            else if (argText.charAt(0) === '/' || argText.charAt(0) === '-') {
                let flags = argText.slice(1).split('').map(s => `${argText.charAt(0)}${s}`);

                for (const flag of flags) {
                    let arg = argText.charAt(0) === '-' ? this.shortSwitches[flag] : this.dosSwitches[flag];
                    if (arg) {
                        let parseResult = await arg.parse(data.verb, data.args.slice(i), result);
                        if (typeof parseResult !== 'number')
                            return parseResult;
                        else
                            i += parseResult;
                    }
                    else {
                        if (ignoreUnknownSwitches)
                            continue;
                        else
                            return `${data.verb}: Unknown switch: ${arg}`;
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
                let parm = this.arguments[i];

                if (parm.isArray) {
                    let chunk = argBuffer;

                    if (parm.minCount && chunk.length < parm.minCount)
                        return `${verb}: ${switchUsed}: Argument ${parm.name} requires at least ${parm.minCount} values`;
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
            }
        }
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
}