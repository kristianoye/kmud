/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
import { LIB_COMMAND } from '@Base';
import Command from LIB_COMMAND;

export default singleton class WhoCommand extends Command {
    override cmd(args, cmdline) {
        var players = efuns.living.players(),
            width = efuns.clientCaps(thisPlayer()).clientWidth,
            count = players.length,
            tp = thisPlayer;

        if (args[0] && args[0] === 'html') {
            return this.webcmd(args, cmdline);
        }

        writeLine('');
        writeLine(`{0:CENTER(${width})}`.fs('%^GREEN%^%^BOLD%^' + efuns.mudName() + '%^RESET%^'));
        writeLine('-='.repeat(Math.floor(width / 2) - 1) + '-');
        writeLine('');

        players.sort((a, b) => {
            if (efuns.adminp(a) && !efuns.adminp(b))
                return -1;
            else if (efuns.adminp(b) && !efuns.adminp(b))
                return 1;
            if (efuns.archp(a) && !efuns.archp(b))
                return -1;
            else if (efuns.archp(b) && !efuns.archp(b))
                return 1;
            if (efuns.wizardp(a) && !efuns.wizardp(b))
                return -1;
            else if (efuns.wizardp(b) && !efuns.wizardp(b))
                return 1;
            else if (a.keyId < b.keyId)
                return -1;
            else
                return 1;
        })

        players.forEach(player => {
            let prefix = '', idleStatus = '';

            if (efuns.adminp(player))
                prefix = '%^MAGENTA%^%^BOLD%^' + '[Admin]' + '%^RESET%^' ;
            else if (efuns.archp(player))
                prefix = '%^ORANGE%^%^BOLD%^' + '[Arch]' + '%^RESET%^' ;
            else if (efuns.wizardp(player))
                prefix = '%^YELLOW%^%^BOLD%^' + '[Wizard]' + '%^RESET%^ ';

            if (efuns.living.queryIdle(player) > 60000) {
                idleStatus = ' %^CYAN%^(Idle)%^RESET%^';
            }
            writeLine('    {0,-10}{1}{2}'.fs(prefix, player.getTitle(), idleStatus));
        });

        writeLine('');
        writeLine('-='.repeat(Math.floor(width / 2) - 1) + '-');
        switch (count) {
            case 0:
                writeLine(`{0:CENTER(${width})}`.fs(`There are no players on-line`));
                break;

            case 1:
                writeLine(`{0:CENTER(${width})}`.fs(`There is one player on-line`));
                break;

            default:
                writeLine(`{0:CENTER(${width})}`.fs(`There are ${efuns.cardinal(count)} players on-line`));
                break;
        }
        writeLine('-='.repeat(Math.floor(width / 2) - 1) + '-');

        return true;
    }

    webcmd(args, cmdline) {
        var players = users(),
            count = players.length;

        var result =
            <div className="who-results">
            <table>
                <thead>
                    <tr>
                        <td>There are currently {count} player(s) on {mud_name()}</td>
                    </tr>
                </thead>
                <tbody>
                {
                    players.map((player, i) => {
                        var lvl = player.getLevel(), status = [], color = '';
                        if (efuns.adminp(player))
                            lvl = 'ADMIN', color = 'color: purple';
                        else if (efuns.archp(player))
                            lvl = 'ARCH', color = 'color: blue';
                        else if (efuns.wizardp(player))
                            lvl = 'WIZARD', color = 'color: green';
                        else
                            lvl = player.getLevel().toString();

                        if (player.idleTime > 60)
                            status.push('idle');
                        else
                            status.push('active');

                        return (<tr style={color}>
                            <td>{lvl}</td>
                            <td>{player.getTitle()}</td>
                            <td>{status.join(',')}</td>
                        </tr>);
                    })
                }
                </tbody>
            </table>
        </div>;

        eventSend({
            type: 'contextMenu',
            data: {
                name: 'menu.who',
                options: {
                    emoteto: {
                        command: 'emoteto {name}...'
                    },
                    finger: {
                        command: 'finger {name}',
                        text: 'Finger info for {name}'
                    },
                    tell: {
                        command: 'tell {name}',
                        text: 'Tell {name} something...',
                    }
                }
            }
        });
        return writeLine(result.render());
    }

    help() {
        return "Shows you who is on-line";
    }
}
