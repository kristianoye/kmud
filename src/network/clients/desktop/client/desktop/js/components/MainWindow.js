/// <reference path="../client.js" />
/// <reference path="InputRenderer.js" />


(function (DesktopClientClass, BaseComponent) {
    class MainWindow extends BaseComponent {
        constructor(desktop, window, options = {}) {
            super(desktop, window, options);

            this.mudName = 'Unknown MUD';
            this.setTitle(`${this.mudName} - Connected`);
            this.connected = true;
            this.onWindowHint({ data: { mode: 'dialog' } });
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
            let $table = InputRenderer.render(Object.assign({}, event, { sender: this }));

            if (this.mode === 'dialog') {
                this.$content.empty();
                this.$content.append($table);
            }
            else if (this.mode === 'normal') {
                let $textarea = $('<textarea placeholder="Enter a commmand..." class="commandPrompt" />');
                let $sendButton = $('<input type="button" class="sender" value="Send" />');

                this.$prompter.empty().append($textarea, $sendButton);

                if (this.window.active === true) {
                    setTimeout(() => $textarea.focus(), 50);
                }

                $sendButton.one('click', e => {
                    this.sendEvent({ type: 'input', data: $textarea.val() });
                });
                $textarea.on('keydown', e => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopImmediatePropagation();

                        this.sendEvent({ type: 'input', data: $textarea.val() });
                    }
                });
            }
        }

        onWindowHint(event) {
            super.onWindowHint(event);
            if (this.mode !== event.data.mode) {
                this.$content.empty();

                switch (this.mode = event.data.mode || 'normal') {
                    case 'normal':
                        {
                            let $view = this.$view = $('<section class="view"></section>');
                            let $prompter = this.$prompter = $('<footer class="prompter"></footer>')
                            this.$content.append($view, $prompter);
                        }
                        break;
                }
            }
        }

        onWrite(event) {
            if (this.mode === 'normal') {
                let $div = $('<div class="msg" />').append(event.data);
                this.$view.append($div);
                $div[0].scrollIntoView();
            }
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
