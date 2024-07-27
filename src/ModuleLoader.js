async function load(url, context, nextLoad) {
    console.log(`Loading ${url}`);
    return await nextLoad(url, context);
}

module.exports = { load };
