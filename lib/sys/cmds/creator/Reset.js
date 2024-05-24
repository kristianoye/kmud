/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_SHELLCMD } from '@Base';
import ShellCommand from LIB_SHELLCMD;

export default final singleton class ResetCommand extends ShellCommand {
    protected override create() {
        super.create();
        this.verbs = ['reset', 'reset-object'];
        this.command
            .setVerb(...this.verbs)
            .setDescription('Call reset on FILES regardless of their internal time-to-reset')
            .addArgument('<FILE(S)...?>')
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
     * @param {string} txt
     * @param {MUDInputEvent} evt
     */
    override async cmd(txt, evt) {
        try {
            let options = await this.command.parse(evt);

            if (typeof options !== 'object')
                return options;

            if (options.FILES.length === 0)
                options.FILES.push('here');

            for (const target of options.FILES) {
                if (typeof target === 'string') {
                    let o = await efuns.objects.resolveObject(target);
                    if (o) {
                        if (typeof o.resetAsync === 'function')
                            await o.resetAsync();
                        else if (typeof o.reset === 'function') {
                            await o.reset();
                        }
                    }
                }
            }
        }
        catch (err) {
            errorLine(`${evt.verb}: Error: ${err.message}`);
        }
        return false;
    }
}
