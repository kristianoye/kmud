/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 9, 2019
 *
 * The creator command shell.  It:
 *      - executes commands, 
 *      - stores command history, 
 *      - saves command history,
 *      - expands file expressions,
 *      - expand environmental variables,
 *      - allows I/O redirecting
 */
const
    Daemon = require('Daemon'),
    PlayerShell = require('./PlayerShell'),
    CommandResolver = efuns.loadObjectSync(Daemon.Command);

class CreatorShell extends PlayerShell {
    /**
     * Determines if the verb is a shell command
     * @param {string} verb The initial verb from the user
     * @returns {boolean} True if the command is a shell command
     */
    static isShellCommand(verb) {
        return true; // CommandResolver().isShellCommand(verb);
    }

    static expandFileExpression(expr, workingDir) {

    }

    static expandVariables(input) {

    }

    static makeCommand(evt, chunk) {
        let requiresStack
    }

    /**
     * Process user input and return the user input
     * @param {MUDInputEvent} evt The user's original input event
     */
    processInput(evt) {
        //  Check to see if the initial verb is a shell/filesystem command
        if (CreatorShell.isShellCommand(evt.verb)) {
            return CreatorShell.makeCommands(evt)
        }
        return [evt];
    }

    /**
     * Splits user inputs into arguments.
     * @param {MUDInputEvent} evt The original user input to split up
     * @returns {MUDInputEvent[]} One or more command events
     */
    protected static makeCommands(evt) {
        let current = Object.assign({}, evt),
            player = thisPlayer(),
            cmds = [],
            fileMode = '',
            text = evt.original.slice(0),
            i = 0, o = 0, s = 0,
            m = text.length,
            words = [],
            eatWhitespace = () => {
                let ws = '';
                while (i < m && /\s+/.test(text.charAt(i))) ws += text.charAt(i++);
                return ws.length;
            },
            finishCommand = () => {
                current.verb = words.shift();
                current.args = words;
                current.error = `What? (not recognized: ${current.verb})`;
                current.original = evt.original.slice(s, o);
                current.input = current.original.slice(current.verb.length).trim();

                if (current.verb) cmds.push(current);

                current = Object.assign({}, evt, {
                    verb: '',
                    original: '',
                    args: []
                });
                words = [];
                s = ++o;
            },
            readVarName = () => {
                let x = i + 1;
                while (x < m && /^[a-zA-Z0-9]+/.test(text.charAt(x))) x++;
                return text.slice(i + 1, x);
            },
            readWord = () => {
                let word = '',
                    isFileExpression = false,
                    inQuotes = false,
                    escaped = false,
                    done = false;

                for (o += eatWhitespace(); i < m; i++) {
                    let c = text.charAt(i);
                    switch (c) {
                        case '"': // Quote - start or end a phrase
                            o++;
                            if (escaped)
                                word += '"', escaped = false;
                            else
                                inQuotes = !inQuotes;
                            break;

                        case '\\': // Escape Slash - next character is literal
                            o++;
                            if (escaped)
                                word += '\\', escaped = false;
                            else
                                escaped = true;
                            break;

                        case '$': // Dollar sign - Shell variable
                            if (escaped)
                                word += '$', escaped = false;
                            else {
                                // Locate and expand shell env variable
                                let varName = readVarName(),
                                    varValue = player.getenv(varName);
                                o += varName.length;
                                if (varValue) {
                                    text = text.slice(0, i) + varValue + text.slice(i + varName.length + 1);
                                    m = text.length;
                                    i--;
                                }
                            }
                            break;

                        case '?':
                        case '*': // wildcard expansion
                            o++;
                            if (escaped)
                                word += c;
                            else {
                                // Finish building expression and expand into filenames...
                                isFileExpression = true;
                                word += c;
                            }
                            break;

                        case '>':
                        case '<':
                        case '&':
                        case '|':
                            o++;

                        case ';':
                            if (escaped) {
                                escaped = false;
                                word += c;
                            }
                            else {
                                i--; // rewind
                                done = true;
                            }
                            break;

                        default:
                            o++;
                            if (/\s/.test(c) && !escaped && !inQuotes) {
                                done = true;
                            }
                            else {
                                word += c;
                                escaped = false;
                            }
                            break;
                    }
                    if (done) break;
                }
                if (inQuotes)
                    throw new Error(`Undeterminated quotes after ${word}`);
                if (isFileExpression) {
                    let pathExp = efuns.join(player.workingDirectory, word),
                        files = efuns.readDirectorySync(pathExp);
                    return files;
                }
                return word;
            };

        for (; i < m; i++) {
            o += eatWhitespace();
            let c = text.charAt(i);
            switch (c) {
                //  Open a stream as STDIN
                case '<':
                    break;

                // Handle direct to alternate streams
                case '1':
                case '2':
                case '&':
                case '>':
                    if (!fileMode || c !== '>')
                        o++, word += c;
                    else {
                        if (text.charAt(i + i) === '>') {
                            o++, i++ , fileMode = c + '>';
                            if (text.charAt(i + 2) === '>') {
                                o++, i++ , fileMode += '>';
                            }
                            let fileName = readWord();
                            switch (fileMode) {
                                case '1>':
                                case '>':
                                case '1>>':
                                    // Redirect stdout
                                    break;

                                case '2>':
                                case '2>>':
                                    //  Redirect stderr
                                    break;

                                case '&>':
                                case '&>>':
                                    //  Redirect both stdout/stderr
                                    break;
                            }
                        }
                        else
                            word += c;
                    }
                    break;

                case ';':
                    ++i;
                    finishCommand();
                    --i;
                    break;

                //  Stack command
                case '|':
                    o++;
                    break;

                //  Run in background?  Not at the moment.
                case '&':
                    throw new Error(`You cannot currently run background jobs.`);
                    break;

                default:
                    let w = readWord();
                    if (Array.isArray(w))
                        words.push(...w);
                    else if (w)
                        words.push(w);
                    break;
            }
        }

        finishCommand();

        return cmds;
    } 
}

CreatorShell.prototype.$friends = ['/base/Creator'];

module.exports = CreatorShell;
