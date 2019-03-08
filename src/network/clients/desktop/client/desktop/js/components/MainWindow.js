/// <reference path="../client.js" />


(function (DesktopClientClass, BaseComponent) {
    class MainWindow extends BaseComponent {
        constructor(desktop, window, options = {}) {
            super(desktop, window, options);

            this.mudName = 'Unknown MUD';
            this.setTitle(`${this.mudName} - Connected`);
            this.connected = true;
        }

        _register() {
            return {
                shell: true
            };
        }

        onConnect() {
            this.connected = true;
            this.setTitle(`${this.mudName} - Connected`);
        }

        onConnected(event) {
            this.connected = true;
            this.mudName = event.data;
            this.setTitle(`${this.mudName} - ${this.connected ? 'Connected' : 'Disconnected'}`);
        }

        onDisconnect() {
            this.connected = false;
            this.setTitle(`${this.mudName} - Disconnected`);
        }
    }

    /**
     * 
     * @param {DesktopClientClass} desktop The client
     * @param {Object.<string,any>} options The initial options
     */
    MainWindow.createWindowOptions = function (desktop, options = {}) {
        let deskSize = desktop.desktopSize;
        return options = Object.assign({
            animations: false,
            title: 'Main Window',
            classname: 'MainWindow',
            x: deskSize.width / 4,
            y: deskSize.height / 4,
            stayinspace: true,
            width: deskSize.width / 2,
            height: deskSize.height / 2
        }, options);
    };

    DesktopClientClass.defineWindowType(MainWindow);

})(DesktopClientClass, BaseComponent);
