/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: March 11, 2024
 */
import { LIB_SHELLCMD } from 'Base';
import ShellCommand from LIB_SHELLCMD;

const
    Options = {
        ShowLineNumbers: 1 << 0,
        ShowNonBlankLineNumbers: 1 << 1,
        ShowEndOfLine: 1 << 2,
        ShowNonPrinting: 1 << 5,
        ShowTabs: 1 << 3,
        SqueezeBlanks: 1 << 4,
        All: 1 << 2 | 1 << 3 | 1 << 5
    };

class CatOutput {
    /**
     * Construct a new output object
     * @param {number} options
     */
    constructor(options) {
        this.options = options;
    }

    get buffer() {
        return get([]);
    }

    set buffer(lines) {
        set(lines);
    }

    get lastLineWasBlank() {
        return get(false);
    }

    set lastLineWasBlank(flag) {
        set(flag);
    }

    get lineNumber() {
        return get(1);
    }

    set lineNumber(ln) {
        set(ln);
    }

    get options() {
        return get(0);
    }

    set options(flags) {
        set(flags);
    }

    get showEndOfLine() {
        return (this.options & Options.ShowEndOfLine) > 0;
    }

    get showLineNumbers() {
        return (this.options & Options.ShowLineNumbers) > 0;
    }

    get showNonblankLineNumbers() {
        return (this.options & Options.ShowNonBlankLineNumbers) > 0;
    }

    get showNonPrinting() {
        return (this.options & Options.ShowNonPrinting) > 0;
    }

    get showTabs() {
        return (this.options & Options.ShowTabs) > 0;
    }

    get squeezeBlanks() {
        return (this.options & Options.SqueezeBlanks) > 0;
    }

    /**
     * Append a line to the output buffer
     * @param {string[]} lines
     */
    addLines(...lines) {
        for (const s of lines) {
            let outputLine = '';
            if (this.lastLineWasBlank && this.squeezeBlanks) {
                if (s.trim())
                    return;
            }
            this.lastLineWasBlank = s.trim().length === 0;
            if (this.showNonblankLineNumbers) {
                if (!this.lastLineWasBlank) {
                    outputLine = '{0,6}  {1}'.fs(this.lineNumber++, s);
                }
                else
                    outputLine = s;
            }
            else if (this.showLineNumbers) {
                outputLine = '{0,6}  {1}'.fs(this.lineNumber++, s);
            }
            else
                outputLine = s;

            if (this.showEndOfLine) {
                outputLine += '$';
            }
            if (this.showTabs) {
                outputLine = outputLine.replace(/\t/g, '^I');
            }
            this.buffer.push(outputLine);
        }
    }

    /**
     * Write all lines to STDOUT
     * @returns {boolean} Returns true when complete
     */
    writeToStdout() {
        for (const line of this.buffer) {
            writeLine(line);
        }
        return true;
    }
}

export default final singleton class CatCommand extends ShellCommand {
    /**
     * Run the clone command
     * @param {string} txt
     * @param {MUDInputEvent} evt
     */
    override async cmd(txt, cmdline) {
        let files = [],
            options = 0,
            args = cmdline.args;

        for (let i = 0, m = args.length; i < m; i++) {
            let arg = args[i];

            if (arg.length === 1 && arg.charAt(0) === '-') {
                files.push('-');
            }
            else if (arg.charAt(0) === '-') {
                switch (arg.slice(1)) {
                    case '-help':
                        return this.showHelp(cmdline.verb);

                    case '-number':
                        options |= Options.ShowLineNumbers;
                        break;

                    case '-number-nonblank':
                        options |= Options.ShowNonBlankLineNumbers;
                        break;

                    case '-show-all':
                        options |= Options.All;
                        break;

                    case '-show-ends':
                        options |= Options.ShowEndOfLine;
                        break;

                    case '-show-nonprinting':
                        break;

                    case '-show-tabs':
                        options |= Options.ShowTabs;
                        break;

                    case '-squeeze-blank':
                        options |= Options.SqueezeBlanks;
                        break;

                    case '-version':
                        return writeLine(this.getVersion(cmdline.verb));

                    default:
                        if (arg.charAt(1) === '-')
                            return `${cmdline.verb}: Unknown switch: ${arg}`;
                        else {
                            let flags = arg.slice(1).split('');
                            for (const flag of flags) {
                                switch (flag) {
                                    case 'A':
                                        options |= Options.All;
                                        break;
                                    case 'b':
                                        options |= Options.ShowNonBlankLineNumbers;
                                        break;
                                    case 'e':
                                        options |= Options.ShowNonPrinting | Options.ShowEndOfLine;
                                        break;
                                    case 'E':
                                        options |= Options.ShowEndOfLine;
                                        break;
                                    case 'n':
                                        options |= Options.ShowLineNumbers;
                                        break;
                                    case 's':
                                        options |= Options.SqueezeBlanks;
                                        break;
                                    case 'T':
                                        options |= Options.ShowTabs;
                                        break;
                                    case 'u':
                                        break;
                                    case 'v':
                                        options |= Options.ShowNonPrinting;
                                        break;
                                    default:
                                        return `${cmdline.verb}: Unknown flag: ${flag}`;
                                }
                            }
                        }
                        break;
                }
            }
            else {
                files.push(arg);
            }
        }

        if (files.length === 0)
            files.push('-');

        let lineBuffer = await createAsync(CatOutput, options);

        for (const file of files) {
            if (file === '-') {
                if (stdin) {
                    let line = stdin.readLine();
                    while (line) {
                        lineBuffer.addLines(line);
                        line = stdin.readLine();
                    }
                }
            }
            else {
                try {
                    let
                        fpath = efuns.resolvePath(file, thisPlayer().workingDirectory),
                        fso = await efuns.fs.getObjectAsync(fpath);

                    if (!fso.exists)
                        errorLine(`${cmdline.verb}: ${file}: No such file or directory`);
                    else if (fso.isDirectory)
                        errorLine(`${cmdline.verb}: ${file}: Is a directory`);
                    else {
                        let rawText = await fso.readFileAsync(),
                            lines = rawText.split(/[\r]*[\n]{1}/);
                        lineBuffer.addLines(...lines);
                    }
                }
                catch (err) {
                    errorLine(`${cmdline.verb}: ${err}`);
                }
            }
        }
        return lineBuffer.writeToStdout();
    }

    showHelp(verb) {
        return writeLine(`
Usage: ${verb} [OPTION]... [FILE]...
Concatenate FILE(s) to standard output.

With no FILE, or when FILE is -, read standard input.

  -A, --show-all           equivalent to -vET
  -b, --number-nonblank    number nonempty output lines, overrides -n
  -e                       equivalent to -vE
  -E, --show-ends          display $ at end of each line
  -n, --number             number all output lines
  -s, --squeeze-blank      suppress repeated empty output lines
  -t                       equivalent to -vT
  -T, --show-tabs          display TAB characters as ^I
  -u                       (ignored)
  -v, --show-nonprinting   use ^ and M- notation, except for LFD and TAB
      --help     display this help and exit
      --version  output version information and exit

`);
    }
}

