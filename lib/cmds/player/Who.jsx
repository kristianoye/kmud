/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: October 1, 2017
 */
const
    Base = require('Base'),
    Command = require(Base.Command);

class WhoCommand extends Command {
    cmd(args, cmdline) {
        var players = efuns.living.players(),
            count = players.length,
            tp = thisPlayer;

        if (args[0] && args[0] === 'html') {
            return this.webcmd(args, cmdline);
        }

        writeLine(`There are ${count} player(s) on-line:`);

        players.forEach(player => {
            writeLine(player.getTitle());
        });

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

module.exports = new WhoCommand();
