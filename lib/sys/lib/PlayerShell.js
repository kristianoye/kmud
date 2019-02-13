/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 9, 2019
 * 
 * The player command shell.  It executes commands and stores history.
 */
const
    BaseShell = require('./BaseShell');

class PlayerShell extends BaseShell {
    constructor(user) {
        super(user);

        register(':env', {
            HEALTH: () => user.health,
            MAXHEALTH: () => user.maxHealth,
            PERCENTHEALTH: () => {
                return (Math.max(0, user.health) / user.maxHealth) * 100.0;
            }
        });
        register('aliases', {
            down: 'go down',
            e: 'go east',
            east: 'go east',
            eq: 'equipment',
            exa: 'look at %*',
            i: 'inventory',
            in: 'go in',
            inv: 'inventory',
            l: 'look "%at %1"',
            n: 'go north',
            ne: 'go northeast',
            north: 'go north',
            northeast: 'go northeast',
            northwest: 'go northwest',
            nw: 'go northwest',
            s: 'go south',
            se: 'go southeast',
            south: 'go south',
            southeast: 'go southeast',
            southwest: 'go southwest',
            sw: 'go southwest',
            up: 'go up',
            w: 'go west',
            west: 'go west'
        });
        register('history', []);
        register(':historyNext', 0);
    }

    /** @type {Object.<string,string>} */
    protected get aliases() {
        return get('aliases');
    }

    /** @type {string[]} */
    protected get history() {
        return get('history');
    }

    protected historyNext() {
        let value = get(':historyNext');
        set(':historyNext', value + 1);
        return value;
    }

    /** @type {Object.<string,string|function>} */
    protected get environment() {
        return get(':env');
    }

    /**
     * Expands aliases in the command.
     * @param {string} input The user input.
     * @returns {string} The (possibly) modified user input.
     */
    protected expandAliases(input) {
        let [verb, text] = efuns.input.getVerb(input),
            alias = this.aliases[verb];
        if (alias) {
            //  Do substitutions...
            if (text.indexOf('%')) {
                let aliasText = efuns.input.splitArgs(alias),
                    args = efuns.input.splitArgs(text), ret = aliasText.shift();

                for (let i = 0, m = aliasText.length; i < m; i++) {
                    if (aliasText[i].charAt(0) === '%') {
                        if (aliasText[i].charAt(1) === '*') {
                            ret += ' ' + args.join(' ');
                        }
                        else {
                            let n = parseInt(aliasText[i].slice(1));
                            if (isNaN(n))
                                ret += ' ' + aliasText[i];
                            else if (args[n])
                                ret += ' ' + args[n];
                        }
                    }
                    else
                        ret += ' ' + aliasText[i];
                }
                return ret;
            }
            else
                text = alias + ' ' + text;
        }
        return input;
    }

    /**
     * Get an environmental variable
     * @param {string} varname The name of the variable to fetch
     */
    protected getenv(varname) {
        let env = get(':env'),
            val = env[varname] || '';
        if (typeof val === 'function') {
            val = val.apply(this.user);
        }
        return val;
    }

    /**
     * Expand history expressions
     * @param {text} input The user's input
     */
    protected expandHistory(input) {
        if (input.indexOf('!') > -1) {
            let args = efuns.input.splitArgs(input, true),
                history = this.history;
            for (let i = 0, m = args.length; i < m; i++) {
                if (args[i].startsWith('!')) {
                    let search = args[i].slice(1),
                        index = parseInt(search),
                        found = false;

                    if (isNaN(index)) {
                        for (let i = history.length - 1; i > -1; i--) {
                            if (history[i].startsWith(search)) {
                                args[i] = history[i], found = true;
                                break;
                            }
                        }
                    }
                    else if (history[index]) {
                        args[i] = history[index], found = true;
                    }
                    else {
                        throw Error(`-kmsh: ${args[i].trim()}: event not found`);
                    }
                }
                return args.join('');
            }
        }
        return input;
    }

    /**
     * Expands environment variables.
     * @param {string} text The input to process
     * @returns {string} Returns a string with all variables expanded.
     */
    protected expandVariables(text) {
        // Sequence contains no obvious tokens
        if (text.indexOf('$') === -1)
            return text;

        let i = 0,
            output = '',
            m = text.length,
            isEscaped = false,
            readVarName = () => {
                let x = i + 1;
                while (x < m && /^[a-zA-Z0-9]+/.test(text.charAt(x))) x++;
                return text.slice(i + 1, x);
            },
            env = this.environment;

        for (; i < m; i++) {
            let c = text.charAt(i);

            switch (c) {
                case '\\':
                    if (isEscaped)
                        output += c, isEscaped = false;
                    else
                        isEscaped = true;
                    break;

                case '$':
                    if (isEscaped)
                        output += c, isEscaped = false;
                    else {
                        let varName = readVarName();
                        i += varName.length;
                        if (env[varName]) {
                            if (typeof env[varName] === 'function')
                                output += env[varName].apply(this.user, efuns.input.splitArgs(text));
                            else
                                output += `${env[varName]}`;
                        }
                    }
                    break;

                default:
                    output += c, isEscaped = false;
                    break;
            }
        }
        return output;

    }

    /**
     * Process a command.
     * @param {string} text The raw user input.
     * @returns {MUDInputEvent} The input to execute.
     */
    protected processInput(text) {
        return super.processInput(text);
        return result;
    }

}

module.exports = PlayerShell;
