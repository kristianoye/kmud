/*
 * Written by Kris Oye <kristianoye@gmail.com>
 * Copyright (C) 2017.  All rights reserved.
 * Date: February 28, 2019
 *
 * Description: For JSX implementation
 */

class MUDHtmlComponent {
    constructor(_element, _props, _children) {
        this.element = _element;
        this.props = _props;
        this.children = _children;
    }

    render() {
        let result = '<' + this.element;

        Object.keys(this.props).forEach(k => {
            let val = this.props[k];
            switch (k) {

                case 'className':
                    result += ' class=';
                    break;

                case 'htmlFor':
                    result += ' for=';
                    break;

                default:
                    result += ` ${k}=`;
                    break;
            }
            if (typeof val === 'string')
                result += `"${val}"`;
            else
                result += ` "${JSON.stringify(this.props[k])}"`;
        });
        result += '>';
        if (Array.isArray(this.children)) {
            this.children.forEach(c => {
                if (typeof c === 'string') {
                    result += c;
                }
                else if (c instanceof MUDHtmlComponent) {
                    result += c.render();
                }
                else {
                    result += c?.toString();
                }
            });
        }
        result += '</' + this.element + '>';
        return result;
    }

    toString() {
        return this.render();
    }
}

class MUDHtmlElement extends MUDHtmlComponent {
    constructor(_element, _props, _children) {
        super(_element, _props, _children);
        this.isSelfClosing = false;
    }
}

module.exports = {
    MUDHtmlComponent: MUDHtmlComponent,
    MUDHtmlElement: MUDHtmlElement
};
