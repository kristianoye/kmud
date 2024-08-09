/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: March 11, 2024
 */
import { LIB_SHELLCMD } from '@Base';
import ShellCommand from LIB_SHELLCMD;

const
    CatFlags = efuns.fs.CatFlags,
    Options = CatFlags;

class CatOutput {
    /**
     * Construct a new output object
     * @param {number} options
     */
    create(options) {
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
                    outputLine = '{0,6}  '.fs(this.lineNumber++) + s;
                }
                else
                    outputLine = s;
            }
            else if (this.showLineNumbers) {
                outputLine = '{0,6}  '.fs(this.lineNumber++) + s
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
    protected override create() {
        super.create();
        this.verbs = ['cat', 'gc', 'get-content'];
        this.command
            .setVerb(...this.verbs)
            .setBitflagBucketName('catFlags')
            .setDescription('Concatenate FILE(s) to standard output.  With no FILE, or when FILE is -, read standard input.')
            .addOption('-A, --show-all', 'Equivalent to -vET', { name: 'showAll', sets: CatFlags.ShowEndOfLine | CatFlags.ShowNonPrinting | CatFlags.ShowTabs, clears: CatFlags.SqueezeBlanks })
            .addOption('-b, --number-nonblank', 'Number nonempty output lines, overrides -n', { name: 'showNonBlank', sets: CatFlags.ShowNonBlankLineNumbers, clears: CatFlags.ShowNumberLines })
            .addOption('-e', 'Equivalent to -vE', 'Equivalent to -vE', { name: 'vE', sets: CatFlags.ShowEndOfLine })
            .addOption('-E, --show-ends', 'Display $ at end of each line', { name: 'showEnds', sets: CatFlags.ShowEndOfLine | CatFlags.ShowNonPrinting })
            .addOption('-n, --number', 'Number all output lines', { name: 'numberOutput', sets: CatFlags.ShowLineNumbers, clears: CatFlags.ShowNonBlankLineNumbers })
            .addOption('-s, --squeeze-blank', 'Suppress repeated empty output lines', { name: 'squeezeBlanks', sets: CatFlags.SqueezeBlanks })
            .addOption('-t', 'Equivalent to -vT', { name: 'vT', sets: CatFlags.SqueezeBlanks | CatFlags.ShowNonPrinting })
            .addOption('-T, --show-tabs', 'display TAB characters as ^I', { name: 'showTabs', sets: CatFlags.ShowTabs })
            .addOption('-v, --show-nonprinting', 'Use ^ and M- notation, except for LFD and TAB', { name: 'showNonPrinting', sets: CatFlags.ShowNonPrinting })
            .addArgument('<FILES...>')
            .addFiller('FILES', () => {
                if (objin) {
                    let results = [];
                    for (const ob of objin) {
                        let filename = typeof ob === 'string' ? ob : ob.fullPath;
                        if (results.findIndex(f => f === filename) === -1)
                            results.push(filename);
                    }
                    return results;
                }
                if (stdin)
                    return stdin.readLines();
                return undefined;
            })
            .complete();
    }

    /**
     * Run the clone command
     * @param {string} text
     * @param {MUDInputEvent} evt
     */
    override async cmd(text, cmdline) {
        let options = await this.command.parse(cmdline);

        if (!text && !Array.isArray(options.FILES))
            return `Usage: ${cmdline.verb} [OPTIONS...] [FILES...]`;

        if (typeof options !== 'object')
            return options;

        let lineBuffer = await createAsync(CatOutput, options.catFlags),
            files = options.FILES;

        if (files.length === 0)
            files.push('-');

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

                    if (!fso.exists())
                        errorLine(`${cmdline.verb}: ${file}: No such file or directory`);
                    else if (fso.isDirectory())
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
}

