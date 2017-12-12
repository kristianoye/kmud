MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

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
        var tp = thisPlayer,
            limbs = tp.limbs,
            lines = [],
            name = 'Your';

        if (limbs.length === 0)
            return 'You have no body!';

        for (var i = 0; i < limbs.length; i++) {
            var limb = tp.getLimb(limbs[i]),
                pc = Math.floor((limb.curHP / limb.maxHP) * 100),
                s = '', color = '';

            if (pc > 97)
                s = name + ' ' + limbs[i] + ' is in perfect condition';
            else if (pc < 4)
                s = name + ' ' + limbs[i] + ' is about to fall off!';
            else {
                var x = Math.min(9, parseInt(pc / 10));
                s = name + ' ' + limbs[i] + damageDescription[x];
            }
            switch (true) {
                case (pc < 5): color = '%^RED%^%^BOLD%^'; break;
                case (pc < 10): color = '%^RED%^'; break;
                case (pc < 25): color = '%^YELLOW%^'; break;
            }
            if (efuns.wizardp(tp)) {
                s = efuns.sprintf('%-60s (%d/%d %.2f%%)', s, limb.curHP, limb.maxHP, pc);
            }
            lines.push(color + s + '%^RESET%^');
        }
        thisPlayer.writeLine(lines.join('\n'));
        return true;
    }

    getHelp() {
        return {
            text: `
<p><strong>Syntax:</strong> body [LIVING]</p>
<p>The <strong>body</strong> command will display any damage the various parts of your body has taken.</p>`,
            see: ['score', 'skills', 'languages']
        };
    }
}

MUD.export(Body);
