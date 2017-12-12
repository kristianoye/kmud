MUD.include('Base');

MUD.imports(LIB_COMMAND);

class People extends Command {
    cmd(args) {
        var players = efuns.players().map(p => {
            var data = {
                age: p.getAge('days'),
                idle: Math.floor(p.idleTime / 1000),
                level: p.getLevel(),
                name: p.isVisible() ? p.getName().ucfirst() : '[' + p.getName().ucfirst() + ']',
                location: p.environment.filename,
            }
            return efuns.sprintf('%-10s%-3d%-20s%-10s  %s',
                data.age,
                data.level,
                data.name,
                data.idle,
                data.location);
        }),
            lines = [];

        lines.push('-'.repeat(80));
        lines.push(efuns.sprintf('%-50s50s', '{0} people in current sort'.fs(players.length), new Date().toISOString()));
        lines.push('-'.repeat(80));
        lines.push(...players);
        lines.push('-'.repeat(80));

        thisPlayer.writeLine(lines.join('\n'));
        return true;
    }
}

MUD.export(People);
