
/**
 * @typedef {Object} InputEventData
 * @property {string} [name] An optional name for the control.
 * @property {Object.<string,string>} [options] Options for list-based controls
 * @property {string} [renderAs] Type of HTML control to use if available.
 * @property {string} [type='text'] The type of input to render.
 * @property {string} [text] The label for the prompt.
 *
 * @typedef {Object} InputEvent
 * @property {string} type The type of input event
 * @property {string} [subType] An optional input subtype.
 * @property {InputEventData} data The data describing what to render.
 */

const InputRenderer = (function () {
    class InputRender {
        /**
         * Create a unique ID for an element
         * @param {InputEventData} data Input event data
         * @returns {string} The unique identifier
         */
        createId(data, name = false) {
            return (name || data.name || data.type || 'text') + uuidv1().replace(/\-/g, '');
        }

        /**
         * @returns {JQuery<HTMLTableElement>}
         */
        createTable() {
            return $('<table class="prompt" />')
                .css({ margin: '15% auto' });
        }

        /**
         * Render HTML based on an input event
         * @param {InputEvent} event An input event
         */
        render(event) {
            try {
                if (['input', 'prompt'].indexOf(event.type) > -1)
                    return this.renderInput(event);
                else
                    throw new Error(`Unhandled event type ${event.type}`);
            }
            catch (err) {
                console.log('render() error', err);
            }
        }

        /**
         * Render HTML based on an input event
         * @param {InputEvent} event An input event
         */
        renderInput(event) {
            switch (event.data.type) {
                case 'text':
                case 'password':
                    return this.renderTextControl(event);

                case 'yes-no':
                case 'yes-no-cancel':
                case 'abort-retry-fail':
                    return this.renderYesNoControl(event);

                case 'pickone':
                    return this.renderPickOne(event);

                default:
                    throw new Error(`Unhandled input type: ${event.data.type}`);
            }
        }

        /**
         * Render HTML radio group based on an input event
         * @param {InputEvent} event An input event
         * @param {JQuery<HTMLElement>} $table The element to append controls to
         */
        renderPickOne(event, $table = false) {
            let data = event.data,
                sender = event.sender,
                action = data.action || 'Next',
                groupName = this.createId(data, 'radio'),
                isNewTable = $table === false,
                vTop = { verticalAlign: 'top' },
                $controlCell = $('<td/>').css(vTop),
                $labelCell = $('<td/>').text(data.text).css(vTop),
                options = Object.keys(data.options);

            if (data.renderAs === 'radiogroup') {
                options.forEach((opt, i) => {
                    let id = this.createId(data, 'radio');
                    let display = data.options[opt];
                    let $label = $(`<label for="${id}" />`).text(display);
                    let $radio = $(`<input type="radio" id="${id}" name="${groupName}" value="${display}" />`);
                    if (i > 0) $controlCell.append('<br/>');
                    $controlCell.append($radio, $label);
                });
            }

            if ($table === false) {
                $table = this.createTable();
            }
            let $radioRow = $('<tr/>').append($labelCell, $controlCell);

            if (isNewTable) {
                let $button = $(`<input type="button" value="${action}" />`);

                $button.on('click', function () {
                    let $selected = $radioRow.find('input:checked');
                    sender.sendEvent({ type: 'input', data: $selected.val() });
                });

                $radioRow.append(
                    $('<td />').append($button).css(vTop));
            }
            $table.append($radioRow);
            return $table;
        }

        /**
         * Render HTML text or password based on an input event
         * @param {InputEvent} event An input event
         * @param {JQuery<HTMLElement>} $table The element to append controls to
         */
        renderTextControl(event, $table = false) {
            let data = event.data,
                action = data.action || 'Next',
                sender = event.sender,
                id = this.createId(data),
                isNewTable = $table === false,
                $prompt = $(`<input type="${data.renderAs || data.type}" name="${id}" id="${id}" />"`).data(data),
                $label = $(`<label for="${id}" />`).text(data.text),
                $row = $('<tr/>')
                    .append($('<td/>').append($label))
                    .append($('<td/>').append($prompt));

            if ($table === false) {
                $table = this.createTable();
            }
            if (isNewTable) {
                let $button = $(`<input type="button" value="${action}" />`);

                $row.append(
                    $('<td />').append($button).css({ textAlign: 'center' }));

                $button.on('click', function() {
                    sender.sendEvent({ type: 'input', data: $prompt.val() });
                });
                $prompt.on('keydown', function (e) {
                    if (e.key === 'Enter') {
                        sender.sendEvent({ type: 'input', data: $prompt.val().trim() });
                    }
                });
            }
            $table.append($row);

            setTimeout(() => $prompt.focus(), 50);

            return $table;
        }

        /**
         * Render HTML radio group based on an input event
         * @param {InputEvent} event An input event
         * @param {JQuery<HTMLElement>} $table The element to append controls to
         */
        renderYesNoControl(event, $table = false) {
            let data = event.data,
                sender = event.sender,
                action = data.action || 'Next',
                groupName = this.createId(data, 'radio'),
                isNewTable = $table === false,
                $controlCell = $('<td/>'),
                $labelCell = $('<td/>').text(data.text),
                options = data.type.split('-');

            options.forEach(opt => {
                let id = this.createId(data, 'radio');
                let $label = $(`<label for="${id}" />`).text(opt);
                let $radio = $(`<input type="radio" id="${id}" name="${groupName}" value="${opt}" />`);
                $controlCell.append($radio, $label);
            });

            if ($table === false) {
                $table = this.createTable();
            }
            let $radioRow = $('<tr/>').append($labelCell, $controlCell);

            if (isNewTable) {
                let $button = $(`<input type="button" value="${action}" />`);

                $button.on('click', function () {
                    let $selected = $radioRow.find('input:checked');
                    sender.sendEvent({ type: 'input', data: $selected.val() });
                });

                $radioRow.append(
                    $('<td />').append($button).css({ textAlign: 'center' }));
            }
            $table.append($radioRow);
            return $table;
        }
    }

    return new InputRender();
})();
