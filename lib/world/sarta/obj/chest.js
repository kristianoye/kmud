const
    Base = await requireAsync('Base'),
    Container = await requireAsync(Base.Container);

class Chest extends Container {
    create() {
        with (this) {
            this.primaryName = 'chest';
            this.ids = ['chest', 'box'];
            this.adjectives = 'small';
            this.short = 'A small chest';
            this.long = 'This is a small chest you can store stuff in';
            this.weight = 
            setWeight(5, 'Pounds');
        }
    }
}

module.exports = Chest;

