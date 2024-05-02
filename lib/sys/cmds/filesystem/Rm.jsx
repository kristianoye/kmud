/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_SHELLCMD } from 'Base';
import Command from LIB_SHELLCMD;

const
    DeleteFlags = efuns.fs.DeleteFlags;


/**
 * Removes files from the filesystem.
 */
export default singleton class RmCommand extends Command {
    protected override create() {
        super.create();
        this.verbs = ['rm', 'del', 'remove-item'];
        this.command
            .setVerb(...this.verbs)
            .setDescription('Remove/unlink/delete FILE(s) from the filesystem')
            .setBitflagBucketName('deleteFlags')
            .addOption('-d, --dir', 'Remove empty directories', { name: 'removeEmpties', sets: DeleteFlags.RemoveEmpty })
            .addOption('-f, --force', 'Ignore nonexistent files and arguments, delete read-only files, never prompt', { name: 'force', sets: DeleteFlags.Force, clears: DeleteFlags.Interactive })
            .addOption('--interactive <interactive:always|always|never|once|smart>', 'Prompt according to WHEN: never, once (-I), or always (-i); without WHEN, prompt always', { name: 'interactive' })
            .addOption('--one-file-system', 'When removing a hierarchy recursively, skip any directory that is on a file system different from that of the corresponding command line argument', { name: 'sfs', sets: DeleteFlags.SingleFilesystem })
            .addOption('-i, --prompt', 'Prompt before every removal', { name: 'prompt', sets: DeleteFlags.Interactive, clears: DeleteFlags.Force })
            .addOption('-I', 'Prompt once before removing more than three files, or when removing recursively; less intrusive than -i, while still giving protection against most mistakes', { name: 'smartPrompt', sets: DeleteFlags.SmartPrompt, clears: DeleteFlags.Force })
            .addOption('-r, --recursive', 'Remove directories and their contents recursively', { name: 'recursive', sets: DeleteFlags.Recursive })
            .addOption('-v, --verbose', 'Explain what is being done', { name: 'verbose', sets: DeleteFlags.Verbose })
            .addArgument('<FILE(S)...>')
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
     * 
     * @param {string} str The raw input from the user
     * @param {MUDInputEvent} evt
     */
    override async cmd(str, evt) {
        /** @type {{ FILES: string[], deleteFlags: number }} */
        let options = await this.command.parse(evt);

        if (typeof options !== 'object')
            return options;

        let
            maxPrompts = (options.deleteFlags & DeleteFlags.SmartPrompt) > 0 ? 3 : Number.MAX_SAFE_INTEGER,
            defaultResponse = true,
            apiSettings = {
                flags: options.deleteFlags,
                onConfirmDelete: async (verb, filename, isDir = false) => {
                    if (typeof defaultResponse === 'undefined')
                        return false;
                    let opts = Object.assign({
                        text: `${verb}: Remove ${(isDir ? 'directory' : 'file')} '${filename}'?\n`, type: 'pickOne', options: {
                            y: 'yes',
                            n: 'no',
                            Y: 'Yes to all',
                            N: 'No to all',
                            A: 'Abort'
                        },
                        compact: true,
                        prompt: ''
                    });

                    if (maxPrompts < 1)
                        return defaultResponse;

                    let resp = await promptAsync('pickone', opts);
                    switch (resp) {
                        case 'yes':
                            maxPrompts--;
                            return true;
                        case 'no':
                            return false;
                        case 'Abort':
                            defaultResponse = undefined;
                            throw new Error(`${verb}: Aborted by user`);
                        case 'Yes to all':
                            maxPrompts = 0;
                            return true;
                        case 'No to all':
                            maxPrompts = 0;
                            return (defaultResponse = false);
                    }
                    return false;
                },
                onDeleteComplete: async (verb, filename, fso) => {
                    if ((options.deleteFlags & DeleteFlags.Verbose) > 0) {
                        writeLine(`${verb}: Removed '${filename}'`);
                    }
                    efuns.addOutputObject(fso);
                },
                onDeleteFailure: (verb, displayPath, msg) => {
                    errorLine(`${verb}: Failed to remove '${displayPath}': ${msg}`);
                },
                onDeleteInformation: (verb, msg) => {
                    writeLine(`${verb}: ${msg}`);
                },
                verb: evt.verb,
                workingDirectory: thisPlayer().workingDirectory
            };

        for (const file of options.FILES) {
            try {
                await efuns.fs.deleteAsync(file, apiSettings);
            }
            catch (err) {
                errorLine(`${evt.verb}: Error while removing ${file}: ${err}`);
            }
        }

        return true;
    }
}
