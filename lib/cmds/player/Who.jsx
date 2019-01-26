MUD.include('Base', 'Daemon');

MUD.imports(LIB_COMMAND);

class Who extends Command {
    cmd(args, cmdline) {
        var players = efuns.players(),
            count = players.length,
            tp = thisPlayer;
        if (args[0] && args[0] === 'html') {
            return this.webcmd(args, cmdline);
        }
        tp.writeLine(`There are ${count} player(s) on-line:`);
        players.forEach((player, i) => {
            tp.writeLine(player.getTitle());
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

        thisPlayer.eventSend({
            eventType: 'contextMenu',
            eventData: {
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
        thisPlayer.write(result.render());
        return true;
    }

    help() {
        return "Shows you who is on-line";
    }
}

MUD.export(Who);
