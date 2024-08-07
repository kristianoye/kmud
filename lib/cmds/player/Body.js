/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from '@Base';
import Command from LIB_COMMAND;

const
    damageDescription = [
        " is in critical condition!",
        " is battered beyond recognition.",
        " is severely wounded",
        " is terribly damaged.",
        " is in bad shape.",
        " is hurting.",
        " has a few bruises.",
        " is in decent shape.",
        " is in very good shape.",
        " is in excellent shape."
    ];

export default singleton class Body extends Command {
    override cmd(args, cmdline) {
        var tp = thisPlayer(),
            limbs = tp.limbs,
            lines = [],
            name = 'Your';

        try {
            if (limbs.length === 0)
                return errorLine('You have no body!');
            for (const [limbName, limb] of Object.entries(limbs)) {
                let pc = Math.floor((limb.curHP / limb.maxHP) * 100),
                    s = '',
                    color = '';
                if (pc > 97)
                    s = `${name} ${limbName} is in perfect condition`;
                else if (pc < 4)
                    s = `${name} ${limbName} is about to fall off!`;
                else {
                    let x = Math.min(damageDescription.length - 1, parseInt(pc / 10));
                    s = `${name} ${limbName} ${damageDescription[x]}`;
                }
                switch (true) {
                    case (pc < 10): color = '%^RED%^%^BOLD%^'; break;
                    case (pc < 25): color = '%^RED%^'; break;
                    case (pc < 50): color = '%^YELLOW%^'; break;
                }
                if (efuns.wizardp(tp)) {
                    s = s.padRight(60) + `(${limb.curHP}/${limb.maxHP} [${pc.toFixed(2)}%])`
                }
                lines.push(color + s + '%^RESET%^');
            }
        }
        catch (err) {
            errorLine(`${cmdline.verb}: Error: ${err}`);
        }
        return writeLine(lines.join('\n'));
    }

    override getHelp() {
        return {
            type: 'command',
            category: 'Commands > Player Commands > Status Commands',
            command: 'body',
            description: `
                <p><strong>Syntax:</strong> body [LIVING]</p>
                <p>The <strong>body</strong> command will display any damage the various parts of your body has taken.</p>`,
            usage: 'body',
            seeAlso: 'score, skills, languages'
        };
    }
}
