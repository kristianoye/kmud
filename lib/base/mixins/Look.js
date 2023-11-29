
export default abstract class Look {
    create() {
        this.lookItems = {};
    }

    directLookAtObject(target) {
        return true;
    }

    directLookAtObjectInObject(target, container) {
        return true;
    }

    get lookItems() {
        return get({});
    }

    set lookItems(items) {
        set(items);
    }
}
