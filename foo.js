
async function foobar() {
	return (console.log('Starting'), true) && await (new Promise((r,e) => {
		setTimeout(() => r('Hello World'), 2000);
	}));
}

async function doIt() {
	let foo = await foobar().then(value => value);
	
	console.log(foo);
}

doIt();

