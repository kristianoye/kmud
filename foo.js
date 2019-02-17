class A {
	get test() { return 'A'; }
}

class B {
	get tester() { return this.test; }
}

let foo = new B();

console.log(foo.tester);
