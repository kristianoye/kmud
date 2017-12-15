
MUD.include('Base', 'Daemon');

MUD.imports(LIB_INTERACTIVE);

class Player extends Interactive {
    connect(client) {
        super.connect(client);
        client.eventSend({
            eventType: 'kmud.connected',
            eventData: this.displayName + '@' + efuns.mudName()
        });
        this.writeLine('$storage = ' + typeof $storage);
        this.enableHeartbeat(true);
    }

    dispatchInput(input, fromHistory) {
        if (thisPlayer !== this) {
            console.log('Illegal force attempt');
        }
        return super.dispatchInput(input, fromHistory);
    }

    isPlayer() { return true; }

    isVisible() {
        return this.getProperty('visible', true) !== false;
    }

    save(callback) {
        var PlayerDaemon = efuns.loadObject(DAEMON_PLAYER);
        PlayerDaemon().savePlayer(this, callback);
    }
}

MUD.export(Player);
