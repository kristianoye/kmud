/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = await requireAsync('Base'),
    Command = await requireAsync(Base.Command);

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

class Body extends Command {
    cmd(args, cmdline) {
        var tp = thisPlayer(),
            limbs = tp.limbs,
            lines = [],
            name = 'Your';

        if (limbs.length === 0)
            return errorLine('You have no body!');

        Object.keys(limbs).forEach(limbName => {
            let limb = limbs[limbName],
                pc = Math.floor((limb.curHP / limb.maxHP) * 100),
                s = '', color = '';

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
                s = efuns.sprintf('%-60s (%d/%d %.2f%%)', s, limb.curHP, limb.maxHP, pc);
            }
            lines.push(color + s + '%^RESET%^');
        });
        return writeLine(lines.join('\n'));
    }

    getHelp() {
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

module.exports = new Body();
