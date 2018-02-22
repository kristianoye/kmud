include('Base');

imports(LIB_COMMAND);

class Scan extends Command {

    cmd(...args) {
        var target = thisPlayer.environment;

        this.scanInventory(target, 1);
        return true;
    }

    scanInventory(target, depth) {
        if (depth === 0)
            thisPlayer.writeLine(`Scanning ${efuns.identify(target)}`)
        else
            thisPlayer.writeLine(Array(depth).join('   ') + efuns.identify(target));
        target.inventory.forEach(inv => this.scanInventory(inv, depth + 1));
    }
}

MUD.export(Scan);
