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
                requiresShell: true,
                attachTo: 'newLogin'
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

        onPrompt(event) {
            let data = event.data, id = event.name || 'Input',
                $prompt = $(`<input type="${data.type}" name="${id}" id="${id}" />"`).data(data),
                $label = $(`<label for="${id}" />`).text(data.text),
                $row = $('<tr/>')
                    .append($('<td/>').append($label))
                    .append($('<td/>').append($prompt)),
                $table = $('<table class="prompt" />')
                    .css({ margin: '15% auto' })
                    .append($row),
                $button = $('<input type="button" value="Continue" />');

            $table.append($('<tr/>').append(
                $('<td colspan="2" />').append($button)
                    .css({ textAlign: 'center' })));

            $button.on('click', e => {
                this.sendEvent({ type: 'input', data: $prompt.val() });
            });

            if (this.mode === 'dialog')
                this.$content.empty();

            this.$content.append($table);
        }

        onWindowHint(event) {
            super.onWindowHint(event);
            this.mode = event.data.mode || 'normal';
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
