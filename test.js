
function Tester() {
	this.name = 'Kris';
	this.age = 43;
}

var bar = new Tester();
var foo = { bar };

with(foo) {
	console.log(`My name is ${bar.name} and I am ${bar.age} years old`);
}
