/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_SHELLCMD } from '@Base';
import Command from LIB_SHELLCMD;

const
    MkdirVerbose = 1 << 0,
    MkdirParents = 1 << 1;

export default singleton class MkDirCommand extends Command {
    protected override create() {
        super.create();
        this.verbs = ['mkdir', 'md'];
        this.command
            .setVerb(...this.verbs)
            .setBitflagBucketName('mkdirFlags')
            .setDescription('Create directories')
            .addOption('-p, --parents', 'No error if existing, make parent directories as needed', { name: 'createParents', sets: 1 })
            .addOption('-v, --verbose', ' print a message for each created directory', { name: 'showNonPrinting', sets: CatFlags.ShowNonPrinting })
            .addArgument('<DIRECTORY...>');
    }

    /**
     * Create a directory
     * @param {string} cmdText The raw text for the command
     * @param {MUDInputEvent} cmdline The input event from the client
     */
    override async cmd(cmdText, cmdline) {
        try {

        }
        catch (err) {

        }
    }

    /**
     * 
     * @param {string[]} dirList A list of directories waiting to be created
     * @param {number} flags Flags controlling the operation
     * @param {number} options Options controlling output 
     * @param {MUDInputEvent} cmdline The command line options sent by the user
     */
    private async createDirectories(dirList, flags, options, cmdline) {
        try {
            let dir = dirList.shift();

            if (dir) {
                let result = await efuns.fs.createDirectoryAsync(dir, flags)
                    .catch(err => { throw err });

                if (options.hasFlag(MkdirVerbose))
                    writeLine('Mkdir: ' + (success ? `Created ${dir}` : `Failed: ${error.message}`));
            }
            if (dirList.length === 0)
                return true;
            else
                return await this.createDirectories(dirList, flags, options, cmdline);
        }
        catch (err) {
            writeLine(`MkDir error: ${err.message}`);
            return false;
        }
    }
}
