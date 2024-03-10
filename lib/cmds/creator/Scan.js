/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: March 9, 2024
 */
import { LIB_COMMAND } from 'Base';
import Command from LIB_COMMAND;

const Flags = {
    DeepScan: 1 << 0,
    ShowFilename: 1 << 1,
    ShowInfo: 1 << 2,
    ScanEnvironment: 1 << 3
};

export default singleton class ScanCommand extends Command {
    async override cmd(str, cmdline) {
        let targets = [], options = 0, args = cmdline.args || [];

        if (str) {
            for (let i = 0; i < args.length; i++) {
                if (args[i].startsWith('-')) {
                    /** @type {string[]} */
                    let flags = args[i].slice(1).split('');

                    for (const flag of flags) {
                        switch (flag) {
                            case 'd':
                                options |= Flags.DeepScan;
                                break;
                            case 'f':
                                options |= Flags.ShowFilename;
                                break;
                            case 'i':
                                options |= Flags.ShowInfo;
                                break;
                            case 'e':
                                options |= Flags.ScanEnvironment;
                                break;
                            default:
                                return `${cmdline.verb}: Unknown command switch: ${flag}`;
                        }
                    }
                }
                else {
                    let ob = await efuns.objects.resolveObject(args[i]);
                    if (!ob)
                        errorLine(`${cmdline.verb}: Unable to locate ${args[i]}`);
                    else
                        targets.push(ob);
                }
            }
        }
        if (targets.length === 0)
            targets.push(thisPlayer());

        if ((options & Flags.ScanEnvironment) > 0)
            targets = targets.map(o => o.environment);

        let result = targets.map(o => this.scanItem(o, options)).join(efuns.eol);

        return writeLine(result);
    }

    scanItem(item, options = 0, depth = 0) {
        let result = '\t'.repeat(depth) + efuns.identify(item);

        if ((options & Flags.ShowFilename) > 0)
            result += ` [filename: ${item.fullPath}]`;

        if ((options & Flags.ShowInfo) > 0) {
            let props = [];

            if ('keyId' in item)
                props.push(`keyId: ${item.keyId}`);
            if ('weight' in item)
                props.push(`weight: ${item.weight}`);
            if (efuns.living.isWizard(item))
                props.push('wizard');
            else if (efuns.living.isPlayer(item))
                props.push('player');
            else if (efuns.living.isAlive(item))
                props.push('living');
            if (props.length === 0)
                props.push('No properties to show');

            result += ' [' + props.join('; ') + ']';
        }

        result += efuns.eol;

        if ((options & Flags.DeepScan) > 0) {
            for (const inv of item.inventory) {
                result += this.scanItem(inv, options, depth + 1);
            }
        }
        else if (depth === 0) {
            for (const inv of item.inventory) {
                result += this.scanItem(inv, options, depth + 1);
            }
        }

        return result;
    }
}